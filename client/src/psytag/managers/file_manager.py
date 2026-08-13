from typing import Optional, Dict, Any, List, Union
import os

from ..models import BaseManager, File

class FileManager(BaseManager):
    resource = "files"

    @staticmethod
    def list() -> List[File]:
        response = BaseManager._get(f"{FileManager.resource}")
        return [File(**item) for item in response] if isinstance(response, list) else []

    @staticmethod
    def list_for_project(pid: str) -> List[File]:
        response = BaseManager._get(f"{FileManager.resource}/project/{pid}")
        return [File(**item) for item in response] if isinstance(response, list) else []

    @staticmethod
    def read(fid: str) -> Optional[File]:
        response = BaseManager._get(f"{FileManager.resource}/{fid}")
        return File(**response) if response else None

    @staticmethod
    def create(fields: Union[Dict[str, Any], File], local_file: Optional[str] = None) -> Optional[File]:
        # convert File object to dict if necessary
        if isinstance(fields, File):
            fields = fields.model_dump(exclude_unset=True)
        
        # check if the resulting File object is valid (fits to the model)
        try:
            File(**fields)
        except Exception as e:
            print(f"Error: Invalid file data provided. {e}")
            return None
        
        if local_file:
            if not os.path.isfile(local_file):
                print(f"Error: Local file not found at path: {local_file}")
                return None

        if local_file:
            response = BaseManager._post(f"{FileManager.resource}/upload", fields, file_path=local_file)
        else:
            response = BaseManager._post(f"{FileManager.resource}", fields)

        if isinstance(response, dict) and "id" in response and "existing" in response:
            if response["existing"]:
                print(f"File with same content already exists with ID: {response['id']}")
            else:
                print(f"File created with ID: {response['id']}")
            new_file = FileManager.read(response['id'])
            return new_file
        return None

    @staticmethod
    def update(fid: str, fields: Union[Dict[str, Any], File]):
        # convert File object to dict if necessary
        if isinstance(fields, File):
            fields = fields.model_dump(exclude_unset=True)

        response = BaseManager._put(f"{FileManager.resource}/{fid}", fields)
        if response:
            print(f"File {fid} updated successfully.")
        else:
            print(f"Failed to update file {fid}: {response}")

    @staticmethod
    def delete(fid: str, full_delete: bool = True):
        response = BaseManager._delete(f"{FileManager.resource}/{fid}/{str(full_delete).lower()}")
        if response:
            print(f"File {fid} deleted successfully.")
        else:
            print(f"Failed to delete file {fid}: {response}")

# Functions for ergonomic purposes
def list_files() -> List[File]:
    return FileManager.list()

def list_files_for_project(pid: str) -> List[File]:
    return FileManager.list_for_project(pid)

def read_file(fid: str) -> Optional[File]:
    return FileManager.read(fid)

def create_file(fields: Union[Dict[str, Any], File], local_file: Optional[str] = None) -> Optional[File]:
    return FileManager.create(fields, local_file=local_file)

def update_file(fid: str, fields: Union[Dict[str, Any], File]):
    FileManager.update(fid, fields)

def delete_file(fid: str, full_delete: bool = True):
    FileManager.delete(fid, full_delete=full_delete)