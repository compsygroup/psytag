from typing import Any, Dict, Optional

from .models import Annotation, Project, Task
from .adjudication import validate_adjudication, needs_adjudication

def task_adjudication_status(task_id: str, project_id: str) -> str:
    # if there is an adjudication annotation, the task is completed
    adjudication_annotations = Annotation.all(query={"task_id": task_id, "adjudication": True, "incomplete": False})
    if len(adjudication_annotations) > 0:
        return "completed"
    
    # if there is an incomplete adjudication annotation, the task is adjudicating
    incomplete_adjudications = Annotation.all(query={"task_id": task_id, "adjudication": True, "incomplete": True})
    if len(incomplete_adjudications) > 0:
        return "adjudicating"
    
    # count the number of annotations for the task
    annotations = Annotation.all(query={"task_id": task_id, "incomplete": False})
    project = Project.read(project_id)
    num_annotators = project.num_annotators
    
    status = "in progress"
    
    # check if enough annotations are present
    if len(annotations) >= num_annotators:
        status = "completed"
        
        # check if the task needs to be adjudicated
        if (project.adjudication_rule is not None) and (project.adjudication_rule['function'] == "always"):
            status = "adjudicating"
        elif project.adjudication_rule is not None:
            # @TODO: rule may include multiple rules
            
            # for each variable in the adjudication_rule, get the values from the annotations
            variables = project.adjudication_rule['variables']
            # if one variable needs adjudication, the task is adjudicating
            adjudication_needed = False
            for variable in variables:
                values = [annotation['content'][variable] for annotation in annotations]
            
                # first check if the rule is valid for the given values and parameters
                is_valid = validate_adjudication(values, project.adjudication_rule['function'], project.adjudication_rule.get('parameters', {}))
                # and if valid, check if adjudication is needed
                if is_valid:
                    adjudication_needed = needs_adjudication(values, project.adjudication_rule['function'], project.adjudication_rule.get('parameters', {}))
                    
                    if adjudication_needed:
                        break
            
            if adjudication_needed:
                status = "adjudicating"
                    
    return status


def validate_content(pid: str, tid: str, content: Dict[str, Any]) -> Optional[str]:
    # get all variable names from the task (if exists) or project questions
    variables = []
    project = Project.read(pid)
    task = Task.read(tid)
    questions = task.questions if (task and task.questions is not None) else project.questions
    for q in questions:
        variables.append(q['variable'])
    
    # check if all keys in content are valid variable names
    for key in content.keys():
        if key not in variables:
            return f"Invalid variable '{key}' in content. Not found in project/task questions."
        
    # @TODO: validate content values according to question types (e.g. number ranges, text lengths, etc)
    
    return None