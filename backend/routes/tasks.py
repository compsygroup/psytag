from fastapi import APIRouter, Depends
from datetime import datetime, timezone

from typing import Any, Dict
from lib.models import Project, User, File, Task, Annotation
from lib.task import incomplete_task, adjudication_needing_task, random_task
from lib.auth import Authenticator, verify_token
from lib.project import user_admin_or_manager, validate_questions
from lib.functions import validate_id

router = APIRouter(prefix="/tasks", tags=["tasks"], dependencies=[Depends(verify_token)])

@router.get("/") # read all tasks
def list_tasks(token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    user = User.read(token_payload['uid'])
    if user is None:
        return {"data": None, "error": "Invalid user"}

    # only admins can see all tasks
    if getattr(user, "admin", False):
        tasks = Task.all()
    else:
        tasks = Task.all(query={"user_id": user.id})
    
    if tasks is None:
        return {"data": None, "error": "Unauthorized"}
    
    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": [task for task in tasks], "token": refreshed_token}


@router.get("/project/{pid}") # read all tasks of a specific project
def list_project_tasks(pid: str, token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if the provided project ID is valid
    if not validate_id(pid, Project):
        return {"data": None, "error": "Project not found"}
    
    # check if the user is admin or manager of the project
    if not user_admin_or_manager(pid, token_payload['uid']):
        return {"data": None, "error": "Unauthorized"}

    # get all tasks of the project
    tasks = Task.all(query={"project_id": pid})
    
    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": [task for task in tasks], "token": refreshed_token}


@router.get("/{tid}") # read a specific task
def read_task(tid: str, token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if the provided task ID is valid
    if not validate_id(tid, Task):
        return {"data": None, "error": "Task not found"}
    task = Task.read(tid)

    # check if the user is admin or manager of the project
    if not user_admin_or_manager(task.project_id, token_payload['uid']):
        return {"data": None, "error": "Unauthorized"}

    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": task, "token": refreshed_token}


@router.get("/pick/{pid}") # get the next task of the project for annotation
async def next_task(pid: str, token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if the provided project ID is valid
    if not validate_id(pid, Project):
        return {"data": None, "error": "Project not found"}
    project = Project.read(pid)

    user = User.read(token_payload['uid'])
    if user is None:
        return {"data": None, "error": "Invalid user"}

    # check if user is part of the project or an admin
    if (user.id not in project.users) and (not user_admin_or_manager(pid, user.id)):
        return {"data": None, "error": "Unauthorized"}

    chosen_task = None
    # check if there is incomplete annotation by the user
    # if not, get a task that needs adjudication
    # if not, get a random task
    for finder in (incomplete_task, adjudication_needing_task, random_task):
        chosen_task = finder(pid, user.id)
        if chosen_task is not None:
            break
        
    if chosen_task is None:
        return {"data": None, "error": "No suitable task found"}
    
    # fill instructions and questions from the project
    if chosen_task['instructions'] is None:
        chosen_task['instructions'] = project.instructions
    if chosen_task['questions'] is None:
        chosen_task['questions'] = project.questions
    chosen_task['adjudication_show'] = project.adjudication_show

    # fill file information
    file = File.read(chosen_task['file_id'])
    if file is not None:
        chosen_task['fileId'] = chosen_task['file_id']
        chosen_task['modality'] = file.modality # so that we can use it in the frontend
        chosen_task['data_type'] = file.data_type
    
    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": chosen_task, "token": refreshed_token}


@router.post("/") # create a new task
def create_task(task: Task, token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if required fields are provided
    required_fields = ["project_id", "file_id"]
    for field in required_fields:
        if not getattr(task, field, None):
            return {"data": None, "error": f"{field} is required"}
        
    # check if project_id is valid and corresponds to an existing project
    if not Project.read(task.project_id):
        return {"data": None, "error": f"Project ID {task.project_id} does not exist."}
    
    # check if the user is admin or manager of the project
    if not user_admin_or_manager(task.project_id, token_payload['uid']):
        return {"data": None, "error": "Unauthorized"}
        
    # check if file_id is valid and corresponds to an existing file
    if not File.read(task.file_id):
        return {"data": None, "error": f"File ID {task.file_id} does not exist."}
        
    # check questions format if provided
    if getattr(task, "questions", None):
        error = validate_questions(task.questions)
        if error:
            return {"data": None, "error": error}
        
    # if no questions provided, the project questions must exist
    if not getattr(task, "questions", None):
        project = Project.read(task.project_id)
        if not project or not project.questions:
            error = f"Error: No questions are provided for the task, and the project associated with Project ID {task.project_id} does not have any predefined questions. Please ensure that either the task includes questions or the project has predefined questions."
            return {"data": None, "error": error}
        
    # create the task if all checks pass
    task.date_created = datetime.now().isoformat()
    task.user_id = token_payload['uid']
    task.status = "created"
    task.active = True
    task.create()
    
    if not task.exists(True):
        return {"data": None, "error": "Failed to save task"}

    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": task.id, "token": refreshed_token}


@router.put("/{tid}") # update an existing task
def update_task(tid: str, data: Dict[str, Any], token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if the provided task ID is valid
    if not validate_id(tid, Task):
        return {"data": None, "error": "Task not found"}
    task = Task.read(tid)

    # check if the user is admin or manager of the project
    if not user_admin_or_manager(task.project_id, token_payload['uid']):
        return {"data": None, "error": "Unauthorized"}
    
    # check if project_id is valid and corresponds to an existing project
    if data.get("project_id", None) and not Project.read(data["project_id"]):
        return {"data": None, "error": f"Project ID {data['project_id']} does not exist."}
        
    # check if file_id is valid and corresponds to an existing file
    if data.get("file_id", None) and not File.read(data["file_id"]):
        return {"data": None, "error": f"File ID {data['file_id']} does not exist."}
        
    # check questions format if provided
    if data.get("questions", None):
        error = validate_questions(data["questions"])
        if error:
            return {"data": None, "error": error}
    
    # update fields if all checks pass
    for key, value in data.items():
        setattr(task, key, value)
    task.date_modified = datetime.now(timezone.utc).isoformat()
    task.update()
    
    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": {"status": "success"}, "token": refreshed_token}


@router.put("/reset/{tid}") # reset a task's annotations
def reset_task(tid: str, token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if the provided task ID is valid
    if not validate_id(tid, Task):
        return {"data": None, "error": "Task not found"}
    task = Task.read(tid)

    # check if the user is admin or manager of the project
    if not user_admin_or_manager(task.project_id, token_payload['uid']):
        return {"data": None, "error": "Unauthorized"}
    
    # delete all annotations related to the task
    annotations = Annotation.all(query={"task_id": tid})
    if annotations:
        for ann in annotations:
            #ann is a dict, convert to Annotation object and delete
            ann_obj = Annotation.model_validate(ann)
            ann_obj.delete()
        
    # reset task status to "created" and active to True
    task.status = "created"
    task.active = True
    task.date_modified = datetime.now(timezone.utc).isoformat()
    task.update()
    
    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": {"status": "success"}, "token": refreshed_token}


@router.delete("/{tid}") # delete a specific task
def delete_task(tid: str, token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if the provided task ID is valid
    if not validate_id(tid, Task):
        return {"data": None, "error": "Task not found"}
    task = Task.read(tid)

    # check if the user is admin or manager of the project
    if not user_admin_or_manager(task.project_id, token_payload['uid']):
        return {"data": None, "error": "Unauthorized"}
    
    task.delete()
    
    # delete all annotations of the deleted task, otherwise they will be orphaned
    annotations = Annotation.all(query={"task_id": tid})
    if annotations:
        for ann in annotations:
            #ann is a dict, convert to Annotation object and delete
            ann_obj = Annotation.model_validate(ann)
            ann_obj.delete()
    
    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": {"status": "success"}, "token": refreshed_token}