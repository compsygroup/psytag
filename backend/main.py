from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any
import json, os
from datetime import datetime

from routes.projects import router as projects_router
from routes.tasks import router as tasks_router
from routes.annotations import router as annotations_router
from routes.files import router as files_router
from routes.users import router as users_router

from lib.models import User
from lib.auth import Authenticator, readAuthConfig

app = FastAPI()
# routers
app.include_router(projects_router)
app.include_router(tasks_router)
app.include_router(annotations_router)
app.include_router(files_router)
app.include_router(users_router)

# Allow all origins (for development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change this to specific origins in production
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allow all headers
)

# read auth config if exists
if os.path.isfile("config/auth.json"):
    readAuthConfig()
    

@app.get("/")
def read_root():
    return {"Psytag"}


@app.get("/is_first_time")
async def is_first_time():
    # Check if the files config/auth.json and config/database.json exist and have required fields
    is_first_time = False
    
    if (not os.path.isfile("config/db.json")) or (not os.path.isfile("config/auth.json")):
        is_first_time = True
    else:
        try:
            with open("config/auth.json", "r") as f:
                config = json.load(f)
                missing1 = not all(key in config for key in ["secret_key", "algorithm", "authentication", "token_expire_minutes"])
            with open("config/db.json", "r") as f:
                config = json.load(f)
                missing2 = not all(key in config for key in ["db_uri", "db_name"])
            if missing1 or missing2:
                is_first_time = True
        except FileNotFoundError:
            is_first_time = True

    return {"data": is_first_time}


@app.post("/setup")
async def setup(data: Dict[str, Any]):
    # first make sure setup is needed
    response = await is_first_time()
    if not response.get("data", False):
        return {"data": False, "error": "Setup is not required."}
    
    # check required fields
    if ("username" not in data) or ("fullname" not in data) or ("email" not in data) or ("db_uri" not in data) or ("db_name" not in data) or ("login_type" not in data):
        return {"data": False, "error": "Required fields are missing."}

    if (data["login_type"] == "local") and ("password" not in data):
        return {"data": False, "error": "Password missing for the local admin account."}
    
    if (data["login_type"] == "ldap") and ("ldap_server" not in data):
        return {"data": False, "error": "LDAP server missing for LDAP authentication."}
    
    login_type = data["login_type"]
    if login_type not in ["local", "ldap"]:
        return {"data": False, "error": "Invalid login type. Must be 'local' or 'ldap'."}

    # create config/auth.json
    secret_key = os.urandom(24).hex()
    algorithm = "HS256"
    config_auth = {
        "secret_key": secret_key,
        "algorithm": algorithm,
        "authentication": login_type,
        "token_expire_minutes": 60
    }
    if login_type == "ldap":
        config_auth["ldap_server"] = data.get("ldap_server", None)
        config_auth["ldap_domain"] = data.get("ldap_domain", None)
        config_auth["ldap_base"] = data.get("ldap_base", None)
    
    try:
        with open("config/auth.json", "w") as f:
            json.dump(config_auth, f, indent=4)
        
        readAuthConfig()
    except Exception as e:
        return {"data": False, "error": str(e)}
    
    # create config/db.json
    config_db = {
        "db_uri": data.get("db_uri"),
        "db_name": data.get("db_name")
    }
    try:
        with open("config/db.json", "w") as f:
            json.dump(config_db, f, indent=4)
    except Exception as e:
        return {"data": False, "error": str(e)}
    
    # create config/upload.json
    if data.get("upload_max", None):
        max_bytes = data.get("upload_max", 1024*1024*1024)
        config_upload = {
            "dir": "uploads", #data.get("upload_dir"),
            "max_bytes": max_bytes
        }
        try:
            with open("config/upload.json", "w") as f:
                json.dump(config_upload, f, indent=4)
        except Exception as e:
            return {"data": False, "error": str(e)}

    # create the admin user
    admin = {"username": data.get("username"),
             "fullname": data.get("fullname"),
             "email": data.get("email"),
             "admin": True,
             "date_added": datetime.now().isoformat(),
             "active": True
         }
    admin = User(**admin)
    
    # create an API key for the admin
    admin.API_access = True
    admin.API_key_created_at = datetime.now().isoformat()
    admin.API_key_status = "active"
    key_details = Authenticator.create_api_key()
    API_key = key_details["API_key"]
    admin.API_key_prefix = key_details["API_key_prefix"]
    admin.API_key_salt = key_details["API_key_salt"]
    admin.API_key_hash = key_details["API_key_hash"]
    admin.API_key_iterations = key_details["API_key_iterations"]
    
    # set password if local authentication
    if login_type == "local":
        admin.password_access = True
        admin.password_created_at = datetime.now().isoformat()
        admin.password_status = "active"
        password_details = Authenticator.create_password(password=data.get("password"))
        admin.password_salt = password_details["password_salt"]
        admin.password_hash = password_details["password_hash"]
        admin.password_iterations = password_details["password_iterations"]
    
    admin.create()

    if not admin.exists(True):
        return {"data": False, "error": "Failed to save admin user to database."}

    return {"data": {"status": "success", "API_key": API_key}}


@app.post("/login")
async def login(data: Dict[str, Any]):   
    username = data.get("username")
    password = data.get("password")
    
    # check if user exists
    user = User.read_by_username(username)
    if user is None:
        return {"data": False, "error": "Invalid username or password"}
    
    if Authenticator.authenticate(username, password):
        token = Authenticator.create_token(username)
        
        # check if password is temporary
        if user.get("password_status", None) == "temporary":
            return {"data": "temporary", "token": token}
        else:
            return {"data": True, "token": token}

    return {"data": False, "error": "Invalid username or password"}


@app.post("/login.api")
async def login_api(data: Dict[str, Any]):
    username = Authenticator.authenticate_api_key(data.get("api_key"))
    token = Authenticator.create_token(username)
    return {"token": token}