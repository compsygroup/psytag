from fastapi import APIRouter, Depends
from typing import Any, Dict, List
from datetime import datetime, timezone

from lib.auth import Authenticator, verify_token
from lib.models import Project, User
from lib.project import user_admin_or_manager, properIDs
from lib.project import validate_users, validate_questions
from lib.project import validate_adjudication_rule
from lib.functions import validate_id

router = APIRouter(prefix="/projects", tags=["projects"], dependencies=[Depends(verify_token)])

@router.get("/{pid}/is_manager") # check if a user is manager of a project
def is_manager(pid: str, token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if the provided project ID is valid
    if not validate_id(pid, Project):
        return {"data": None, "error": "Project not found"}
    
    project = Project.read(pid)
    user_id = token_payload['uid']
    
    is_manager = user_id in getattr(project, "managers", [])
    
    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)
    
    return {"data": is_manager, "token": refreshed_token}


@router.get("/") # read all projects for the user
def list_projects(token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # get all projects for the user
    user = User.read(token_payload['uid'])
    if user is None:
        return {"data": None, "error": "Invalid user"}
    
    # if user is admin, return all projects
    if getattr(user, "admin", False):
        projects = Project.all()
    else:
        # otherwise, return projects where the user is either a regular user or a manager
        projects = Project.all(query={"$or": [{"users": user.id}, {"managers": user.id}]})
    
    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)
    
    return {"data": [project for project in projects], "token": refreshed_token}


@router.get("/{pid}") # read a specific project
def project_read(pid: str, token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if the provided project ID is valid
    if not validate_id(pid, Project):
        return {"data": None, "error": "Project not found"}
    project = Project.read(pid)
    
    # check if the user is admin or manager of the project
    if not user_admin_or_manager(pid, token_payload['uid']):
        return {"data": None, "error": "Unauthorized"}

    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": project, "token": refreshed_token}


@router.post("/") # create a new project
def project_create(project: Project, token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if the user is admin
    current_user = User.read(token_payload['uid'])
    if (current_user is None) or ((not getattr(current_user, "admin", False)) and (not getattr(current_user, "manager", False))):
        return {"data": None, "error": "Unauthorized"}
    
    # check if required fields are provided
    required_fields = ["name", "description"]
    for field in required_fields:
        if not getattr(project, field, None):
            return {"data": None, "error": f"{field} is required"}
   
    # user list can be provided as usernames or IDs, make sure they are IDs
    # user IDs associated with the project
    users: List[str] = project.users or []
    if users and len(users) > 0:
        users = properIDs(users)
    
    # managers of the project
    managers: List[str] = project.managers or []
    if managers and len(managers) > 0:
        managers = properIDs(managers)
    # add the current user as a manager
    managers.append(current_user.id)
        
    # check users and managers format if provided
    if users or managers:
        error = validate_users(users + managers)
        if error:
            return {"data": None, "error": error}
        
    # check questions format if provided
    if getattr(project, "questions", None):
        error = validate_questions(project.questions)
        if error:
            return {"data": None, "error": error}

    # check adjudication_rule format if provided
    if getattr(project, "adjudication_rule", None) and getattr(project, "questions", None):
        question_vars = [q.get("variable") for q in getattr(project, "questions", [])]
        error = validate_adjudication_rule(project.adjudication_rule, question_vars)
        if error:
            return {"data": None, "error": error}
        
    # create the project if all checks passed
    project.date_created = datetime.now().isoformat()
    project.users = users
    project.managers = managers
    project.user_id = current_user.id
    project.create()

    if not project.exists(True):
        return {"data": None, "error": "Failed to save project"}

    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": project.id, "token": refreshed_token}


@router.put("/{pid}") # update an existing project
def project_update(pid: str, data: Dict[str, Any],
                   token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if the provided project ID is valid
    if not validate_id(pid, Project):
        return {"data": None, "error": "Project not found"}
    project = Project.read(pid)
    
    # check if the user is admin or manager of the project
    if not user_admin_or_manager(pid, token_payload['uid']):
        return {"data": None, "error": "Unauthorized"}
   
   # user IDs associated with the project
    users: List[str] = data.get("users", None) or None
    if users and len(users) > 0:
        users = properIDs(users)
    
    # managers of the project
    managers: List[str] = data.get("managers", None) or None
    if managers and len(managers) > 0:
        managers = properIDs(managers)
        
    # check users and managers format if provided
    if users or managers:
        error = validate_users(users + managers)
        if error:
            return {"data": None, "error": error}
        
    # check questions format if provided
    if data.get("questions", None):
        error = validate_questions(data["questions"])
        if error:
            return {"data": None, "error": error}
        
    # check adjudication_rule format if provided
    if data.get("adjudication_rule", None):
        question_vars = [q.get("variable") for q in getattr(project, "questions", [])]
        error = validate_adjudication_rule(data["adjudication_rule"], question_vars)
        if error:
            return {"data": None, "error": error}
        
    # update the project if all checks passed
    # for each key in data, except users and managers, check if it exists in Project class and if so, update the project
    for key, value in data.items():
        if (key not in ["users", "managers", "id"]) and hasattr(project, key):
            setattr(project, key, value)
    if users is not None:
        project.users = users
    if managers is not None:
        project.managers = managers
    project.date_modified = datetime.now(timezone.utc).isoformat()
    project.update()

    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": {"status": "success"}, "token": refreshed_token}


@router.delete("/{pid}") # delete a project
def project_delete(pid: str, token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if the provided project ID is valid
    if not validate_id(pid, Project):
        return {"data": None, "error": "Project not found"}
    project = Project.read(pid)

    # check if the user is admin or manager of the project
    if not user_admin_or_manager(pid, token_payload['uid']):
        return {"data": None, "error": "Unauthorized"}
    
    project.delete()
    
    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": {"status": "success"}, "token": refreshed_token}


@router.post("/{pid}/toggle") # toggle project activation
def project_toggle(pid: str, token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if the provided project ID is valid
    if not validate_id(pid, Project):
        return {"data": None, "error": "Project not found"}
    project = Project.read(pid)

    # check if the user is admin or manager of the project
    if not user_admin_or_manager(pid, token_payload['uid']):
        return {"data": None, "error": "Unauthorized"}

    project.active = not getattr(project, "active", True)
    project.update()
    
    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": {"status": "success"}, "token": refreshed_token}


@router.put("/{pid}/users") # assign/remove a user/manager
def project_users_update(pid: str, data: Dict[str, Any],
                         token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if the provided project ID is valid
    if not validate_id(pid, Project):
        return {"data": None, "error": "Project not found"}
    project = Project.read(pid)

    # check if the user is admin or manager of the project
    if not user_admin_or_manager(pid, token_payload['uid']):
        return {"data": None, "error": "Unauthorized"}
    
    # get user_id from the request data
    user_id = data.get("user_id", None)
    if not user_id:
        return {"data": None, "error": "user_id is required"}
    
    # action can be either "add" or "remove"
    action = data.get("action", None)
    if action not in ["add", "remove"]:
        return {"data": None, "error": "action must be either 'add' or 'remove'"}
    
    # user or manager
    manager = data.get("manager", False)
    
    # validate if the user exists
    if not validate_id(user_id, User):
        return {"data": None, "error": "User not found"}

    if action == "add":
        # add user/manager to project
        if manager:
            project.managers.append(user_id)
        else:
            project.users.append(user_id)
    else:
        # remove user/manager from project
        if manager:
            project.managers.remove(user_id)
        else:
            project.users.remove(user_id)

    project.update()

    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": {"status": "success"}, "token": refreshed_token}