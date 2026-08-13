# client/lib/models.py
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel
from bson import ObjectId

from .backend import fetch_response

class User(BaseModel):
    id: Optional[str] = None
    username: Optional[str] = None
    fullname: Optional[str] = None
    email: Optional[str] = None
    date_added: Optional[str] = None
    last_active: Optional[str] = None
    active: Optional[bool] = None
    admin: Optional[bool] = None
    manager: Optional[bool] = False

    # Optional API-key related metadata your backend may store
    API_access: Optional[bool] = None
    API_key_prefix: Optional[str] = None
    API_key_salt: Optional[str] = None
    API_key_hash: Optional[str] = None
    API_key_iterations: Optional[int] = None
    API_key_created_at: Optional[str] = None
    API_key_last_used_at: Optional[str] = None
    API_key_status: Optional[str] = None # "inactive", "active", "revoked"

    # Optional password related metadata your backend may store
    password_access: Optional[bool] = None
    password_salt: Optional[str] = None
    password_hash: Optional[str] = None
    password_iterations: Optional[int] = None
    password_created_at: Optional[str] = None
    password_last_used_at: Optional[str] = None
    password_status: Optional[str] = None # "temporary", "inactive", "active", "revoked"

class File(BaseModel):
    id: Optional[str] = None
    parent_id: Optional[str] = None
    process_id: Optional[str] = None
    study: Optional[str] = None
    subject: Optional[str] = None
    session: Optional[int] = None
    acquisition: Optional[str] = None
    task: Optional[str] = None
    condition: Optional[str] = None
    run: Optional[int] = None
    target: Optional[str] = None
    device: Optional[str] = None
    channel: Optional[str] = None
    modality: Optional[str] = None
    data_type: Optional[str] = None
    notes: Optional[str] = None
    date_created: Optional[str] = None
    date_modified: Optional[str] = None
    user_id: Optional[str] = None
    file_path: Optional[str] = None
    original_file_name: Optional[str] = None
    sha256sum: Optional[str] = None
    header: Optional[Dict[str, Any]] = None
    extra: Optional[Dict[str, Any]] = None
    waveform: Optional[List[float]] = None

class Project(BaseModel):
    id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    date_created: Optional[str] = None
    date_ended: Optional[str] = None
    active: Optional[bool] = None
    user_id: Optional[str] = None # creator of the project
    users: Optional[List[str]] = None # list of user IDs associated with the project
    managers: Optional[List[str]] = None # list of user IDs with manager access
    num_annotators: Optional[int] = None
    adjudication_rule: Optional[Dict[str, Any]] = None # name of the callable function, variables, and parameters, etc
    adjudication_show: Optional[bool] = None # whether to show the earlier annotations to be adjudicated to adjudicators
    instructions: Optional[str] = None
    questions: Optional[List[Dict[str, Any]]] = None

class Task(BaseModel):
    id: Optional[str] = None
    project_id: Optional[str] = None
    file_id: Optional[str] = None
    date_created: Optional[str] = None
    date_modified: Optional[str] = None
    user_id: Optional[str] = None
    status: Optional[str] = None   # "created", "in progress", "adjudicating", "completed", "removed"
    active: Optional[bool] = None
    instructions: Optional[str] = None # normally, it is the same as project instructions, but user can override it (e.g. if we want certain videos to have different instructions)
    questions: Optional[List[Dict[str, Any]]] = None # normally, it is the same as project questions, but user can override it (e.g. if we want certain videos to have different questions)

class Annotation(BaseModel):
    id: Optional[str] = None
    incomplete: Optional[bool] = None
    adjudication: Optional[bool] = None
    gold: Optional[bool] = None
    time: Optional[str] = None
    user_id: Optional[str] = None
    project_id: Optional[str] = None
    task_id: Optional[str] = None
    content: Optional[Dict[str, Any]] = None
    

# BaseManager class to be inherited by specific resource managers
class BaseManager():
    @staticmethod
    def _get(route: str) -> Union[List[Dict[str, Any]], Dict[str, Any]]:
        response = fetch_response(route, "GET")
        return response if isinstance(response, (list, dict)) else {}

    @staticmethod
    def _post(route: str, fields: Dict[str, Any], file_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
        # get the response and return it
        response = fetch_response(route, "POST", fields, file_path=file_path)
        if (isinstance(response, str) and ObjectId.is_valid(response)) or \
           (isinstance(response, dict) and ("id" in response) and ObjectId.is_valid(response["id"])):
            return response
        else:
            print("Error creating resource:", response)
        return None

    @staticmethod
    def _put(route: str, fields: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        if fields is None:
            response = fetch_response(route, "PUT")
        else:
            response = fetch_response(route, "PUT", fields)
        if response and "status" in response and response["status"] == "success":
            return response
        else:
            return None

    @staticmethod
    def _delete(route: str) -> bool:
        response = fetch_response(route, "DELETE")
        if response and "status" in response and response["status"] == "success":
            return True
        else:
            return False