from fastapi import HTTPException
from fastapi import Header
from typing import Optional
from fastapi import Query

from jose import jwt, JWTError
from ldap3 import Server, Connection, ALL
from ldap3.core.exceptions import LDAPException
from datetime import datetime, timedelta, timezone
import uuid
import json
import secrets, base64, hashlib, hmac

from .models import User

SECRET_KEY, ALGORITHM, AUT_TYPE, LDAP_SERVER, LDAP_DOMAIN, LDAP_BASE, TOKEN_EXPIRE_MINUTES = None, None, None, None, None, None, None

def readAuthConfig():
    global SECRET_KEY, ALGORITHM, AUT_TYPE, LDAP_SERVER, LDAP_DOMAIN, LDAP_BASE, TOKEN_EXPIRE_MINUTES
    # read configuration
    with open("config/auth.json", "r") as f:
        config = json.load(f)

        if config.get("secret_key", None):
            SECRET_KEY = config["secret_key"]
        else:
            raise ValueError("secret_key not set in auth.json")
        
        if config.get("algorithm", None):
            ALGORITHM = config["algorithm"]
        else:
            raise ValueError("algorithm not set in auth.json")
        
        if config.get("authentication", None):
            AUT_TYPE = config["authentication"]
            
            if AUT_TYPE == "ldap":
                if config.get("ldap_server", None):
                    LDAP_SERVER = config["ldap_server"]
                else:
                    raise ValueError("ldap_server not set in auth.json")
                
                LDAP_DOMAIN = config.get("ldap_domain", None)
                LDAP_BASE = config.get("ldap_base", None)
        else:
            raise ValueError("authentication not set in auth.json")

        if config.get("token_expire_minutes", None):
            TOKEN_EXPIRE_MINUTES = config["token_expire_minutes"]
        else:
            TOKEN_EXPIRE_MINUTES = 60
            

def verify_token(authorization: Optional[str] = Header(None), token: Optional[str] = Query(None)):
    # Determine which token to use
    final_token = authorization or token
    
    if not final_token:
        raise HTTPException(
            status_code=401, 
            detail="Missing Authorization Header or Token Query Parameter"
        )
        
    return Authenticator.validate_token(final_token)


class Authenticator:
    @staticmethod
    def authenticate(username: str, password: str) -> bool:
        if AUT_TYPE == "ldap":
            return Authenticator.authenticate_ldap(username, password)
        elif AUT_TYPE == "local":
            return Authenticator.authenticate_local(username, password)
        elif AUT_TYPE == "dummy":
            return True
        else:
            raise ValueError("Invalid authentication type")
        
        return False
        
    @staticmethod
    def authenticate_ldap(username: str, password: str) -> bool:
        server = Server(LDAP_SERVER, use_ssl=True, get_info=ALL)
        if LDAP_BASE:
            user_dn = f"uid={username},{LDAP_BASE}"
        elif LDAP_DOMAIN:
            user_dn = f"{username}@{LDAP_DOMAIN}"
        else:
            user_dn = username

        try:
            conn = Connection(server, user=user_dn, password=password, auto_bind=True)
            conn.unbind()
            
            # update last_active
            user = User.read_by_username(username)
            if user is not None:
                user = User(**user)
                user.last_active = datetime.now().isoformat()
                user.update()

            return True
        except LDAPException:
            return False
        
    @staticmethod
    def authenticate_local(username: str, password: str) -> bool:
        user = User.read_by_username(username)
        if user is not None:
            if Authenticator._verify_key(password, user.get("password_salt", None), user.get("password_hash", None), user.get("password_iterations", 200_000)):
                # update last_active
                user = User(**user)
                user.last_active = user.API_key_last_used_at
                user.update()
                
                return True
            
        return False
        
    @staticmethod
    def authenticate_api_key(api_key: str) -> str:
        # look up by prefix to avoid scanning all users
        prefix = (api_key or "")[:12]
        users = User.all(query={"API_key_prefix": prefix, "API_access": True, "API_key_status": "active"})
        
        # for each user, try to validate using their salt and iterations
        for u in users:
            if Authenticator._verify_key(api_key, u.get("API_key_salt"), u.get("API_key_hash"), u.get("API_key_iterations", 200_000)):
                # update API_key_last_used_at and last_active
                user = User.read_by_username(u["username"])
                if user is not None:
                    user = User(**user)
                    user.API_key_last_used_at = datetime.now().isoformat()
                    user.last_active = user.API_key_last_used_at
                    user.update()

                return u["username"]
        
        # if no user is validated, raise error
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    @staticmethod
    def _verify_key(provided_key: str, salt_b64: str, hash_b64: str, iterations: int) -> bool:
        if not provided_key or not salt_b64 or not hash_b64:
            return False
        
        # decode the salt from base64
        salt = base64.b64decode(salt_b64.encode("utf-8"))
        
        # hash the provided key with the same parameters
        dk = hashlib.pbkdf2_hmac(
            "sha256",
            (provided_key + SECRET_KEY).encode("utf-8"),
            salt,
            iterations,
        )
        computed_b64 = base64.b64encode(dk).decode("utf-8")
        
        # compare the computed hash with the stored hash securely
        return hmac.compare_digest(computed_b64, hash_b64)
        
    @staticmethod
    def create_api_key(prefix_len: int = 12, salt_len: int = 16, iterations: int = 200_000) -> dict:
        # Generate a new API key and its associated hash/salt
        api_key = secrets.token_urlsafe(48)  # ~256-bit secret, URL-safe
        prefix = api_key[:prefix_len]
        salt = secrets.token_bytes(salt_len)
        
        # define the hash using PBKDF2-HMAC-SHA256
        dk = hashlib.pbkdf2_hmac(
            "sha256",
            (api_key + SECRET_KEY).encode("utf-8"),
            salt,
            iterations,
        )
        
        # Return the components needed to store in the database
        return {
            "API_key": api_key,  # show once to the user; do not store plaintext
            "API_key_prefix": prefix,
            "API_key_salt": base64.b64encode(salt).decode("utf-8"),
            "API_key_hash": base64.b64encode(dk).decode("utf-8"),
            "API_key_iterations": iterations,
        }
        
    @staticmethod
    def create_password(salt_len: int = 16, iterations: int = 200_000, password: str = None) -> dict:
        # Generate a new password and its associated hash/salt
        password = password or secrets.token_urlsafe(12)  # ~72-bit secret, URL-safe
        salt = secrets.token_bytes(salt_len)
        
        # define the hash using PBKDF2-HMAC-SHA256
        dk = hashlib.pbkdf2_hmac(
            "sha256",
            (password + SECRET_KEY).encode("utf-8"),
            salt,
            iterations,
        )
        
        # Return the components needed to store in the database
        return {
            "password": password,  # show once to the user; do not store plaintext
            "password_salt": base64.b64encode(salt).decode("utf-8"),
            "password_hash": base64.b64encode(dk).decode("utf-8"),
            "password_iterations": iterations,
        }

    @staticmethod
    def create_token(username: str) -> str:
        # get user ID
        user = User.read_by_username(username)
        if user is None:
            raise HTTPException(status_code=401, detail="Invalid username")

        payload = {
            "uid": user["id"],
            "issued_at": datetime.now(timezone.utc).timestamp(),
            "session_id": str(uuid.uuid4()),
            "exp": (datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE_MINUTES)).timestamp(),
        }
        token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        return token

    @staticmethod
    def validate_token(token: str) -> dict:
        try:
            # Strip 'Bearer ' prefix if it exists
            if token.startswith("Bearer "):
                token = token.split(" ")[1]
            clean_token = token.strip().strip('"').strip("'")
            payload = jwt.decode(clean_token, SECRET_KEY, algorithms=[ALGORITHM])
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Token validation failed: {str(e)}")

        # Ensure 'exp' exists and is not expired
        exp = payload.get("exp")
        if exp is None:
            raise HTTPException(status_code=401, detail="Token is missing required information")
        now = datetime.now(timezone.utc).timestamp()
        if now > exp:
            raise HTTPException(status_code=401, detail="Token expired")

        # Ensure 'issued_at' exists and is valid (not in the future)
        issued_at = payload.get("issued_at")
        if issued_at is None:
            raise HTTPException(status_code=401, detail="Token is missing required information")
        else:
            if now < issued_at - 5:  # issued_at is in future (Allow a few seconds leeway)
                raise HTTPException(status_code=401, detail="Token has invalid information")

        # Check for session_id  
        if "session_id" not in payload:
            raise HTTPException(status_code=401, detail="Token is missing required information")

        return payload


    @staticmethod
    def refresh_token(payload: dict) -> str:
        payload["exp"] = (datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE_MINUTES)).timestamp()
        payload["issued_at"] = datetime.now(timezone.utc).timestamp()
        payload["session_id"] = str(uuid.uuid4())  # Renew session ID frequently
        return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
