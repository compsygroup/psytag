from typing import Optional, Dict, Any, List, Union

from ..models import BaseManager, Task

class TaskManager(BaseManager):
    resource = "tasks"

    @staticmethod
    def list() -> List[Task]:
        response = BaseManager._get(f"{TaskManager.resource}")
        return [Task(**item) for item in response] if isinstance(response, list) else []

    @staticmethod
    def list_for_project(pid: str) -> List[Task]:
        response = BaseManager._get(f"{TaskManager.resource}/project/{pid}")
        return [Task(**item) for item in response] if isinstance(response, list) else []

    @staticmethod
    def read(tid: str) -> Optional[Task]:
        response = BaseManager._get(f"{TaskManager.resource}/{tid}")
        return Task(**response) if response else None

    @staticmethod
    def create(fields: Union[Dict[str, Any], Task]) -> Optional[Task]:
        # convert Task object to dict if necessary
        if isinstance(fields, Task):
            fields = fields.model_dump(exclude_unset=True)

        # check if the resulting Task object is valid (fits to the model)
        try:
            Task(**fields)
        except Exception as e:
            print(f"Error: Invalid task data provided. {e}")
            return None
        
        # create the task
        response = BaseManager._post(f"{TaskManager.resource}", fields)
        if isinstance(response, str):
            print(f"Task created with ID: {response}")
            new_task = TaskManager.read(response)
            return new_task
        return None

    @staticmethod
    def update(tid: str, fields: Union[Dict[str, Any], Task]):
        # convert Task object to dict if necessary
        if isinstance(fields, Task):
            fields = fields.model_dump(exclude_unset=True)

        # update the task
        response = BaseManager._put(f"{TaskManager.resource}/{tid}", fields)
        if response:
            print(f"Task {tid} updated successfully.")
        else:
            print(f"Failed to update task {tid}: {response}")

    @staticmethod
    def reset(tid: str):
        response = BaseManager._put(f"{TaskManager.resource}/reset/{tid}")
        if response:
            print(f"Task {tid} reset successfully.")
        else:
            print(f"Failed to reset task {tid}: {response}")

    @staticmethod
    def delete(tid: str):
        response = BaseManager._delete(f"{TaskManager.resource}/{tid}")
        if response:
            print(f"Task {tid} deleted successfully.")
        else:
            print(f"Failed to delete task {tid}: {response}")

# Functions for ergonomic purposes
def list_tasks() -> List[Task]:
    return TaskManager.list()

def list_tasks_for_project(pid: str) -> List[Task]:
    return TaskManager.list_for_project(pid)

def read_task(tid: str) -> Optional[Task]:
    return TaskManager.read(tid)

def create_task(fields: Union[Dict[str, Any], Task]) -> Optional[Task]:
    return TaskManager.create(fields)

def update_task(tid: str, fields: Union[Dict[str, Any], Task]):
    TaskManager.update(tid, fields)

def reset_task(tid: str):
    TaskManager.reset(tid)

def delete_task(tid: str):
    TaskManager.delete(tid)