from bson import ObjectId
from typing import Type, Union

from .models import File, Project, Task, Annotation, User

def validate_id(oid: str, object: Type[Union[File, Project, Task, Annotation, User]]) -> bool:
    # check if the provided object ID is valid
    if not ObjectId.is_valid(oid):
        return False

    # check if the object exists
    obj = object.read(oid)
    if obj is None or obj.id is None:
        return False

    return True