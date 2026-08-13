from typing import Optional, Dict, Any, List, Union

from ..models import BaseManager, Project

class ProjectManager(BaseManager):
    resource = "projects"

    @staticmethod
    def list() -> List[Project]:
        response = BaseManager._get(f"{ProjectManager.resource}")
        return [Project(**item) for item in response] if isinstance(response, list) else []

    @staticmethod
    def read(pid: str) -> Optional[Project]:
        response = BaseManager._get(f"{ProjectManager.resource}/{pid}")
        return Project(**response) if response else None

    @staticmethod
    def create(fields: Union[Dict[str, Any], Project]) -> Optional[Project]:
        # convert Project object to dict if necessary
        if isinstance(fields, Project):
            fields = fields.model_dump(exclude_unset=True)
        
        # check if the resulting Project object is valid (fits to the model)
        try:
            Project(**fields)
        except Exception as e:
            print(f"Error: Invalid project data provided. {e}")
            return None
        
        # create the project
        response = BaseManager._post(f"{ProjectManager.resource}", fields)
        if isinstance(response, str):
            print(f"Project created with ID: {response}")
            new_project = ProjectManager.read(response)
            return new_project
        
        return None

    @staticmethod
    def update(pid: str, fields: Union[Dict[str, Any], Project]):
        # convert Project object to dict if necessary
        if isinstance(fields, Project):
            fields = fields.model_dump(exclude_unset=True)

        # update the project
        response = BaseManager._put(f"{ProjectManager.resource}/{pid}", fields)
        if response:
            print(f"Project {pid} updated successfully.")
        else:
            print(f"Failed to update project {pid}: {response}")

    @staticmethod
    def delete(pid: str):
        response = BaseManager._delete(f"{ProjectManager.resource}/{pid}")
        if response:
            print(f"Project {pid} deleted successfully.")
        else:
            print(f"Failed to delete project {pid}: {response}")

# Functions for ergonomic purposes
def list_projects() -> List[Project]:
    return ProjectManager.list()

def read_project(pid: str) -> Optional[Project]:
    return ProjectManager.read(pid)

def create_project(fields: Union[Dict[str, Any], Project]) -> Optional[Project]:
    return ProjectManager.create(fields)

def update_project(pid: str, fields: Union[Dict[str, Any], Project]):
    ProjectManager.update(pid, fields)

def delete_project(pid: str):
    ProjectManager.delete(pid)