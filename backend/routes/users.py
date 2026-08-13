from fastapi import APIRouter, Depends
from datetime import datetime
from typing import Any, Dict, Union

from lib.functions import validate_id
from lib.models import User, Project
from lib.auth import Authenticator, verify_token

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(verify_token)])


def secureUser(user: Union[User,Dict[str, Any]]) -> Dict[str, Any]:
    originalType = "dict" if isinstance(user, dict) else "user"

    # convert to dict (model dump)
    if originalType == "user":
        user = user.model_dump()
    
    # Remove sensitive information from the response
    user.pop("date_added", None)
    user.pop("last_active", None)
    user.pop("API_key_prefix", None)
    user.pop("API_key_salt", None)
    user.pop("API_key_hash", None)
    user.pop("API_key_iterations", None)
    user.pop("API_key_created_at", None)
    user.pop("API_key_last_used_at", None)
    user.pop("password_salt", None)
    user.pop("password_hash", None)
    user.pop("password_iterations", None)
    user.pop("password_created_at", None)
    user.pop("password_last_used_at", None)
    
    # convert back to original type
    if originalType == "user":
        user = User(**user)

    return user


@router.get("/my.info")
def user_info(token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    user = User.read(token_payload['uid'])

    if user is None:
        return {"error": "User not found"}

    # convert to dict (model dump)
    user = user.model_dump()
    # Remove sensitive information from the response
    user.pop("date_added", None)
    user.pop("last_active", None)
    user.pop("API_key_prefix", None)
    user.pop("API_key_salt", None)
    user.pop("API_key_hash", None)
    user.pop("API_key_iterations", None)
    user.pop("API_key_created_at", None)
    user.pop("API_key_last_used_at", None)
    user.pop("password_salt", None)
    user.pop("password_hash", None)
    user.pop("password_iterations", None)
    user.pop("password_created_at", None)
    user.pop("password_last_used_at", None)

    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": user, "token": refreshed_token}


@router.post("/change_password")
def change_password(data: Dict[str, Any], token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    user = User.read(token_payload['uid'])

    if user is None:
        return {"data": False, "error": "User not found"}
    
    if "old_password" not in data:
        return {"data": False, "error": "Old password is required"}
    
    if "new_password" not in data:
        return {"data": False, "error": "New password is required"}
    
    old_password = data["old_password"]
    new_password = data["new_password"]
    
    # attemp to login with old password
    if not Authenticator.authenticate(user.username, old_password):
        return {"data": False, "error": "Old password is incorrect"}

    # update password
    password_details = Authenticator.create_password(password=new_password)
    user.password_salt = password_details["password_salt"]
    user.password_hash = password_details["password_hash"]
    user.password_iterations = password_details["password_iterations"]
    user.password_status = "active"
    user.password_last_used_at = datetime.now().isoformat()
    user.update()

    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": True, "token": refreshed_token}


@router.get("/") # list all users
def list_users(token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if user is admin/manager
    requesting_user = User.read(token_payload['uid'])
    if (requesting_user is None) or ((not getattr(requesting_user, "admin", False)) and (not getattr(requesting_user, "manager", False))):
        return {"data": None, "error": "Unauthorized"}
    
    users = User.all()
    
    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": [secureUser(user) for user in users], "token": refreshed_token}


@router.get("/{uid}")  # read a specific user by ID
def read_user(uid: str, token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if the provided user ID is valid
    if not validate_id(uid, User):
        return {"data": None, "error": "User not found"}
    user = User.read(uid)
    
    # check if user is admin
    requesting_user = User.read(token_payload['uid'])
    if (requesting_user is None) or ((not getattr(requesting_user, "admin", False)) and (not getattr(requesting_user, "manager", False))):
        return {"data": None, "error": "Unauthorized"}

    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": user, "token": refreshed_token}


@router.post("/") # create a new user
def create_user(user: User, token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if user is admin
    requesting_user = User.read(token_payload['uid'])
    if (requesting_user is None) or ((not getattr(requesting_user, "admin", False)) and (not getattr(requesting_user, "manager", False))):
        return {"data": None, "error": "Unauthorized"}
    
    # check if required fields are provided
    required_fields = ["username", "fullname", "email"]
    for field in required_fields:
        if not getattr(user, field, None):
            return {"data": None, "error": f"{field} is required"}
        
    # make sure username is unique
    if User.read_by_username(user.username) is not None:
        return {"data": None, "error": "Username already exists"}

    user.date_added = datetime.now().isoformat()
    user.active = True

    if getattr(user, "API_access", False):
        user.API_access = True
        user.API_key_created_at = datetime.now().isoformat()
        user.API_key_status = "active"
        key_details = Authenticator.create_api_key()
        user.API_key_prefix = key_details["API_key_prefix"]
        user.API_key_salt = key_details["API_key_salt"]
        user.API_key_hash = key_details["API_key_hash"]
        user.API_key_iterations = key_details["API_key_iterations"]

    if getattr(user, "password_access", False):
        user.password_access = True
        user.password_created_at = datetime.now().isoformat()
        user.password_status = "temporary"
        password_details = Authenticator.create_password()
        user.password_salt = password_details["password_salt"]
        user.password_hash = password_details["password_hash"]
        user.password_iterations = password_details["password_iterations"]
        
    # if requesting user is not admin, make sure new user is not admin or manager
    # this is to prevent non-admin users from creating admin or manager accounts
    if not getattr(requesting_user, "admin", False):
        user.admin = False
        user.manager = False

    user.create()

    if not user.exists(True):
        return {"data": None, "error": "Failed to save. User may already exist."}

    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    # if API key was created, return it in response
    if getattr(user, "API_access", False) or getattr(user, "password_access", False):
        data = {"id": user.id}
        if getattr(user, "API_access", False):
            data["API_key"] = key_details["API_key"]
        if getattr(user, "password_access", False):
            data["password"] = password_details["password"]
        return {"data": data, "token": refreshed_token}
    else:
        return {"data": user.id, "token": refreshed_token}


@router.put("/{uid}") # update an existing user
def update_user(uid: str, data: Dict[str, Any], token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if the provided user ID is valid
    if not validate_id(uid, User):
        return {"data": None, "error": "User not found"}
    user = User.read(uid)
    
    # check if user is admin
    requesting_user = User.read(token_payload['uid'])
    if (requesting_user is None) or ((not getattr(requesting_user, "admin", False)) and (not getattr(requesting_user, "manager", False))):
        return {"data": None, "error": "Unauthorized"}

    # update fields
    for field in ["fullname", "email", "active", "admin", "manager"]:
        if field in data:
            setattr(user, field, data[field])
    
    new_API = False
    if "API_access" in data:
        if data.get("API_access", False) and not user.API_access:
            # enable API access
            new_API = True
            user.API_access = True
            user.API_key_created_at = datetime.now().isoformat()
            user.API_key_status = "active"
            key_details = Authenticator.create_api_key()
            user.API_key_prefix = key_details["API_key_prefix"]
            user.API_key_salt = key_details["API_key_salt"]
            user.API_key_hash = key_details["API_key_hash"]
            user.API_key_iterations = key_details["API_key_iterations"]
        elif not data.get("API_access", False):
            # disable API access
            user.API_access = False
            user.API_key_status = "inactive"
            
    new_password = False
    if "password_access" in data:
        if data.get("password_access", False) and not user.password_access:
            # enable password access
            new_password = True
            user.password_access = True
            user.password_created_at = datetime.now().isoformat()
            user.password_status = "temporary"
            password_details = Authenticator.create_password()
            user.password_salt = password_details["password_salt"]
            user.password_hash = password_details["password_hash"]
            user.password_iterations = password_details["password_iterations"]
        elif not data.get("password_access", False):
            # disable password access
            user.password_access = False
            user.password_status = "inactive"
            
    # if requesting user is not admin, make sure new user is not admin or manager
    # this is to prevent non-admin users from creating admin or manager accounts
    if not getattr(requesting_user, "admin", False):
        user.admin = False
        user.manager = False

    user.update()

    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    # if new API key or password was created, return it in response
    if new_API or new_password:
        data = {"status": "success"}
        if new_API:
            data["API_key"] = key_details["API_key"]
        if new_password:
            data["password"] = password_details["password"]
        return {"data": data, "token": refreshed_token}
    else:
        return {"data": {"status": "success"}, "token": refreshed_token}


@router.delete("/{uid}") # delete a user
def delete_user(uid: str, token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if the provided user ID is valid
    if not validate_id(uid, User):
        return {"data": None, "error": "User not found"}
    user = User.read(uid)
    
    # check if user is admin
    requesting_user = User.read(token_payload['uid'])
    if (requesting_user is None) or ((not getattr(requesting_user, "admin", False)) and (not getattr(requesting_user, "manager", False))):
        return {"data": None, "error": "Unauthorized"}

    user.delete()
    
    # remove user from any projects they are part of or managing
    projects = Project.all(query={"users": user.id})
    for p in projects:
        proj = Project.read(p['id'])
        proj.users = [uid for uid in (proj.users or []) if uid != user.id]
        proj.update()
    projects = Project.all(query={"managers": user.id})
    for p in projects:
        proj = Project.read(p['id'])
        proj.managers = [uid for uid in (proj.managers or []) if uid != user.id]
        proj.update()

    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": {"status": "success"}, "token": refreshed_token}