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

# File Management

<h2 align="center">File Management</h2>

The File Management module allows you to programmatically upload local media assets, manage existing files, attach _Sensor Data Structure (SDS)_ metadata, and organize media resources stored on the Psytag server.

### Listing and Reading Files

To list files that you have uploaded or created, use `list_files()` or `FM.list()`. Note that unless you hold system administrator privileges, calling `list_files()` will only return files that your account owns. To list all files associated with a specific project you manage, use `list_files_for_project()` or `FM.list_for_project()`. To fetch details for a single file by its ID, use `read_file()`:

```python
from psytag.managers import FM, list_files_for_project, read_file

project_id = "650f1a2b3c4d5e6f7a8b9c0a"

# List files associated with a specific project
project_files = FM.list_for_project(project_id)
# project_files = list_files_for_project(project_id)

for file in project_files:
    print(file.id, file.file_path, file.modality, file.data_type, file.subject)

# Read details of a specific file
if project_files:
    file_id = project_files[0].id
    specific_file = FM.read(file_id)
    # specific_file = read_file(file_id)
    print(f"Loaded file: {specific_file.file_path}")
```

### Uploading Files & Adding Metadata

To upload a new media file to the server and create a corresponding `File` database record, use `create_file()` or `FM.create()`. When uploading a file, you can specify standard _Sensor Data Structure (SDS)_ metadata fields as well as custom key-value pairs inside an `extra` dictionary. Adding metadata is highly recommended because these attributes are automatically merged into exported annotation CSV files, making it easy to identify the exact research context for each labeled media file.

#### Uploading a Local File

To upload a file from your local machine, pass the metadata dictionary as the first argument and the path to your local media file via the `local_file` parameter:

```python
from psytag.managers import FM, create_file

file_info = {
    "file_path": "studyA/session1/clip001.mp4",  # Path where the file will be organized on the server
    "study": "Parent-Child Interaction Study",   # SDS Study name
    "subject": "SUBJ_102",                        # SDS Subject identifier
    "session": 1,                                 # SDS Session number
    "task": "FreePlay",                           # SDS Behavioral task name
    "condition": "Baseline",                      # SDS Experimental condition
    "modality": "video",                          # Media modality (video, audio, or image)
    "data_type": "mp4",                           # File extension/format
    "extra": {                                    # Custom key-value pairs
        "camera_angle": "front",
        "lighting": "good",
        "clip_number": 12
    }
}

# Upload local file to server and register File record
new_file = FM.create(file_info, local_file="local_videos/sample_001.mp4")
# new_file = create_file(file_info, local_file="local_videos/sample_001.mp4")
```

{% hint style="info" %}
The path defined by `file_path` field (_e.g._, studyA/session1/clip001.mp4), relative to the root upload directory, will be created automatically. You can give any valid path name.
{% endhint %}

#### Registering Pre-Uploaded Server Files

If media files have already been transferred directly to the server storage directory manually (for instance, via SFTP or batch server scripts), you can omit the `local_file` parameter. Calling `create_file()` with only the metadata dictionary will instantiate a `File` object in the database linking to the existing file path on the server:

```python
# Register a database entry for a file already located on the server
server_file = FM.create({
    "file_path": "studyA/session1/clip002.mp4",
    "modality": "video",
    "data_type": "mp4"
})
```

{% hint style="warning" %}
The path defined by `file_path` field (_e.g._, studyA/session1/clip002.mp4), relative to the root upload directory, must exist on the server.
{% endhint %}

### Updating File Metadata

To modify metadata or fix fields on an existing file entry, pass the file ID and a dictionary of updated attributes to `update_file()` or `FM.update()`:

```python
from psytag.managers import FM, update_file

# Update SDS task name and custom extra metadata
FM.update(new_file.id, {
    "task": "StructuredPlay",
    "extra": {
        "camera_angle": "front",
        "lighting": "adjusted"
    }
})
# update_file(new_file.id, {"task": "StructuredPlay"})
```

### Deleting Files

To delete a file entry from the database, pass its ID to `delete_file()` or `FM.delete()`. Note that calling `delete_file()` removes the `File` record from the Psytag database so that it is no longer accessible via the API, but it does not automatically delete the raw media file from the server disk storage.

```python
from psytag.managers import FM, delete_file

# Delete the file record from database
FM.delete(new_file.id)
# delete_file(new_file.id)
```

{% hint style="danger" %}
Please use the delete function with caution. Deleting a file is irreversible, and Psytag will not prompt you for confirmation before proceeding.
{% endhint %}
