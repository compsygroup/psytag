from typing import Optional, Dict, Any, List, Union

from ..models import BaseManager, User
from ..backend import fetch_response

class UserManager(BaseManager):
    resource = "users"

    @staticmethod
    def my_info() -> Dict[str, Any]:
        return fetch_response("users/my.info", "GET")

    @staticmethod
    def list() -> List[User]:
        response = BaseManager._get(f"{UserManager.resource}")
        return [User(**item) for item in response] if isinstance(response, list) else []

    @staticmethod
    def read(uid: str) -> Optional[User]:
        response = BaseManager._get(f"{UserManager.resource}/{uid}")
        return User(**response) if response else None

    @staticmethod
    def create(fields: Union[Dict[str, Any], User]) -> Optional[User]:
        # convert User object to dict if necessary
        if isinstance(fields, User):
            fields = fields.model_dump(exclude_unset=True)

        response = BaseManager._post(f"{UserManager.resource}", fields)
        if isinstance(response, str):
            print(f"User created with ID: {response}")
            new_user = UserManager.read(response)
            return new_user
        elif isinstance(response, dict):
            print(f"User created with ID: {response['id']}")
            
            if "API_key" in response:
                print(f"API key created for user: {response['API_key']}")
                print("Please store this API key securely; it will not be shown again.")

            if "password" in response:
                print(f"Password created for user: {response['password']}")
                print("Please store this password securely; it will not be shown again.")

            new_user = UserManager.read(response["id"])
            return new_user
        return None

    @staticmethod
    def update(uid: str, fields: Union[Dict[str, Any], User]):
        # convert User object to dict if necessary
        if isinstance(fields, User):
            fields = fields.model_dump(exclude_unset=True)

        response = BaseManager._put(f"{UserManager.resource}/{uid}", fields)
        if response:
            print(f"User {uid} updated successfully.")
            if "API_key" in response:
                print(f"API key created for user: {response['API_key']}")
                print("Please store this API key securely; it will not be shown again.")
        else:
            print(f"Failed to update user {uid}: {response}")

    @staticmethod
    def delete(uid: str):
        response = BaseManager._delete(f"{UserManager.resource}/{uid}")
        if response:
            print(f"User {uid} deleted successfully.")
        else:
            print(f"Failed to delete user {uid}: {response}")
            
# Functions for ergonomic purposes
def get_my_info() -> Dict[str, Any]:
    return UserManager.my_info()

def list_users() -> List[User]:
    return UserManager.list()

def read_user(uid: str) -> Optional[User]:
    return UserManager.read(uid)

def create_user(fields: Union[Dict[str, Any], User]) -> Optional[User]:
    return UserManager.create(fields)

def update_user(uid: str, fields: Union[Dict[str, Any], User]):
    UserManager.update(uid, fields)

def delete_user(uid: str):
    UserManager.delete(uid)