from typing import Optional, List, Dict, Any
from pydantic import BaseModel

from .database import dbClass

class User(BaseModel, dbClass):
    id: str = None
    username: str = None
    fullname: str = None
    email: str = None
    date_added: str = None
    last_active: Optional[str] = None
    active: bool = False
    admin: bool = False
    manager: bool = False
    
    API_access: Optional[bool] = False
    API_key_created_at: Optional[str] = None
    API_key_last_used_at: Optional[str] = None
    API_key_status: Optional[str] = None  # "inactive", "active", "revoked"
    API_key_prefix: Optional[str] = None
    API_key_salt: Optional[str] = None
    API_key_hash: Optional[str] = None
    API_key_iterations: Optional[int] = None
    
    password_access: Optional[bool] = None
    password_salt: Optional[str] = None
    password_hash: Optional[str] = None
    password_iterations: Optional[int] = None
    password_created_at: Optional[str] = None
    password_last_used_at: Optional[str] = None
    password_status: Optional[str] = None # "temporary", "inactive", "active", "revoked"
    
    _collection: str = 'users'
    _ignore_fields: List[str] = ['date_added',
                                 'last_active',
                                 'active',
                                 'admin',
                                 'API_access',
                                 'API_key_created_at',
                                 'API_key_last_used_at',
                                 'API_key_status',
                                 'API_key_prefix',
                                 'API_key_salt',
                                 'API_key_hash',
                                 'API_key_iterations',
                                 'password_access',
                                 'password_salt',
                                 'password_hash',
                                 'password_iterations',
                                 'password_created_at',
                                 'password_last_used_at',
                                 'password_status']

    @staticmethod
    def read_by_username(username: str) -> Optional[Dict[str, Any]]:
        users = User.all(query={"username": username})
        if len(users) == 0:
            return None
        else:
            return users[0]
    
    
class File(BaseModel, dbClass):
    id: str = None
    parent_id: str = None
    process_id: str = None
    study: str = None
    subject: str = None
    session: int = None
    acquisition: str = None
    task: str = None
    condition: str = None
    run: int = None
    target: str = None
    device: str = None
    channel: str = None
    modality: str = None
    data_type: str = None
    notes: str = None
    date_created: str = None
    date_modified: str = None
    user_id: str = None
    file_path: str = None
    original_file_name: str = None
    sha256sum: str = None
    header: Dict[str, Any] = None
    extra: Dict[str, Any] = None
    waveform: List[float] = None
    
    _collection: str = 'files'
    _ignore_fields: List[str] = ['date_created', 'date_modified', 'user_id', 'extra', 'waveform']


class Project(BaseModel, dbClass):
    id: str = None
    name: str = None
    description: str = None
    date_created: str  = None
    date_modified: str = None
    date_ended: str = None
    active: bool = False
    user_id: str = None # creator of the project
    users: List[str] = None # list of user IDs associated with the project
    managers: List[str] = None # list of user IDs with manager access
    num_annotators: int = 2
    adjudication_rule: Dict[str, Any] = None # name of the callable function, variables, and parameters, etc
    adjudication_show: bool = True # whether to show the earlier annotations to be adjudicated to adjudicators
    instructions: str = None
    questions: List[Dict[str, Any]] = None
    
    _collection: str = 'projects'
    _ignore_fields: List[str] = ['date_created', 'date_modified', 'date_ended']
    
    
class Task(BaseModel, dbClass):
    id: str = None
    project_id: str = None
    file_id: str = None
    date_created: str = None
    date_modified: str = None
    user_id: str = None
    status: str = "created" # "created", "in progress", "adjudicating", "completed", "removed"
    active: bool = True
    instructions: str = None # normally, it is the same as project instructions, but user can override it (e.g. if we want certain videos to have different instructions)
    questions: List[Dict[str, Any]] = None # normally, it is the same as project questions, but user can override it (e.g. if we want certain videos to have different questions)
    
    _collection: str = 'tasks'
    _ignore_fields: List[str] = ['date_created', 'date_modified', 'user_id']
    
    
class Annotation(BaseModel, dbClass):
    id: str = None
    incomplete: bool = False
    adjudication: bool = False
    gold: bool = False
    time: str = None
    user_id: str = None
    project_id: str = None
    task_id: str = None
    content: Optional[Dict[str, Any]] = None 
    
    _collection: str = 'annotations'
    _ignore_fields: List[str] = ['time']