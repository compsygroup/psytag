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

In Psytag, raw media assets—such as video, audio, or image files—are stored as _Files_. A file represents the underlying raw media, whereas a _Task_ represents the specific assignment linking a file to a project and its questions. When you upload media into a project via the Psytag user interface, the system processes each file and automatically creates a corresponding task for annotators to review.

### Uploading Files via User Interface

Through the project management interface, project managers and administrators can add media files to a project.

<figure><img src="../.gitbook/assets/edit_project_tasks.png" alt=""><figcaption></figcaption></figure>

You can upload media in two ways:

* **Individual Files**: Select one or more specific media files directly from your local computer.
* **Directory Upload**: Select an entire local directory. Psytag scans the folder and uploads all contained media files at once.

For each uploaded media file, Psytag automatically creates an active task within the current project.

### Deduplication & File Management System

Psytag features a built-in file management system that prevents duplicate media storage across the application. While the web user interface abstracts this layer, deduplication works automatically in the background. When a file is uploaded, the backend computes its SHA-256 checksum. Psytag then checks the database to verify whether an existing file with the exact same checksum has already been ingested. If a matching checksum is found, the backend avoids uploading the file redundantly. Instead, it returns the existing file ID and attaches it to the newly created task. This architecture ensures that while each task is treated as a distinct unit of work, a single media asset can be safely reused across multiple tasks or projects without consuming additional storage space. Advanced users can interact with this deduplication and file-linking mechanism directly using the Psytag Python client.

### Metadata Management

Although the web interface currently handles basic uploads without exposed metadata fields, Psytag includes a metadata management system accessible via the Python client. Psytag follows the _Sensor Data Structure (SDS)_ metadata schema, allowing rich research context to be attached to individual files. Standard metadata fields include:

* Study & Subject: Identify the research study protocol/name and participant ID.
* Session & Acquisition: Track specific recording sessions, visits, or acquisition setups.
* Task, Condition & Run: Specify the experimental task, experimental arm/condition, and trial run number.
* Target, Device & Channel: Log hardware details, target individual, and sensor channel IDs.

In addition to standard SDS attributes, users can store custom key-value pairs under the `extra` metadata field. When project managers download project annotations as a CSV file, these SDS and custom metadata fields are expanded directly into the exported dataset, ensuring complete traceability back to the source media.

{% hint style="warning" %}
Metadata management currently only available through Python client and cannot be used through the web app UI.
{% endhint %}

### Optimization, Web Delivery & Server Resources

Because Psytag is a web application, media files must be streamed smoothly over HTTP to annotators' web browsers. Project managers should keep file size, web performance, and hosting costs in mind when preparing dataset media:

* **Media Compression**: Large, uncompressed raw video files can lead to buffering delays and high network bandwidth consumption. Compress video files using web-friendly codecs (such as H.264/MP4) prior to upload to ensure fast loading times for remote annotators.
* **Precomputed Waveforms**: During the upload and ingestion process, Psytag processes audio and video media to extract and precompute waveform data. These precomputed waveforms allow the frontend interactive timelines (`mediatimeline` and `mediatimestamp`) to render instant audio visualizer tracks without requiring client-side computation.
* **Server Resource Requirements**: Waveform generation relies on backend processing tasks (utilizing FFmpeg/Librosa routines). Server environments hosting the Psytag API backend should be provisioned with sufficient CPU and memory resources to handle concurrent media ingest and waveform extraction efficiently.
