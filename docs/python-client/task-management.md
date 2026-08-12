---
layout:
  width: default
  title:
    visible: false
  description:
    visible: false
  tableOfContents:
    visible: true
  outline:
    visible: true
  pagination:
    visible: true
  metadata:
    visible: false
  tags:
    visible: true
  actions:
    visible: true
---

# Task Management

<h2 align="center">Task Management</h2>

The Task Management module allows you to programmatically create, inspect, update, reset, and remove annotation tasks. Tasks link specific media files to projects and serve as the individual assignments presented to annotators.

### Listing and Reading Tasks

To view tasks for a specific project that you manage, use `list_tasks_for_project()` or `TM.list_for_project()`. Note that calling `list_tasks()` without a project ID requires administrator privileges. To fetch details for a single task by its ID, use `read_task()`:

```python
from psytag.managers import TM, list_tasks_for_project, read_task

project_id = "650f1a2b3c4d5e6f7a8b9c0a"

# List all tasks assigned to a project
project_tasks = TM.list_for_project(project_id)
# project_tasks = list_tasks_for_project(project_id)

for task in project_tasks:
    print(task.id, task.project_id, task.file_id, task.status, task.active)

# Read details of a specific task
if project_tasks:
    task_id = project_tasks[0].id
    specific_task = TM.read(task_id)
    # specific_task = read_task(task_id)
    print(f"Loaded task for file ID: {specific_task.file_id}")
```

### Creating Tasks

To create a new task, prepare a dictionary specifying the target `project_id` and `file_id`, then pass it to `create_task()` or `TM.create()`. By default, a task inherits its instructions and question layout directly from its parent project. However, you can optionally override these properties on a per-task basis if a specific media file requires unique instructions or custom questions.

```python
from psytag.managers import TM, create_task

task_info = {
    "project_id": "650f1a2b3c4d5e6f7a8b9c0a",  # ID of the parent project
    "file_id": "650f1a2b3c4d5e6f7a8b9c0b",     # ID of the media File
    "active": True                             # Set task active status
}

# Create a standard task
new_task = TM.create(task_info)
# new_task = create_task(task_info)

# Optional: Creating a task with custom instructions overriding project defaults
custom_task_info = {
    "project_id": "650f1a2b3c4d5e6f7a8b9c0a",
    "file_id": "650f1a2b3c4d5e6f7a8b9c0c",
    "active": True,
    "instructions": "Special note for this video: Pay close attention to audio cues starting at 01:15."
}
custom_task = TM.create(custom_task_info)
```

### Updating Tasks

To change a task's status, toggle its availability, or update custom instructions, pass the task ID and a dictionary of updated attributes to `update_task()` or `TM.update()`:

```python
from psytag.managers import TM, update_task

# Deactivate a task temporarily
TM.update(new_task.id, {"active": False})
# update_task(new_task.id, {"active": False})
```

### Resetting Tasks

If you need to restart the annotation process for a task—for instance, if annotators misunderstood instructions or completed trial runs—you can reset the task using `reset_task()` or `TM.reset()`. Resetting a task permanently deletes all existing annotations associated with it and reverts the task status back to `created`. The task itself remains in the project.

```python
from psytag.managers import TM, reset_task

# Reset task annotations and return status to 'created'
TM.reset(new_task.id)
# reset_task(new_task.id)
```

### Deleting Tasks

To permanently delete a task and purge all associated annotations from the system, pass its ID to `delete_task()` or `TM.delete()`.

```python
from psytag.managers import TM, delete_task

# Delete the task
TM.delete(new_task.id)
# delete_task(new_task.id)
```

{% hint style="danger" %}
Please use the delete function with caution. Deleting a task is irreversible, and Psytag will not prompt you for confirmation before proceeding.
{% endhint %}
