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

# Getting Started

<h2 align="center">Getting Started</h2>

The Psytag Python client provides programmatic access to the entire Psytag REST API, enabling researchers and developers to automate administrative tasks, batch-process media files, and build custom data pipelines.

### General Workflow

The typical workflow when working with the Python client consists of the following steps:

1. Authentication: Initialize a session with the backend server using an API key.
2. Resource Management: Perform CRUD (Create, Read, Update, Delete) operations across Psytag's core entities: Users, Projects, Files, Tasks, and Annotations.
3. Pipeline Automation: When setting up a new study, the standard sequence is to first create a Project, upload the necessary media Files, and then generate Tasks by linking those File IDs to the Project.

Because the Python client provides low-level, direct access to all API routes, you can write custom scripts to process hundreds of files or manage user permissions automatically.

### Authentication and API Keys

To use the Python client, you must authenticating using an API Key associated with a Psytag account that has managerial or administrative privileges. System administrators or project managers can enable API access for a user through User Management. Upon enabling API access, Psytag generates a unique API key. This key is displayed only once—it is stored as a secure hash on the server and cannot be retrieved later. If an API key is lost, a new one must be generated. To log in via Python, import `login_api` and supply your API key along with your Psytag server host and port details:

```python
import json
from psytag import login_api

# Define your personal API Key (keep this secret)
API_KEY = "your_secret_api_key_here"

# Initialize session with the Psytag backend server
login_api(API_KEY, server_url="http://your-psytag-server.org", server_port="8000")
```

{% hint style="info" %}
`server_url` and `server_port` parameters are optional. If not provided, the default values (127.0.0.1 and 8000) will be assumed.
{% endhint %}

### Importing Resource Managers

The Python client offers two ways to import resource management tools depending on your coding style and IDE setup.

#### Option 1: Importing Manager Classes

You can import resource manager classes, which group related CRUD operations under concise class aliases. This approach provides auto-completion support in most modern IDEs:

```python
from psytag.managers import UserManager as UM
from psytag.managers import ProjectManager as PM
from psytag.managers import FileManager as FM
from psytag.managers import TaskManager as TM
from psytag.managers import AnnotationManager as AM

# Usage example: typing "UM." brings up auto-completion suggestions
me = UM.my_info()
```

#### Option 2: Importing Functions Directly

Alternatively, you can import individual standalone functions directly into your script namespace:

```python
from psytag.managers import (
    get_my_info, list_users, read_user, create_user, update_user, delete_user,
    list_projects, create_project, read_project, update_project, delete_project,
    list_files, list_files_for_project, read_file, create_file, update_file, delete_file,
    list_tasks, list_tasks_for_project, read_task, create_task, update_task, reset_task, delete_task,
    list_annotations, list_annotations_for_task, list_annotations_for_project, read_annotation, create_annotation, update_annotation, delete_annotation
)

# Usage example: calling standalone functions directly
me = get_my_info()
```

### CRUD Operations

Every primary resource unit in Psytag exposes standardized CRUD methods through the API:

* Create (`create_*`): Accepts a dictionary or Pydantic model representing resource attributes and posts it to the database. Returns a newly created resource object containing its assigned server ID.
* Read (`read_*` / `list_*`): Retrieves a specific resource by its unique ID or returns a list of resources accessible to your account.
* Update (`update_*`): Accepts a target resource ID and a dictionary of specific fields to modify.
* Delete (`delete_*`): Permanently removes a resource (or marks it as deleted depending on resource rules).
