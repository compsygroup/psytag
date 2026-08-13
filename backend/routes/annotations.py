from fastapi import APIRouter, Depends
from datetime import datetime, timezone
from typing import Any, Dict

from lib.functions import validate_id
from lib.models import File, User, Project, Annotation, Task
from lib.auth import Authenticator, verify_token
from lib.project import user_admin_or_manager
from lib.annotation import task_adjudication_status, validate_content

router = APIRouter(prefix="/annotations", tags=["annotations"], dependencies=[Depends(verify_token)])

# we will make annotations more human readble by substituting IDs with names and adding file details, and also reordering the keys
def _format_annotations(annotations):
    formatted_annotations = []
    # add extra fields to the annotations for better readability
    for annotation in annotations:
        # get project name and delete project_id from the annotation
        project = Project.read(annotation['project_id'])
        if project is not None:
            annotation['project_name'] = project.name
            del annotation['project_id']
        # get user name and delete user_id from the annotation
        user = User.read(annotation['user_id'])
        if user is not None:
            annotation['user_name'] = user.username
            del annotation['user_id']
        # file details are already included in the task, so we will get them from the task and delete task_id from the annotation
        task = Task.read(annotation['task_id'])
        if task is not None:
            file_id = task.file_id
            file_details = File.read(file_id)
            if file_details is not None:
                # add all file fields to the annotation, if they are not None, except for the ignored fields
                # individual keys in field "extra" will be added to the annotation separately
                ignore_fields = ['date_created', 'date_modified', 'user_id', 'id', '_collection',
                                 '_ignore_fields', 'parent_id', 'process_id', 'sha256sum', 'header', 'extra', 'waveform']
                for key, value in file_details.__dict__.items():
                    if key not in ignore_fields and value is not None:
                        field_name = f"sds_{key}"  # prefix with "sds_"
                        annotation[field_name] = value
                # add extra fields to the annotation
                if file_details.extra is not None:
                    for key, value in file_details.extra.items():
                        if value is not None:
                            field_name = f"extra_{key}"  # prefix with "extra_"
                            annotation[field_name] = value
            del annotation['task_id']

        # reorder the keys in the annotation dictionary in the following order:
        # id, project_name, sds_*, extra_*, user_name, time, incomplete, adjudication, gold, content
        ordered_annotation = {}
        ordered_keys = ['id', 'project_name'] + \
                       [key for key in annotation.keys() if key.startswith('sds_')] + \
                       [key for key in annotation.keys() if key.startswith('extra_')] + \
                       ['user_name', 'time', 'incomplete', 'adjudication', 'gold', 'content']
        for key in ordered_keys:
            if key in annotation:
                ordered_annotation[key] = annotation[key]
        formatted_annotations.append(ordered_annotation)
    
    return formatted_annotations


@router.get("/") # read all annotations
def list_annotations(token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    user = User.read(token_payload['uid'])
    if user is None:
        return {"data": None, "error": "Invalid user"}

    # only admins can see all annotations
    if getattr(user, "admin", False):
        annotations = Annotation.all()
        formatted_annotations = _format_annotations(annotations)
    else:
        return {"data": None, "error": "Unauthorized"}
    
    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": formatted_annotations, "token": refreshed_token}


@router.get("/project/{pid}")  # read all annotations of a project
def list_project_annotations(pid: str, token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if the provided project ID is valid
    if not validate_id(pid, Project):
        return {"data": None, "error": "Project not found"}

    # check if the user is admin or manager of the project
    if not user_admin_or_manager(pid, token_payload['uid']):
        return {"data": None, "error": "Unauthorized"}

    # get all annotations of the project
    annotations = Annotation.all(query={"project_id": pid})
    formatted_annotations = _format_annotations(annotations)

    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": formatted_annotations, "token": refreshed_token}


@router.get("/task/{tid}")  # read all annotations of a task
def list_task_annotations(tid: str, token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if the provided task ID is valid
    if not validate_id(tid, Task):
        return {"data": None, "error": "Task not found"}

    # check if the user is admin or manager of the project
    task = Task.read(tid)
    if task is None or not user_admin_or_manager(task.project_id, token_payload['uid']):
        return {"data": None, "error": "Unauthorized"}

    # get all annotations of the task
    annotations = Annotation.all(query={"task_id": tid})
    formatted_annotations = _format_annotations(annotations)
    
    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": formatted_annotations, "token": refreshed_token}


@router.get("/{aid}")  # read a specific annotation by ID
def read_annotation(aid: str, token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if the provided annotation ID is valid
    if not validate_id(aid, Annotation):
        return {"data": None, "error": "Annotation not found"}
    annotation = Annotation.read(aid)
    formatted_annotation = _format_annotations([annotation.model_dump()])[0] if annotation else {}

    # check if user is admin
    user = User.read(token_payload['uid'])
    if user is None or not user_admin_or_manager(annotation.project_id, token_payload['uid']):
        return {"data": None, "error": "Unauthorized"}

    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": formatted_annotation, "token": refreshed_token}


@router.post("/") # create (or update) an annotation
async def save_annotation(data: Annotation, token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if required fields are provided
    required_fields = ["project_id", "task_id"]
    for field in required_fields:
        if not getattr(data, field, None):
            return {"data": None, "error": f"{field} is required"}
        
    # check if project_id is valid and corresponds to an existing project
    if not Project.read(data.project_id):
        return {"data": None, "error": f"Project ID {data.project_id} does not exist."}

    # check if task_id is valid and corresponds to an existing task
    if not Task.read(data.task_id):
        return {"data": None, "error": f"Task ID {data.task_id} does not exist."}

    # check content format if provided
    if getattr(data, "content", None):
        error = validate_content(data.project_id, data.task_id, data.content)
        if error:
            return {"data": None, "error": error}
        
    # if there are missing variables in content, set them to None
    project = Project.read(data.project_id)
    task = Task.read(data.task_id)
    questions = task.questions if (task and task.questions is not None) else project.questions
    for q in questions:
        if q['variable'] not in data.content:
            data.content[q['variable']] = None
    
    # add user_id to the annotation
    data.user_id = token_payload['uid']

    # check if there is an existing annotation
    data._ignore_fields = ['time', 'incomplete', 'adjudication', 'content']
    existing_id = data.exists()
    if existing_id: # update the existing annotation
        data.id = existing_id
        data.update()
    else: # create a new annotation
        data.create()
        
    # update the task status
    task = Task.read(data.task_id)
    if task is not None:
        # check if this is an adjudication annotation
        if data.adjudication and data.incomplete:
            task.status = "adjudicating"
        elif data.adjudication:
            task.status = "completed"
        elif data.incomplete:
            task.status = "in progress"
        else:
            task.status = task_adjudication_status(data.task_id, data.project_id)
        task.date_modified = datetime.now(timezone.utc).isoformat()
        task.update()

    if not data.exists(True):
        return {"data": None, "error": "Annotation could not be saved."}

    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": data.id, "token": refreshed_token}


@router.put("/{aid}") # update an existing annotation
def update_annotation(aid: str, data: Dict[str, Any], token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if the provided annotation ID is valid
    if not validate_id(aid, Annotation):
        return {"data": None, "error": "Annotation not found"}
    annotation = Annotation.read(aid)

    # check if the user is admin or manager of the project
    if not user_admin_or_manager(annotation.project_id, token_payload['uid']):
        return {"data": None, "error": "Unauthorized"}
    
    # check if project_id is valid and corresponds to an existing project
    if data.get("project_id", None) and not Project.read(data["project_id"]):
        return {"data": None, "error": f"Project ID {data['project_id']} does not exist."}
    
    # check if task_id is valid and corresponds to an existing task
    if data.get("task_id", None) and not Task.read(data["task_id"]):
        return {"data": None, "error": f"Task ID {data['task_id']} does not exist."}

    # check content format if provided
    if data.get("content", None):
        error = validate_content(annotation.project_id, annotation.task_id, data["content"])
        if error:
            return {"data": None, "error": error}
    
    # update annotation if all checks passed
    for key, value in data.items():
        if key == "content" and isinstance(value, dict):
            # merge content dictionaries
            current_content = getattr(annotation, "content", {}) or {}
            current_content.update(value)
            setattr(annotation, "content", current_content)
        else:
            setattr(annotation, key, value)
    annotation.update()
    
    # we need to update the task status accordingly
    task = Task.read(annotation.task_id)
    if task is not None:
        task.status = task_adjudication_status(annotation.task_id, annotation.project_id)
        task.date_modified = datetime.now(timezone.utc).isoformat()
        task.update()

    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": {"status": "success"}, "token": refreshed_token}


@router.delete("/{aid}") # delete a specific annotation
def delete_annotation(aid: str, token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if the provided annotation ID is valid
    if not validate_id(aid, Annotation):
        return {"data": None, "error": "Annotation not found"}
    annotation = Annotation.read(aid)

    # check if the user is admin or manager of the project
    if not user_admin_or_manager(annotation.project_id, token_payload['uid']):
        return {"data": None, "error": "Unauthorized"}

    annotation.delete()
    
    # we need to update the task status accordingly
    task = Task.read(annotation.task_id)
    if task is not None:
        # count the number of annotations for the task
        annotations = Annotation.all(query={"task_id": task.id, "incomplete": False})
        if len(annotations) == 0:
            task.status = "created"
        else:
            task.status = task_adjudication_status(annotation.task_id, annotation.project_id)
        task.date_modified = datetime.now(timezone.utc).isoformat()
        task.update()

    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": {"status": "success"}, "token": refreshed_token}