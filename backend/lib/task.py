import random

from .models import Project, Task, Annotation

def incomplete_task(project_id, user_id):
    # get the task that is incomplete and annotated by the user
    annotations = Annotation.all(query={"project_id": project_id, "user_id": user_id, "incomplete": True})
    
    if len(annotations) == 0:
        return None
    
    # get the task information
    task = Task.read(annotations[0]['task_id'])
    
    if task is None:
        return None
    
    # convert to dictionary (to be able to add extra fields)
    task = task.model_dump()
    
    # populate the previous annotation
    task['populated_values'] = annotations[0]['content']
    
    # if this is an unfinished adjudication annotation, we should also read previous annotations by other users
    if annotations[0]['adjudication']:
        # fill in the previous annotations (only their content) to be adjudicated if adjudication_show is True for the project
        project = Project.read(project_id)
        if project is not None and project.adjudication_show is True:
            previous_annotations = Annotation.all(query={"task_id": task['id'], "incomplete": False})
            task['annotations_to_adjudicate'] = [ann['content'] for ann in previous_annotations]
    
    return task


def adjudication_needing_task(project_id, user_id):
    # get all tasks that need to be adjudicated
    adjudicating_tasks = Task.all(query={
                     "project_id": project_id, 
                     "active": True,
                     "status": "adjudicating"
                     })
    
    if len(adjudicating_tasks) == 0:
        return None
    
    # get the adjudicating_tasks that are not annotated by the user
    annotations = Annotation.all(query={"project_id": project_id, "user_id": user_id})
    annotated_tasks = [ann['task_id'] for ann in annotations]
    unannotated_tasks = [task for task in adjudicating_tasks if task['id'] not in annotated_tasks]
    
    if len(unannotated_tasks) == 0:
        return None
    
    # randomly select a task from the unannotated tasks
    chosen_task = random.choice(unannotated_tasks)
    
    # fill in the previous annotations (only their content) to be adjudicated if adjudication_show is True for the project
    project = Project.read(project_id)
    if project is not None and project.adjudication_show is True:
        previous_annotations = Annotation.all(query={"task_id": chosen_task['id'], "incomplete": False})
        chosen_task['annotations_to_adjudicate'] = [ann['content'] for ann in previous_annotations]

    return chosen_task
    

def random_task(project_id, user_id):
    # get all tasks annotated by the user
    annotations = Annotation.all(query={"project_id": project_id, "user_id": user_id})
    annotated_tasks = [ann['task_id'] for ann in annotations]
    
    # get all tasks for the project that are active and status is "created" or "in progress"
    # but we want to prioritize "in progress" tasks first so that we can complete them
    tasks = Task.all(query={
                     "project_id": project_id, 
                     "active": True,
                     "status": "in progress" # "status": {"$in": ["created", "in progress"]}
                     })

    # get all tasks that are not annotated by the user
    unannotated_tasks = [task for task in tasks if task['id'] not in annotated_tasks]
    
    # if no "in progress" tasks are available, get "created" tasks
    if len(unannotated_tasks) == 0:
        tasks = Task.all(query={
                        "project_id": project_id, 
                        "active": True,
                        "status": "created" # "status": {"$in": ["created", "in progress"]}
                        })

        # get all tasks that are not annotated by the user
        unannotated_tasks = [task for task in tasks if task['id'] not in annotated_tasks]
    
        if len(unannotated_tasks) == 0:
            return None
    
    # @TODO: It is marked "completed" in saveAnnotation if it reaches enough # annot., 
    # thus we don't need to count the previous annotations by other users
    # in a rare scenario that the last necessary annotation is in progress (incomplete),
    # extra annotator can get it

    # randomly select a task from the unannotated tasks
    chosen_task = random.choice(unannotated_tasks)
    
    return chosen_task