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

# Project Management

<h2 align="center">Project Management</h2>

The Project Management module allows you to programmatically create, inspect, update, and remove annotation projects. Through this module, you can define project metadata, assign annotators and managers, design question layouts, and configure automated adjudication workflows.

### Listing and Reading Projects

To view projects accessible to your account, use `list_projects()` or `PM.list()`. Regular users see projects they are assigned to, while administrators see all projects across the system. To retrieve details for a specific project by its ID, use `read_project()`:

```python
from psytag.managers import PM, list_projects, read_project

# List accessible projects
all_projects = PM.list()
# all_projects = list_projects()

for project in all_projects:
    print(project.id, project.name, project.active, project.num_annotators)

# Read details of a specific project
if all_projects:
    project_id = all_projects[0].id
    specific_project = PM.read(project_id)
    # specific_project = read_project(project_id)
    print(f"Loaded project: {specific_project.name}")
```

### Creating a New Project

To create a new project, prepare a dictionary containing project parameters and pass it to `create_project()` or `PM.create()`. When creating a project, you can define:

* Users & Managers: Lists of user IDs assigned as annotators (`users`) or project managers (`managers`).
* Number of Annotators: The required number of distinct annotations per task before a task is marked complete (`num_annotators`).
* Questions: An array of question dictionaries defining variable names, labels, input types, options, and required statuses.
* Adjudication Rules: Automated rules evaluated when responses conflict across annotators.

```python
from psytag.managers import PM, create_project

project_info = {
    "name": "Behavioral Video Coding Study",
    "description": "Annotating participant engagement and gesture timing in study sessions.",
    "users": [
        "650f1a2b3c4d5e6f7a8b9c0d",  # User ID for Annotator 1
        "650f1a2b3c4d5e6f7a8b9c0e"   # User ID for Annotator 2
    ],
    "managers": [
        "650f1a2b3c4d5e6f7a8b9c0f"   # User ID for Project Manager
    ],
    "num_annotators": 2,
    "instructions": "Please review the media file and answer all questions carefully.",
    "questions": [
        {
            "variable": "engagement_level",
            "label": "Rate the participant's overall engagement level:",
            "type": "range",
            "min": 1,
            "max": 5,
            "step": 1,
            "options": ["Low", "Mild", "Moderate", "High", "Very High"],
            "required": True,
            "position": "middle"
        },
        {
            "variable": "behavior_timeline",
            "label": "Annotate behavioral occurrences across the video:",
            "type": "mediatimeline",
            "options": ["Gaze Disruption", "Hand Gesture", "Vocalization"],
            "separate_tracks": True,
            "extra_labels_type": "text",
            "required": False,
            "position": "middle"
        }
    ],
    "adjudication_show": True,
    "adjudication_rule": {
        "variables": ["engagement_level"],
        "function": "exact_agreement",
        "parameters": {}
    }
}

# Create the project
new_project = PM.create(project_info)
# new_project = create_project(project_info)
```

### Defining Questions & Layouts

Questions within a project dictate what data annotators enter for each task. Each question entry in the `questions` list is a dictionary with the following core properties:

* `variable`: A unique string identifier (valid Python identifier) used as the key in stored annotations.
* `label`: The display prompt presented to annotators.
* `type`: One of the supported annotation input types (e.g., `text`, `radio`, `checkbox`, `range`, `mediatimeline`, `mediatimestamp`).
* `required`: Boolean indicating whether an answer must be provided before submission.
* `position`: Optional layout column placement (`left`, `middle`, or `right`). The media player always occupies the top of the middle column.

### Configuring Adjudication Rules

Adjudication rules specify when a task that has reached its required number of annotations needs review by an adjudicator. The `adjudication_rule` dictionary contains three keys:

* `variables`: A list of question variable names evaluated by the rule. If multiple variables are listed, a disagreement in any variable flags the task for adjudication.
* `function`: The agreement function to evaluate. Supported functions are:
  * `exact_agreement`: Flags the task if any two annotators provide non-identical answers for the target variables.
  * `delta_agreement`: Compares numeric or continuous values and flags the task if the absolute difference between any two entries exceeds a specified tolerance. Requires `{"delta": margin}` in `parameters`.
  * `always`: Automatically routes every task to adjudication upon completion of initial annotations, regardless of agreement.
* `parameters`: A dictionary of additional arguments needed by the rule function (e.g., `{"delta": 1.5}`).

### Updating Projects

To update project settings, update team members, or modify instructions, pass the project ID and a dictionary of updated fields to `update_project()` or `PM.update()`:

```python
from psytag.managers import PM, update_project

# Update project name and instructions
PM.update(new_project.id, {
    "name": "Behavioral Video Coding Study (Phase 1)",
    "instructions": "Updated instructions: Please double-check timestamp accuracy."
})
# update_project(new_project.id, {"name": "Behavioral Video Coding Study (Phase 1)"})
```

### Deleting Projects

To delete a project, pass its ID to `delete_project()` or `PM.delete()`.&#x20;

```python
from psytag.managers import PM, delete_project

# Delete the project
PM.delete(new_project.id)
# delete_project(new_project.id)
```

{% hint style="danger" %}
Please use the delete function with caution. Deleting a project is irreversible, and Psytag will not prompt you for confirmation before proceeding.&#x20;
{% endhint %}
