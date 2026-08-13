from bson import ObjectId
from typing import Any, List, Optional

from .models import Project, User
from .functions import validate_id

def user_admin_or_manager(pid: str, uid: str) -> bool:
    # check if the provided project ID is valid
    if not validate_id(pid, Project):
        return False
    project = Project.read(pid)
    
    # check if the user is admin or manager of the project
    user = User.read(uid)
    managers = project.managers or []
    if (user is None) or ((not getattr(user, "admin", False)) and (not user.id in managers)):
        return False
    
    return True


def properIDs(users):
    # check if they are valid Mongo IDs (24 hex characters)
    if all((isinstance(u, str) and len(u) == 24 and ObjectId.is_valid(u)) for u in users):
        pass  # they are already IDs
    else:
        # resolve usernames -> ids
        user_ids = []
        for uname in users:
            u = User.read_by_username(uname)
            if u and "id" in u:
                user_ids.append(u["id"])
        if len(user_ids):
            users = user_ids
    return users


def validate_users(uids: List[str]) -> Optional[str]:
    # check if provided users is a list and contain valid user IDs
    if not isinstance(uids, list) or not all((isinstance(uid, str) and ObjectId.is_valid(uid)) for uid in uids):
        return "'users / managers' must be a list of proper user IDs."
    # check if users are actual users in the system
    all_user_ids = {user["id"] for user in User.all()}
    for uid in uids:
        if uid not in all_user_ids:
            return f"User ID {uid} in 'users / managers' does not exist."
    return None


def validate_questions(questions: Any) -> Optional[str]:
    # must be a list of dicts
    if not isinstance(questions, list):
        return "'questions' must be a list of dictionaries."
    
    # each q must be a dict with required keys
    for q in questions:
        if not isinstance(q, dict) or "variable" not in q or "type" not in q or "label" not in q:
            return "Each question must be a dictionary with at least 'variable', 'type', and 'label' keys."
    
    # variable names must be unique and valid python-style variable names
    variables = set()
    for q in questions:
        if not isinstance(q.get("variable"), str):
            return f"Question variable must be a string. Got {type(q.get('variable'))}."
        elif not q["variable"].isidentifier():
           return f"Question variable '{q['variable']}' is not a valid identifier."
        variables.add(q["variable"])
    if len(variables) != len(questions):
        return "Question variables must be unique."
    
    # label must be non-empty strings
    for q in questions:
        if not isinstance(q.get("label"), str) or not q["label"].strip():
            return "Question label must be a non-empty string."
        
    # required field must be boolean if provided
    for q in questions:
        if "required" in q and not isinstance(q["required"], bool):
            return "Question 'required' field must be a boolean (True/False)."

    # type must be one of allowed types
    allowed_types = {"mediatimeline", "mediatimestamp", "text", "textarea", "radio", "checkbox", "range", "select", "number", "date", "time", "datetime-local", "email"}
    for q in questions:
        if q.get("type") not in allowed_types:
            return f"Question type '{q.get('type')}' is not valid. Must be one of {allowed_types}."
    
    # specific checks for certain types
    for q in questions:
        if q.get("type") == "range":
            if not all(isinstance(q.get(k), (int, float)) for k in ["min", "max", "step"]):
                return "'range' type questions must have numeric 'min', 'max', and 'step' fields."
            if q["min"] >= q["max"]:
                return "In 'range' type questions, 'min' must be less than 'max'."
        elif q.get("type") in {"radio", "checkbox", "select"}:
            if not isinstance(q.get("options"), list) or not all(isinstance(opt, str) for opt in q["options"]):
                return f"'{q.get('type')}' type questions must have an 'options' field that is a list of strings."

    return None


def validate_adjudication_rule(rule: Any, question_vars: List[str]) -> Optional[str]:
     # check if it is a dict with required keys
    if not isinstance(rule, dict) or "function" not in rule:
        return "'adjudication_rule' must be a dictionary with at least 'function' key."
    
    if rule["function"] != "always" and "variables" not in rule:
        return "'adjudication_rule.variables' is required for functions other than 'always'."

     # check if the variables exist in project questions
    if "variables" in rule and not all(v in question_vars for v in rule["variables"]):
        return f"'adjudication_rule.variables' must be a list of question variables: {question_vars}"
    
    # function must be a non-empty string and an allowed function
    allowed_functions = {"exact_agreement", "delta_agreement", "always"}
    if not isinstance(rule["function"], str) or rule["function"] not in allowed_functions:
        return f"'adjudication_rule.function' must be one of {allowed_functions}."
    
    # checks for parameters based on function
    if rule["function"] == "delta_agreement":
        if not rule.get("parameters") or not isinstance(rule.get("parameters"), dict) or "delta" not in rule["parameters"]:
            return "'adjudication_rule.parameters' must be a dictionary with a 'delta' key."
        if not isinstance(rule["parameters"].get("delta"), (int, float)):
            return "'adjudication_rule.parameters.delta' must be a number."

    return None