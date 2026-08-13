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

# Annotation Management

### Annotation Management

The Annotation Management module allows project managers and administrators to inspect, retrieve, create, update, and remove annotations programmatically. Unlike other manager modules that return Pydantic model objects, functions in `AnnotationManager` return plain Python dictionaries. This design choice ensures that file metadata, task context, and user details are automatically expanded into human-readable fields alongside the annotation response content.

### Listing and Reading Annotations

To retrieve annotations for an entire project, use `list_annotations_for_project()` or `AM.list_for_project()`. To retrieve annotations for a specific task, use `list_annotations_for_task()` or `AM.list_for_task()`. Calling `list_annotations()` without arguments lists all annotations in the system, which requires system administrator privileges. Any key in the returned dictionary prefixed with `sds_` (such as `sds_subject`, `sds_study`, or `sds_path`) represents metadata automatically populated from the underlying _SDS_ standard. To inspect a single annotation entry by its unique ID, use `read_annotation()`:

```python
from psytag.managers import AM, list_annotations_for_project, read_annotation

project_id = "650f1a2b3c4d5e6f7a8b9c0a"

# Fetch all annotations submitted for a project
project_annotations = AM.list_for_project(project_id)
# project_annotations = list_annotations_for_project(project_id)

for annotation in project_annotations:
    print(annotation['id'], annotation['task_id'], annotation['user_id'], annotation['content'])

# Read a specific annotation
if project_annotations:
    annotation_id = project_annotations[0]['id']
    specific_annotation = AM.read(annotation_id)
    # specific_annotation = read_annotation(annotation_id)
    print(f"Loaded annotation content: {specific_annotation['content']}")
```

### Creating Annotations

While annotators normally submit responses through the web workspace, project managers can programmatically inject annotations for testing or data migration using `create_annotation()` or `AM.create()`. When constructing an annotation payload:

* The `content` dictionary keys must match exact variable names defined in the parent project's question schema.
* Set `incomplete` to `False` for submitted responses, or `True` for saved drafts.
* Set `adjudication` or `gold` booleans to designate adjudication or gold-standard reference entries.

```python
from psytag.managers import AM, create_annotation

annotation_info = {
    "project_id": "650f1a2b3c4d5e6f7a8b9c0a",
    "task_id": "650f1a2b3c4d5e6f7a8b9c0d",
    "incomplete": False,
    "adjudication": False,
    "gold": False,
    "content": {
        "engagement_level": 4,
        "behavior_timeline": [
            {"start": 1.2, "end": 4.5, "label": "Gaze Disruption"}
        ]
    }
}

# Create new annotation entry
new_annotation = AM.create(annotation_info)
# new_annotation = create_annotation(annotation_info)
```

### Updating Annotations

To modify annotation status flags or edit submitted content, pass the annotation ID and updated dictionary fields to `update_annotation()` or `AM.update()`:

```python
from psytag.managers import AM, update_annotation

# Update incomplete flag or content fields
AM.update(new_annotation['id'], {
    "incomplete": False,
    "content": {
        "engagement_level": 5
    }
})
# update_annotation(new_annotation['id'], {"incomplete": False})
```

### Deleting Annotations

To permanently remove an annotation entry from the database, pass its ID to \`delete\_annotation()\` or \`AM.delete()\`:

```python
from psytag.managers import AM, delete_annotation

# Delete the annotation
AM.delete(new_annotation['id'])
# delete_annotation(new_annotation['id'])
```

{% hint style="danger" %}
Please use the delete function with caution. Deleting an annotation is irreversible, and Psytag will not prompt you for confirmation before proceeding.
{% endhint %}
