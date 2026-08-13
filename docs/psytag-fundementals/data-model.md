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

# Data Model

<h2 align="center">Data Model</h2>

To use Psytag effectively, it helps to understand its core structure and terminology. Psytag is built around a few central concepts that work together to manage data, organize annotation tasks, and ensure high data quality across your team. Below is an overview of the primary components of Psytag and how they relate to one another.

### Files

A File is a raw media asset stored in Psytag. This can be a video, an audio recording, or an image. Files represent the underlying research media that you want your team to inspect and label. When you upload media to Psytag, the system stores the raw asset on the server and tracks its technical metadata (such as file size, format, and modality) in the system database.

### Projects

A Project is the main organizational container for your research study. It holds all the configurations, questions, team members, and tasks associated with a specific study. For example, if you are running a study on parent-child interactions, you would create a single project named "Parent-Child Interaction Study". Within a project, you define:

* The basic settings (such as the project name, description, and required number of annotators per media item).
* The team members who have access to the study.
* The specific questions or labeling forms shown to annotators.
* The adjudication rules used to resolve disagreements.

### Questions

A Question defines a single data entry field or labeling tool within a project. Each question has a label (what the annotator reads, such as _"Is the participant smiling?"_), a unique variable name (how the response is saved in your dataset, such as `participant_smile`), and a question type.

Psytag supports standard form questions—such as text boxes, radio buttons, checkboxes, dropdowns, and rating scales—as well as specialized behavioral labeling tools like event timelines and event timestamps for tracking behaviors over time. You can add multiple questions to a project and arrange them across a three-column layout relative to the media player.

### Tasks

A Task is an individual unit of work presented to an annotator. In Psytag, a task links a specific File to a Project. When you upload a folder of 50 video files into a project, Psytag automatically creates 50 separate tasks. When an annotator opens a project, the system picks a task for them to review, loading the corresponding media file alongside the project's set of questions.

### Annotators (Users)

Annotators are the team members (such as research assistants or clinical coders) assigned to review tasks and answer questions.\
In Psytag, users can have different roles:

* Annotators (Regular Users): Can log in, open assigned projects, and annotate tasks.
* Project Managers: Can create projects, edit project layouts, manage assigned users, upload tasks, and download completed annotations for their projects.
* System Admins: Have full administrative access across the entire system and all projects.

### Annotations

An Annotation is a single completed response submitted by an annotator for a specific task. It contains the answers to all the project's questions for that media file, along with metadata such as who completed it, the time it was submitted, and whether it is marked as complete or saved as a draft for later.

If a project requires 2 annotators per task, a single task will eventually have 2 separate annotations associated with it—one from each annotator.

### Adjudication

Adjudication is the quality-control process used to resolve disagreements when multiple annotators label the same task.

You can configure automated adjudication rules for a project. For instance, if two annotators provide different answers for a critical question, Psytag flags the task as needing adjudication and routes it to an adjudicator (a third user or project manager). The adjudicator reviews the task—and optionally inspects the previous conflicting responses—to make the final, definitive annotation.

### How Everything Fits Together

To summarize the workflow:

1. You create a Project for your research study and define its Questions.
2. You upload media Files, which Psytag automatically turns into Tasks within that project.
3. You assign Annotators to the project.
4. Annotators log in, open the project, view the Tasks, and submit their Annotations.
5. If responses conflict according to your Adjudication rules, the task is automatically flagged for an adjudicator to resolve.
