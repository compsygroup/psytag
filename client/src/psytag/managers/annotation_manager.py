from typing import Optional, Dict, Any, List, Union

from ..models import BaseManager, Annotation

class AnnotationManager(BaseManager):
    resource = "annotations"

    @staticmethod
    def list() -> List[Dict[str, Any]]:
        response = BaseManager._get(f"{AnnotationManager.resource}")
        return response if isinstance(response, (list, dict)) else []
        # return [Annotation(**item) for item in response] if isinstance(response, list) else []

    @staticmethod
    def list_for_project(pid: str) -> List[Dict[str, Any]]:
        response = BaseManager._get(f"{AnnotationManager.resource}/project/{pid}")
        return response if isinstance(response, (list, dict)) else []
        # return [Annotation(**item) for item in response] if isinstance(response, list) else []

    @staticmethod
    def list_for_task(tid: str) -> List[Dict[str, Any]]:
        response = BaseManager._get(f"{AnnotationManager.resource}/task/{tid}")
        return response if isinstance(response, (list, dict)) else []
        # return [Annotation(**item) for item in response] if isinstance(response, list) else []

    @staticmethod
    def read(aid: str) -> Optional[Dict[str, Any]]:
        response = BaseManager._get(f"{AnnotationManager.resource}/{aid}")
        return response if isinstance(response, dict) else None
        #return Annotation(**response) if response else None
    
    @staticmethod
    def create(fields: Union[Dict[str, Any], Annotation]) -> Optional[Annotation]:
        # convert Annotation object to dict if necessary
        if isinstance(fields, Annotation):
            fields = fields.model_dump(exclude_unset=True)
            
        # check if the resulting Annotation object is valid (fits to the model)
        try:
            Annotation(**fields)
        except Exception as e:
            print(f"Error: Invalid annotation data provided. {e}")
            return None

        # create the annotation
        response = BaseManager._post(f"{AnnotationManager.resource}", fields)
        if isinstance(response, str):
            print(f"Annotation created with ID: {response}")
            new_annotation = AnnotationManager.read(response)
            return new_annotation
        return None

    @staticmethod
    def update(aid: str, fields: Union[Dict[str, Any], Annotation]):
        # convert Annotation object to dict if necessary
        if isinstance(fields, Annotation):
            fields = fields.model_dump(exclude_unset=True)

        # update the annotation
        response = BaseManager._put(f"{AnnotationManager.resource}/{aid}", fields)
        if response:
            print(f"Annotation {aid} updated successfully.")
        else:
            print(f"Failed to update annotation {aid}: {response}")

    @staticmethod
    def delete(aid: str):
        response = BaseManager._delete(f"{AnnotationManager.resource}/{aid}")
        if response:
            print(f"Annotation {aid} deleted successfully.")
        else:
            print(f"Failed to delete annotation {aid}: {response}")

# Functions for ergonomic purposes
def list_annotations() -> List[Dict[str, Any]]:
    return AnnotationManager.list()

def list_annotations_for_project(pid: str) -> List[Dict[str, Any]]:
    return AnnotationManager.list_for_project(pid)

def list_annotations_for_task(tid: str) -> List[Dict[str, Any]]:
    return AnnotationManager.list_for_task(tid)

def read_annotation(aid: str) -> Optional[Dict[str, Any]]:
    return AnnotationManager.read(aid)

def create_annotation(fields: Union[Dict[str, Any], Annotation]) -> Optional[Annotation]:
    return AnnotationManager.create(fields)

def update_annotation(aid: str, fields: Union[Dict[str, Any], Annotation]):
    AnnotationManager.update(aid, fields)

def delete_annotation(aid: str):
    AnnotationManager.delete(aid)