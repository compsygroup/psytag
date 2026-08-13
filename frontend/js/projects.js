async function loadProjects() {
    Navigation.setPage(loadProjects);

    const content = document.getElementById('content');
    content.innerHTML = "Loading...";

    // fetch projects
    const projects = await fetchResponse("projects", "GET");

    // fetch whether user is an admin
    const user = await fetchResponse("users/my.info", "GET"); // user info
    const isAdmin = user.admin;

    content.innerHTML = "";
    
    // --- Projects Container ---
    const projectsContainer = document.createElement('div');
    projectsContainer.className = 'container-fluid px-2';
    content.appendChild(projectsContainer);
    
    const projectsRow = document.createElement('div');
    projectsRow.className = 'row g-4 pb-4'; 
    projectsContainer.appendChild(projectsRow);
    
    // add project cards
    for (const proj of projects) {
        if (!proj.active) {
            continue; // skip inactive projects
        }

        // check if user is manager for this project
        const isManager = await fetchResponse(`projects/${proj.id}/is_manager`, "GET");

        // create a column for each project (Max 2 per row on large screens)
        const projectCol = document.createElement('div');
        projectCol.className = 'col-12 col-md-6 col-lg-4 col-xl-3';
        projectsRow.appendChild(projectCol);
        
        // Outer Card
        const projectCard = document.createElement('div');
        // project-card-info class triggers your CSS hover effect
        projectCard.className = 'card shadow-sm h-100 border-0 project-card-info';
        projectCard.style.borderRadius = '12px';
        projectCard.style.cursor = 'pointer';
        
        // Make the entire card clickable to load the task
        projectCard.onclick = function() { loadNextTask(proj.id); };

        const cardBody = document.createElement('div');
        cardBody.className = 'card-body p-4 d-flex flex-column';

        // --- Title and Description ---
        const projectTitle = document.createElement('h5'); 
        projectTitle.textContent = proj.name;
        projectTitle.className = 'fw-bold text-dark mb-2';
        
        const projectDesc = document.createElement('p'); 
        projectDesc.className = 'card-text text-muted mb-0 flex-grow-1';
        projectDesc.textContent = proj.description;
        
        cardBody.appendChild(projectTitle);
        cardBody.appendChild(projectDesc);
        projectCard.appendChild(cardBody);

        // --- Footer: Download Button ---
        if (isAdmin || isManager) {
            const projectFooter = document.createElement('div');
            // Transparent footer to blend with the card, pushing content right
            projectFooter.className = 'card-footer bg-transparent border-top-0 d-flex justify-content-end p-3 pt-0';
            
            const downloadButton = document.createElement('button');
            downloadButton.className = 'btn btn-outline-primary btn-sm material-btn text-nowrap';
            downloadButton.textContent = 'Download Annotations';
            
            // Stop propagation so clicking the button doesn't trigger the card's loadNextTask click event
            downloadButton.onclick = function(e) { 
                e.stopPropagation(); 
                downloadAnnotations(proj.id); 
            };
            
            projectFooter.appendChild(downloadButton);
            projectCard.appendChild(projectFooter);
        }
        
        projectCol.appendChild(projectCard);
    }
}

async function loadNextTask(project_id) {
    Navigation.setPage(loadNextTask, project_id);  // <-- set current page
   
    // prepare containers
    const mainContainer = document.getElementById('content');
    mainContainer.innerHTML = "";
    
    // main annotation container
    const annotationContainer = document.createElement('div');
    annotationContainer.className = 'annotation-main-container container-fluid d-flex h-100 align-items-center justify-content-center';
    mainContainer.appendChild(annotationContainer);

    const content = document.createElement('div');
    content.style.position = "relative";
    annotationContainer.appendChild(content);
    content.innerHTML = "Loading...";

    // fetch next task
    const task = await fetchResponse(`tasks/pick/${project_id}`, "GET");
    
    if (!task || (typeof task === "object" && "data" in task && task.data === null)) {
        content.innerHTML = "<h3>All tasks are annotated. No tasks available</h3>";
        return;
    }

    content.innerHTML = "";

    // adjudication notice, if needed
    if (task && task.annotations_to_adjudicate && task.annotations_to_adjudicate.length > 0) {
        const adjudicationNotice = document.createElement('p');
        adjudicationNotice.setAttribute("class", "adjudication-notice");
        adjudicationNotice.innerHTML = "<strong>Note:</strong> You are adjudicating previous annotations for this task. Please review the earlier annotations and provide your final decisions.";
        content.appendChild(adjudicationNotice);
        content.appendChild(document.createElement("br"));
    }

    // render form questions
    renderForm(content, task);

    // @TODO: load project specific rendering script
    // const script = document.createElement('script'); // project specific rendering script, if exists
    // script.src = `js/projects/project_${project_id}.js`;
    // script.onload = () => {
    //     console.log(`Loaded project script: ${project_id}`);
    // };
    // script.onerror = () => {
    //     // Fallback to generic script if project-specific script not found
    //     script.remove();
    //     renderForm(content, task);
    // };
    // document.body.appendChild(script);
}

async function manageProjects() {
    Navigation.setPage(manageProjects);  // <-- set current page

    const user = await fetchResponse("users/my.info", "GET"); // user info

    const content = document.getElementById('content');
    content.innerHTML = "Loading...";

    // fetch projects
    const projects = await fetchResponse("projects", "GET");

    // order projects by active first, then by user_id, then by date_created descending
    projects.sort((a, b) => {
        if (a.active !== b.active) {
            return a.active ? -1 : 1;
        }
        if (a.user_id !== b.user_id) {
            return a.user_id < b.user_id ? -1 : 1;
        }
        return new Date(b.date_created) - new Date(a.date_created);
    });

    content.innerHTML = "";

    // --- Header Section ---
    const headerDiv = document.createElement('div');
    headerDiv.className = 'd-flex justify-content-between align-items-center mb-4 mt-2 px-2';

    const newProjectButton = document.createElement('button');
    newProjectButton.textContent = '+ New Project';
    newProjectButton.className = 'btn btn-success material-btn px-4 shadow-sm';
    newProjectButton.onclick = () => { editProjectInfo(); };
    headerDiv.appendChild(newProjectButton);

    content.appendChild(headerDiv);

    // --- Project List Container (Grid System) ---
    const listContainer = document.createElement('div');
    listContainer.className = 'row g-4 pb-4 px-2'; // Bootstrap row with gaps
    content.appendChild(listContainer);

    // list all projects
    for (const proj of projects) {
        // if user is not an admin and not in proj.managers then don't list
        if (!user.admin && !proj.managers.includes(user.id)) {
            continue;
        }

        // Grid Column (max 2 per row on large screens)
        const projectCol = document.createElement('div');
        projectCol.className = 'col-12 col-xl-6';

        // Outer Project Card
        const projectCard = document.createElement('div');
        projectCard.className = `card shadow-sm border-0 h-100 ${!proj.active ? 'opacity-75 bg-light' : ''}`;
        projectCard.style.borderRadius = '12px';

        const cardBody = document.createElement('div');
        cardBody.className = 'card-body p-4 d-flex flex-column';

        // --- Top Section: Title & Actions ---
        const topSection = document.createElement('div');
        // Flex row on large screens, stack vertically on mobile
        topSection.className = 'd-flex flex-column flex-md-row justify-content-between align-items-md-start gap-3 mb-3';

        const titleArea = document.createElement('div');
        const nameHeader = document.createElement('h5');
        nameHeader.className = 'fw-bold mb-0 text-dark';
        nameHeader.textContent = proj.name;
        
        if (!proj.active) {
            const inactiveBadge = document.createElement('span');
            inactiveBadge.className = 'badge bg-secondary ms-2 align-middle fs-6';
            inactiveBadge.textContent = 'Inactive';
            nameHeader.appendChild(inactiveBadge);
        }
        titleArea.appendChild(nameHeader);
        topSection.appendChild(titleArea);

        // Action Buttons Array (Next to Title)
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'd-flex flex-wrap gap-2 justify-content-md-end';

        // Helper to quickly generate identically-styled utility buttons
        const createActionBtn = (text, onClick, btnClass = 'btn-outline-primary') => {
            const btn = document.createElement('button');
            btn.textContent = text;
            btn.className = `btn ${btnClass} btn-sm material-btn`;
            btn.style.padding = "4px 8px"; // Tighter padding for narrow layout
            btn.onclick = onClick;
            return btn;
        };

        actionsDiv.appendChild(createActionBtn('Info', () => editProjectInfo(proj.id)));
        actionsDiv.appendChild(createActionBtn('Users', () => editProjectUsers(proj.id)));
        actionsDiv.appendChild(createActionBtn('Questions', () => editProjectQuestions(proj.id)));
        actionsDiv.appendChild(createActionBtn('Adjudication', () => editProjectAdjudication(proj.id)));
        actionsDiv.appendChild(createActionBtn('Tasks', () => editProjectTasks(proj.id)));

        // Toggle Active/Deactivate Button
        const activateButton = document.createElement('button');
        activateButton.textContent = proj.active ? 'Deactivate' : 'Activate';
        activateButton.className = `btn ${proj.active ? 'btn-danger' : 'btn-success'} btn-sm material-btn`;
        activateButton.style.padding = "4px 8px";
        activateButton.onclick = async () => {
            await fetchResponse(`projects/${proj.id}/toggle`, "POST");
            manageProjects();
        };
        actionsDiv.appendChild(activateButton);

        topSection.appendChild(actionsDiv);
        cardBody.appendChild(topSection);

        // --- Middle: Description ---
        const descText = document.createElement('p');
        // flex-grow-1 pushes the footer metadata down so grid cards align perfectly in height
        descText.className = 'text-muted mb-4 flex-grow-1'; 
        descText.textContent = proj.description;
        cardBody.appendChild(descText);

        // --- Bottom: Metadata ---
        const owner = await fetchResponse(`users/${proj.user_id}`, "GET");
        const metaText = document.createElement('div');
        metaText.className = 'text-secondary small d-flex flex-wrap gap-4 mt-auto border-top pt-3';
        
        const ownerSpan = document.createElement('span');
        ownerSpan.innerHTML = `<strong>Owner:</strong> ${owner.fullname}`;
        
        const dateSpan = document.createElement('span');
        const creationDate = new Date(proj.date_created);
        dateSpan.innerHTML = `<strong>Created:</strong> ${creationDate.toLocaleDateString()} ${creationDate.toLocaleTimeString()}`;
        
        metaText.appendChild(ownerSpan);
        metaText.appendChild(dateSpan);
        cardBody.appendChild(metaText);

        projectCard.appendChild(cardBody);
        projectCol.appendChild(projectCard);
        listContainer.appendChild(projectCol);
    }
}  


// function to edit an existing project or create a new one
// function to edit an existing project or create a new one
async function editProjectInfo(projectId=null) {
    Navigation.setPage(editProjectInfo, projectId);  // <-- set current page

    const content = document.getElementById('content');
    content.innerHTML = "Loading...";

    // fetch project details if editing an existing one
    var project = {};
    if (projectId !== null) {
        project = await fetchResponse(`projects/${projectId}`, "GET");
    } else {
        project = {
            name: "",
            description: "",
            active: true,
            num_annotators: 2
        };
    }

    content.innerHTML = "";
    
    // Outer Material-style Card
    const cardBox = document.createElement('div');
    cardBox.className = "card material-card shadow-sm mx-auto my-4";
    cardBox.style.maxWidth = "800px"; 

    const cardBody = document.createElement('div');
    cardBody.className = "card-body p-4";

    // Header & Navigation Container
    const headerContainer = document.createElement('div');
    headerContainer.className = "d-flex justify-content-between align-items-center mb-4 border-bottom pb-3";
    
    const title = document.createElement('h5');
    title.className = "m-0 text-dark fw-bold";
    title.textContent = projectId ? "Edit Project Info" : "Create New Project";
    headerContainer.appendChild(title);

    const backButton = document.createElement('button');
    backButton.textContent = '← Back to Projects';
    backButton.className = 'btn btn-outline-secondary btn-sm material-btn';
    backButton.onclick = () => { Navigation.back(); };
    headerContainer.appendChild(backButton);

    cardBody.appendChild(headerContainer);

    // Main editing form
    const formElement = document.createElement('form');
    formElement.id = "editProjectForm";

    const formRow = document.createElement('div');
    formRow.className = "row";

    // --- Column 1: Text Fields ---
    const col1 = document.createElement('div');
    col1.className = "col-md-8 pe-md-4";

    // Helper to generate fixed-label form groups
    function createFormGroup(id, type, labelText, placeholderText, isRequired = false, value = "") {
        const group = document.createElement('div');
        group.className = "form-group material-group position-relative mb-4";

        const input = document.createElement('input');
        input.type = type;
        input.id = id;
        input.name = id;
        input.className = "form-control material-input";
        input.placeholder = placeholderText;
        input.required = isRequired;
        if (value) input.value = value;

        const label = document.createElement('label');
        label.htmlFor = id;
        label.className = "material-label fixed-label";
        label.textContent = labelText;

        group.appendChild(input);
        group.appendChild(label);
        return group;
    }

    col1.appendChild(createFormGroup("name", "text", "Project Name", "Project Name", true, project.name));

    // Textarea for description
    const descGroup = document.createElement('div');
    descGroup.className = "form-group material-group position-relative mb-4 mt-4";

    const descInput = document.createElement('textarea');
    descInput.name = "description";
    descInput.id = "description";
    descInput.className = "form-control material-input pt-3";
    descInput.placeholder = "Project Description";
    descInput.value = project.description || "";
    descInput.rows = 4;
    descInput.style.height = "auto";

    const descLabel = document.createElement('label');
    descLabel.htmlFor = "description";
    descLabel.className = "material-label fixed-label bg-white px-1";
    descLabel.textContent = "Project Description";

    descGroup.appendChild(descInput);
    descGroup.appendChild(descLabel);
    col1.appendChild(descGroup);

    formRow.appendChild(col1);

    // --- Column 2: Settings / Toggles ---
    const col2 = document.createElement('div');
    col2.className = "col-md-4 border-start ps-md-4 mt-4 mt-md-0";

    const settingsHeader = document.createElement('h6');
    settingsHeader.className = "text-muted font-weight-bold mb-3";
    settingsHeader.textContent = "Settings";
    col2.appendChild(settingsHeader);

    // Number of Annotators Input
    col2.appendChild(createFormGroup("num_annotators", "number", "Number of Annotators", "2", true, project.num_annotators));
    // Set min/max for the number input
    setTimeout(() => {
        const numInput = document.getElementById("num_annotators");
        if (numInput) {
            numInput.min = "1";
            numInput.max = "5";
        }
    }, 0);

    // Active Toggle Switch
    const switchWrapper = document.createElement('div');
    switchWrapper.className = "form-check form-switch mt-4 mb-3";

    const activeInput = document.createElement('input');
    activeInput.className = "form-check-input";
    activeInput.type = "checkbox";
    activeInput.id = "active";
    activeInput.name = "active";
    activeInput.checked = project.active;
    activeInput.style.cursor = "pointer";

    const activeLabel = document.createElement('label');
    activeLabel.className = "form-check-label";
    activeLabel.htmlFor = "active";
    activeLabel.textContent = "Project Active";
    activeLabel.style.cursor = "pointer";

    switchWrapper.appendChild(activeInput);
    switchWrapper.appendChild(activeLabel);
    col2.appendChild(switchWrapper);

    formRow.appendChild(col2);
    formElement.appendChild(formRow);

    // --- Submit Button ---
    const buttonContainer = document.createElement('div');
    buttonContainer.className = "d-flex justify-content-end gap-2 mt-4 pt-3 border-top";

    const submitButton = document.createElement('button');
    submitButton.className = projectId === null ? 'btn btn-success material-btn ripple px-4 py-2' : 'btn btn-primary material-btn ripple px-4 py-2';
    submitButton.textContent = projectId === null ? 'Create Project' : 'Save Changes';

    submitButton.onclick = async (e) => {
        e.preventDefault();
        
        // collect updated data
        const updatedProject = {
            name: document.getElementById('name').value.trim(),
            description: document.getElementById('description').value.trim(),
            active: document.getElementById('active').checked,
            num_annotators: document.getElementById('num_annotators').value
        };
        
        let response;
        let word_success;
        let word_failure;
        let control;

        // send update request
        if (projectId === null) {
            response = await fetchResponse(`projects`, "POST", updatedProject);
            word_success = "created";
            word_failure = "creating";
            control = (response !== null && response !== undefined);
        } else {
            response = await fetchResponse(`projects/${projectId}`, "PUT", updatedProject);
            word_success = "updated";
            word_failure = "updating";
            control = (response !== null && response !== undefined && typeof response === "object" && "status" in response && response.status === "success");
        }
        
        // Display message and take action
        const messages = document.getElementById('message-area');
        if (control) {
            messages.innerHTML = `<div class='alert alert-success'>Project ${word_success} successfully!</div>`;
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            setTimeout(() => {
                // Reload current page
                Navigation.reload();
            }, 2000);
        } else { 
            // display content of response as error
            if (typeof response === "object" && "error" in response) {
                messages.innerHTML = `<div class='alert alert-danger'>Error ${word_failure} project!<br />${response.error}</div>`;
            } else {
                messages.innerHTML = `<div class='alert alert-danger'>Error ${word_failure} project!</div>`;
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
    
    buttonContainer.appendChild(submitButton);
    formElement.appendChild(buttonContainer);

    cardBody.appendChild(formElement);
    cardBox.appendChild(cardBody);
    content.appendChild(cardBox);
}


async function editProjectUsers(projectId) {
    Navigation.setPage(editProjectUsers, projectId);  // <-- set current page

    const content = document.getElementById('content');
    content.innerHTML = "Loading...";

    // fetch project details and all users
    const project = await fetchResponse(`projects/${projectId}`, "GET");
    const all_users = await fetchResponse("users", "GET");

    content.innerHTML = "";

    // Outer Material-style Card
    const cardBox = document.createElement('div');
    cardBox.className = "card material-card shadow-sm mx-auto my-4";
    cardBox.style.maxWidth = "900px"; // Slightly wider to accommodate two lists side-by-side

    const cardBody = document.createElement('div');
    cardBody.className = "card-body p-4";

    // Header & Navigation Container
    const headerContainer = document.createElement('div');
    headerContainer.className = "d-flex justify-content-between align-items-md-center flex-column flex-md-row mb-4 border-bottom pb-3 gap-3";
    
    const titleArea = document.createElement('div');
    const title = document.createElement('h5');
    title.className = "m-0 text-dark fw-bold";
    title.textContent = "Manage Access";
    titleArea.appendChild(title);
    
    const projName = document.createElement('div');
    projName.className = "text-muted small mt-1";
    projName.textContent = `Project: ${project.name}`;
    titleArea.appendChild(projName);

    headerContainer.appendChild(titleArea);

    const backButton = document.createElement('button');
    backButton.textContent = '← Back to Projects';
    backButton.className = 'btn btn-outline-secondary btn-sm material-btn align-self-md-start';
    backButton.onclick = () => { Navigation.back(); };
    headerContainer.appendChild(backButton);

    cardBody.appendChild(headerContainer);

    // Grid for Managers (Left) and Users (Right)
    const rowDiv = document.createElement('div');
    rowDiv.className = "row g-4 mt-2";

    // Loop over roles (Ordered Managers first, then Users)
    for (const role of ["managers", "users"]) {
        const isManager = (role === "managers");
        const roleTitle = isManager ? "Managers" : "Annotators (Users)";
        
        const colDiv = document.createElement('div');
        colDiv.className = "col-12 col-md-6";
        
        const listHeader = document.createElement('h6');
        listHeader.className = "font-weight-bold text-dark mb-3";
        listHeader.textContent = `Assigned ${roleTitle}`;
        colDiv.appendChild(listHeader);

        // List Group for currently assigned users
        const assignedUsersList = document.createElement('ul');
        assignedUsersList.className = "list-group mb-3 shadow-sm";
        assignedUsersList.style.borderRadius = "8px";

        if (project[role].length === 0) {
            const emptyState = document.createElement('li');
            emptyState.className = "list-group-item text-muted text-center fst-italic py-3 bg-light";
            emptyState.textContent = `No ${roleTitle.toLowerCase()} assigned.`;
            assignedUsersList.appendChild(emptyState);
        } else {
            for (const userID of project[role]) {
                const user = all_users.find(u => u.id === userID);
                if (!user) continue;

                const userItem = document.createElement('li');
                userItem.className = "list-group-item d-flex justify-content-between align-items-center";
                
                const userInfo = document.createElement('div');
                userInfo.className = "d-flex flex-column";
                
                const userNameSpan = document.createElement('span');
                userNameSpan.className = "fw-bold text-dark fs-6";
                userNameSpan.textContent = user.fullname;
                
                const userMetaSpan = document.createElement('span');
                userMetaSpan.className = "text-muted";
                userMetaSpan.style.fontSize = "0.75rem";
                userMetaSpan.textContent = `${user.username} | ${user.email}`;
                
                userInfo.appendChild(userNameSpan);
                userInfo.appendChild(userMetaSpan);
                userItem.appendChild(userInfo);

                // Remove button
                const removeButton = document.createElement('button');
                removeButton.textContent = 'Remove';
                removeButton.className = 'btn btn-outline-danger btn-sm material-btn ms-3';
                removeButton.style.padding = "2px 8px";
                removeButton.onclick = async () => {
                    await fetchResponse(`projects/${projectId}/users`, "PUT", { user_id: user.id, action: "remove", manager: isManager });
                    editProjectUsers(projectId); // Reload the current view
                };
                
                userItem.appendChild(removeButton);
                assignedUsersList.appendChild(userItem);
            }
        }
        colDiv.appendChild(assignedUsersList);

        // Dropdown to add new users
        const addContainer = document.createElement('div');
        addContainer.className = "form-group material-group position-relative mt-2";
        
        const addUserSelect = document.createElement('select');
        addUserSelect.className = "form-select material-input";
        
        const defaultOption = document.createElement('option');
        defaultOption.textContent = `+ Assign New ${isManager ? "Manager" : "User"}`;
        defaultOption.value = "";
        defaultOption.disabled = true;
        defaultOption.selected = true;
        addUserSelect.appendChild(defaultOption);
        
        // List only users not already assigned to this role
        let availableCount = 0;
        for (const user of all_users) {
            if (!project[role].includes(user.id)) {
                const userOption = document.createElement('option');
                userOption.value = user.id;
                userOption.textContent = `${user.fullname} (${user.username})`;
                addUserSelect.appendChild(userOption);
                availableCount++;
            }
        }

        if (availableCount === 0) {
            defaultOption.textContent = "All available users assigned";
            addUserSelect.disabled = true;
        }

        // On change, assign the selected user immediately
        addUserSelect.onchange = async () => {
            const selectedUserId = addUserSelect.value;
            if (selectedUserId) {
                await fetchResponse(`projects/${projectId}/users`, "PUT", { user_id: selectedUserId, action: "add", manager: isManager });
                editProjectUsers(projectId); // Reload the current view
            }
        };

        addContainer.appendChild(addUserSelect);
        colDiv.appendChild(addContainer);

        rowDiv.appendChild(colDiv);
    }

    cardBody.appendChild(rowDiv);
    cardBox.appendChild(cardBody);
    content.appendChild(cardBox);
}


// global interface object that will hold all questions for the project
var interface = {
    questions: [],

    addQuestion: function(question) {
        this.questions.push(question);
        this.render();
    },

    updateQuestion: function(index, updatedQuestion) {
        this.questions[index] = updatedQuestion;
        this.render();
    },

    deleteQuestion: function(index) {
        this.questions.splice(index, 1);
        this.render();
    },

    moveQuestionUp: function(index) {
        if (index > 0) {
            const question = this.questions[index];
            this.questions.splice(index, 1);
            this.questions.splice(index - 1, 0, question);
            this.render();
        }
    },

    moveQuestionDown: function(index) {
        if (index < this.questions.length - 1) {
            const question = this.questions[index];
            this.questions.splice(index, 1);
            this.questions.splice(index + 1, 0, question);
            this.render();
        }
    },

    moveQuestionLeft: function(index) {
        const positions = ["left", "middle", "right"];
        const currentPosition = this.questions[index].position || "middle";
        const currentIdx = positions.indexOf(currentPosition);
        if (currentIdx > 0) {
            this.questions[index].position = positions[currentIdx - 1];
            this.render();
        }
    },

    moveQuestionRight: function(index) {
        const positions = ["left", "middle", "right"];
        const currentPosition = this.questions[index].position || "middle";
        const currentIdx = positions.indexOf(currentPosition);
        if (currentIdx < positions.length - 1) {
            this.questions[index].position = positions[currentIdx + 1];
            this.render();
        }
    },

    render: function() {
        const displayArea = document.getElementById('rendered-questions-container');
        const questionsJSONContainer = document.getElementById('questions-json-container');
        if (questionsJSONContainer) {
            questionsJSONContainer.innerHTML = `<pre>${JSON.stringify(this.questions, null, 2)}</pre>`;
        }

        displayArea.innerHTML = "";

        const table = document.createElement('table');
        table.className = "table table-bordered bg-white shadow-sm mt-3";
        table.style.borderRadius = "8px";
        table.style.overflow = "hidden";
        table.style.tableLayout = "fixed";
        
        const tbody = document.createElement('tbody');
        const row = document.createElement('tr');
        
        const leftCol = document.createElement('td');
        const middleCol = document.createElement('td');
        const rightCol = document.createElement('td');
        
        [leftCol, middleCol, rightCol].forEach(col => {
            col.className = "p-2 align-top"; 
            col.style.width = "33.33%";
        });

        row.appendChild(leftCol);
        row.appendChild(middleCol);
        row.appendChild(rightCol);
        tbody.appendChild(row);
        table.appendChild(tbody);
        displayArea.appendChild(table);

        if (!this.questions) return;

        var hasMediaEvents = false;
        for (const question of this.questions) {
            if ((question.type === "mediatimeline") || (question.type === "mediatimestamp")) {
                hasMediaEvents = true;
                break;
            }
        }

        if (!hasMediaEvents) {
            const videoThumbnail = document.createElement('img');
            videoThumbnail.src = "img/video_thumbnail.png";
            videoThumbnail.className = "img-fluid mb-2 rounded shadow-sm d-block mx-auto";
            videoThumbnail.style.maxHeight = "110px"; 
            middleCol.appendChild(videoThumbnail);
        }

        var questionIndex = 0; 
        for (const question of this.questions) {
            const questionElement = document.createElement('div');
            // Tighter padding (p-2) and margin (mb-3)
            questionElement.className = "mb-3 p-2 bg-light rounded border border-secondary border-opacity-25";

            // Header row with Label and Buttons
            const headerDiv = document.createElement('div');
            const controlsDiv = document.createElement('div');

            const createControlBtn = (text, btnClass, action) => {
                const btn = document.createElement('button');
                btn.textContent = text;
                btn.className = `btn ${btnClass}`;
                btn.style.padding = "1px 5px"; // Extra tight padding
                btn.style.fontSize = "0.7rem"; // Very small icon text
                btn.style.lineHeight = "1.2";
                btn.onclick = (e) => { e.preventDefault(); action(); };
                return btn;
            };

            const idx = questionIndex;
            controlsDiv.appendChild(createControlBtn('Edit', 'btn-outline-warning', () => _questionEditing(question.type, idx)));
            controlsDiv.appendChild(createControlBtn('−', 'btn-outline-danger', () => this.deleteQuestion(idx)));
            controlsDiv.appendChild(createControlBtn('↑', 'btn-outline-secondary', () => this.moveQuestionUp(idx)));
            controlsDiv.appendChild(createControlBtn('↓', 'btn-outline-secondary', () => this.moveQuestionDown(idx)));
            controlsDiv.appendChild(createControlBtn('←', 'btn-outline-secondary', () => this.moveQuestionLeft(idx)));
            controlsDiv.appendChild(createControlBtn('→', 'btn-outline-secondary', () => this.moveQuestionRight(idx)));

            headerDiv.appendChild(controlsDiv);
            
            const questionLabel = document.createElement('label');
            questionLabel.className = "text-dark m-0 pe-2";
            questionLabel.style.fontSize = "0.85rem"; // Scaled down label
            questionLabel.textContent = `${question.label} ${question.required ? '*' : ''}`;
            headerDiv.appendChild(questionLabel);

            questionElement.appendChild(headerDiv);

            // Input Preview
            const questionInputContainer = document.createElement('div');
            var questionInput;

            if (["checkbox", "radio"].includes(question.type)) {
                for (const option of question.options) {
                    const wrapper = document.createElement('div');
                    wrapper.className = "form-check mb-1"; 
                    
                    questionInput = document.createElement('input');
                    questionInput.className = "form-check-input";
                    questionInput.type = question.type;
                    questionInput.name = question.variable; 
                    
                    const optionLabel = document.createElement('label');
                    optionLabel.className = "form-check-label text-muted";
                    optionLabel.style.fontSize = "0.8rem"; 
                    optionLabel.textContent = option;
                    
                    wrapper.appendChild(questionInput);
                    wrapper.appendChild(optionLabel);
                    questionInputContainer.appendChild(wrapper);
                }
            }
            else if (question.type === "select") {
                questionInput = document.createElement('select');
                questionInput.className = "form-select form-select-sm text-muted";
                questionInput.style.fontSize = "0.8rem"; 
                questionInput.name = question.variable;
                for (const option of question.options) {
                    const optionElement = document.createElement('option');
                    optionElement.value = option;
                    optionElement.textContent = option;
                    questionInput.appendChild(optionElement);
                }
                questionInputContainer.appendChild(questionInput);
            }
            else if (question.type === "range") {
                questionInput = document.createElement('input');
                questionInput.className = "form-range";
                questionInput.type = "range";
                questionInput.min = question.min || 0;
                questionInput.max = question.max || 100;
                questionInput.step = question.step || 1;
                questionInputContainer.appendChild(questionInput);
            }
            else if (question.type === "textarea") {
                questionInput = document.createElement('textarea');
                questionInput.className = "form-control form-control-sm";
                questionInput.style.fontSize = "0.8rem";
                questionInput.rows = 2;
                questionInputContainer.appendChild(questionInput);
            }
            else if (question.type === "mediatimeline") {
                questionInput = document.createElement('img');
                questionInput.src = "img/audio_thumbnail.png";
                questionInput.className = "img-fluid rounded border mt-1";
                questionInput.style.maxHeight = "60px"; 
                questionInputContainer.appendChild(questionInput);
            }
            else if (question.type === "mediatimestamp") {
                questionInput = document.createElement('img');
                questionInput.src = "img/audio_thumbnail.png";
                questionInput.className = "img-fluid rounded border mt-1";
                questionInput.style.maxHeight = "60px"; 
                questionInputContainer.appendChild(questionInput);
            }
            else {
                questionInput = document.createElement('input');
                questionInput.className = "form-control form-control-sm";
                questionInput.style.fontSize = "0.8rem";
                questionInput.type = question.type;
                questionInputContainer.appendChild(questionInput);
            }
            
            questionElement.appendChild(questionInputContainer);

            const position = question.position || "middle";
            if (position === "left") leftCol.appendChild(questionElement);
            else if (position === "middle") middleCol.appendChild(questionElement);
            else rightCol.appendChild(questionElement);

            questionIndex++;
        }
    }
};

function _questionEditing(selectedType, questionIndex=null) {
    if (questionIndex !== null) {
        var question = interface.questions[questionIndex];
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const questionEditor = document.getElementById('question-details-container');
    questionEditor.style.display = "block"; 
    questionEditor.innerHTML = "";
    questionEditor.className = "card bg-light border-0 shadow-sm p-4 mt-3 mb-4";

    const editorHeader = document.createElement('h6');
    editorHeader.className = "fw-bold mb-3 text-dark border-bottom pb-2";
    editorHeader.textContent = questionIndex !== null ? "Edit Question Properties" : "Configure New Question";
    questionEditor.appendChild(editorHeader);

    const createFloatingInput = (id, type, labelText, value = "", placeholder = "") => {
        const group = document.createElement('div');
        group.className = "form-group material-group position-relative mb-3";

        const input = document.createElement('input');
        input.type = type;
        input.id = id;
        input.className = "form-control material-input bg-white";
        input.placeholder = placeholder || labelText;
        if (value) input.value = value;

        const label = document.createElement('label');
        label.htmlFor = id;
        label.className = "material-label fixed-label px-1 bg-white";
        label.textContent = labelText;

        group.appendChild(input);
        group.appendChild(label);
        return { group, input };
    };

    const row1 = document.createElement('div');
    row1.className = "row";

    // variable name input
    const varCol = document.createElement('div');
    varCol.className = "col-md-6";
    const varInputObj = createFloatingInput("qeditor_variable", "text", "Variable Name", questionIndex !== null ? question.variable : "", "e.g., age_input");
    varCol.appendChild(varInputObj.group);
    row1.appendChild(varCol);
    
    // question label input
    const labelCol = document.createElement('div');
    labelCol.className = "col-md-6";
    const labelInputObj = createFloatingInput("qeditor_label", "text", "Question Label", questionIndex !== null ? question.label : "", "e.g., What is your age?");
    labelCol.appendChild(labelInputObj.group);
    row1.appendChild(labelCol);

    questionEditor.appendChild(row1);

    const qeditor_variableInput = varInputObj.input;
    const qeditor_labelInput = labelInputObj.input;

    // required checkbox
    const reqWrapper = document.createElement('div');
    reqWrapper.className = "form-check form-switch mb-3 mt-1";
    const qeditor_requiredInput = document.createElement('input');
    qeditor_requiredInput.className = "form-check-input";
    qeditor_requiredInput.type = "checkbox";
    qeditor_requiredInput.id = "qeditor_required";
    if (questionIndex !== null) qeditor_requiredInput.checked = question.required || false;
    
    const reqLabel = document.createElement('label');
    reqLabel.className = "form-check-label ms-1";
    reqLabel.htmlFor = "qeditor_required";
    reqLabel.textContent = "Required Field";
    
    reqWrapper.appendChild(qeditor_requiredInput);
    reqWrapper.appendChild(reqLabel);
    questionEditor.appendChild(reqWrapper);

    // Options input for types that require it
    let qeditor_optionsInput;
    if (["checkbox", "radio", "select", "mediatimeline", "mediatimestamp", "range"].includes(selectedType)) {
        const optGroup = document.createElement('div');
        optGroup.className = "form-group material-group position-relative mb-3 mt-3";
        
        let labelTxt = "Options (one per line)";
        let placeHolderTxt = "Option 1\nOption 2\nOption 3";
        
        if (selectedType === "mediatimeline" || selectedType === "mediatimestamp") {
            labelTxt = "Event Labels (Optional, one per line)";
            placeHolderTxt = "Event 1\nEvent 2\nEvent 3";
        } else if (selectedType === "range") {
            labelTxt = "Labels (Optional, one per step)";
            placeHolderTxt = "Strongly Disagree\nDisagree\nNeutral\nAgree\nStrongly Agree";
        }

        qeditor_optionsInput = document.createElement('textarea');
        qeditor_optionsInput.className = "form-control material-input bg-white pt-3";
        qeditor_optionsInput.style.height = "auto";
        qeditor_optionsInput.rows = 4;
        qeditor_optionsInput.placeholder = placeHolderTxt;
        if (questionIndex !== null && question.options) {
            qeditor_optionsInput.value = question.options.join("\n") || "";
        }

        const optLabel = document.createElement('label');
        optLabel.className = "material-label fixed-label px-1 bg-white";
        optLabel.textContent = labelTxt;

        optGroup.appendChild(qeditor_optionsInput);
        optGroup.appendChild(optLabel);
        questionEditor.appendChild(optGroup);
    }

    // whether to create separate tracks for each options with media timeline
    let qeditor_separateInput;
    if (selectedType === "mediatimeline") {
        const separateWrapper = document.createElement('div');
        separateWrapper.className = "form-check form-switch mb-3 mt-1";
        qeditor_separateInput = document.createElement('input');
        qeditor_separateInput.className = "form-check-input";
        qeditor_separateInput.type = "checkbox";
        qeditor_separateInput.id = "qeditor_separate";
        if (questionIndex !== null) qeditor_separateInput.checked = question.separate_tracks || false;
        
        const separateLabel = document.createElement('label');
        separateLabel.className = "form-check-label ms-1";
        separateLabel.htmlFor = "qeditor_separate";
        separateLabel.textContent = "Create Separate a Track for Each Option";
        
        separateWrapper.appendChild(qeditor_separateInput);
        separateWrapper.appendChild(separateLabel);
        questionEditor.appendChild(separateWrapper);
    }

    // Extra Label Type and Options for Media Timeline
    let qeditor_extraTypeSelect;
    let extraOptionsGroup, qeditor_extraOptionsInput;
    let extraRangeRow, qeditor_extraMinInput, qeditor_extraMaxInput, qeditor_extraStepInput;
    if (selectedType === "mediatimeline") {
        const extraTypeGroup = document.createElement('div');
        extraTypeGroup.className = "form-group material-group position-relative mb-3 mt-3";

        qeditor_extraTypeSelect = document.createElement('select');
        qeditor_extraTypeSelect.className = "form-select material-input bg-white";
        qeditor_extraTypeSelect.id = "qeditor_extra_type";
        
        const types = [
            {val: "", text: "None"},
            {val: "text", text: "Simple Text Box"},
            {val: "textarea", text: "Text Area"},
            {val: "radio", text: "Radio (Single Select)"},
            {val: "checkbox", text: "Checkbox (Multi Select)"},
            {val: "range", text: "Likert Scale / Range"}
        ];
        
        types.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.val;
            opt.textContent = t.text;
            if (questionIndex !== null && question.extra_labels_type === t.val) opt.selected = true;
            qeditor_extraTypeSelect.appendChild(opt);
        });

        const extraTypeLabel = document.createElement('label');
        extraTypeLabel.className = "material-label fixed-label px-1 bg-white";
        extraTypeLabel.textContent = "Extra Label Type (Optional)";

        extraTypeGroup.appendChild(qeditor_extraTypeSelect);
        extraTypeGroup.appendChild(extraTypeLabel);
        questionEditor.appendChild(extraTypeGroup);

        const extraDynamicContainer = document.createElement('div');
        questionEditor.appendChild(extraDynamicContainer);

        extraOptionsGroup = document.createElement('div');
        extraOptionsGroup.className = "form-group material-group position-relative mb-3 mt-3";
        extraOptionsGroup.style.display = "none";
        
        qeditor_extraOptionsInput = document.createElement('textarea');
        qeditor_extraOptionsInput.className = "form-control material-input bg-white pt-3";
        qeditor_extraOptionsInput.rows = 3;
        qeditor_extraOptionsInput.style.height = "auto";
        qeditor_extraOptionsInput.placeholder = "Extra Option 1\nExtra Option 2";
        
        if (questionIndex !== null && Array.isArray(question.extra_labels) && ["radio", "checkbox"].includes(question.extra_labels_type)) {
            qeditor_extraOptionsInput.value = question.extra_labels.join("\n");
        }

        const extraOptLabel = document.createElement('label');
        extraOptLabel.className = "material-label fixed-label px-1 bg-white";
        extraOptLabel.textContent = "Extra Options (one per line)";

        extraOptionsGroup.appendChild(qeditor_extraOptionsInput);
        extraOptionsGroup.appendChild(extraOptLabel);
        extraDynamicContainer.appendChild(extraOptionsGroup);

        extraRangeRow = document.createElement('div');
        extraRangeRow.className = "row mt-3";
        extraRangeRow.style.display = "none";

        const eMinCol = document.createElement('div'); eMinCol.className = "col-4";
        const eMinObj = createFloatingInput("qeditor_extra_min", "number", "Min", "");
        eMinCol.appendChild(eMinObj.group);
        qeditor_extraMinInput = eMinObj.input;

        const eMaxCol = document.createElement('div'); eMaxCol.className = "col-4";
        const eMaxObj = createFloatingInput("qeditor_extra_max", "number", "Max", "");
        eMaxCol.appendChild(eMaxObj.group);
        qeditor_extraMaxInput = eMaxObj.input;

        const eStepCol = document.createElement('div'); eStepCol.className = "col-4";
        const eStepObj = createFloatingInput("qeditor_extra_step", "number", "Step", "");
        eStepCol.appendChild(eStepObj.group);
        qeditor_extraStepInput = eStepObj.input;

        extraRangeRow.appendChild(eMinCol);
        extraRangeRow.appendChild(eMaxCol);
        extraRangeRow.appendChild(eStepCol);
        extraDynamicContainer.appendChild(extraRangeRow);

        if (questionIndex !== null && question.extra_labels_type === "range" && Array.isArray(question.extra_labels)) {
            qeditor_extraMinInput.value = question.extra_labels[0] || "";
            qeditor_extraMaxInput.value = question.extra_labels[1] || "";
            qeditor_extraStepInput.value = question.extra_labels[2] || "";
        }

        qeditor_extraTypeSelect.addEventListener('change', () => {
            const val = qeditor_extraTypeSelect.value;
            extraOptionsGroup.style.display = ["radio", "checkbox"].includes(val) ? "block" : "none";
            extraRangeRow.style.display = val === "range" ? "flex" : "none";
        });
        qeditor_extraTypeSelect.dispatchEvent(new Event('change'));
    }

    // Range inputs for the main question
    let qeditor_minInput, qeditor_maxInput, qeditor_stepInput;
    if (selectedType === "range") {
        const rangeRow = document.createElement('div');
        rangeRow.className = "row mt-3";

        const minCol = document.createElement('div');
        minCol.className = "col-4";
        const minObj = createFloatingInput("qeditor_min", "number", "Min", questionIndex !== null ? question.min : "");
        minCol.appendChild(minObj.group);
        qeditor_minInput = minObj.input;

        const maxCol = document.createElement('div');
        maxCol.className = "col-4";
        const maxObj = createFloatingInput("qeditor_max", "number", "Max", questionIndex !== null ? question.max : "");
        maxCol.appendChild(maxObj.group);
        qeditor_maxInput = maxObj.input;

        const stepCol = document.createElement('div');
        stepCol.className = "col-4";
        const stepObj = createFloatingInput("qeditor_step", "number", "Step", questionIndex !== null ? question.step : "");
        stepCol.appendChild(stepObj.group);
        qeditor_stepInput = stepObj.input;

        rangeRow.appendChild(minCol);
        rangeRow.appendChild(maxCol);
        rangeRow.appendChild(stepCol);
        questionEditor.appendChild(rangeRow);
    }

    // Add Question / Update Question Button
    const btnDiv = document.createElement('div');
    btnDiv.className = "d-flex justify-content-end mt-2";
    const addQuestionButton = document.createElement('button');
    addQuestionButton.textContent = questionIndex !== null ? 'Update Question' : 'Add Question';
    addQuestionButton.className = 'btn btn-success material-btn px-4';
    
    // Event listener for adding or updating the question
    addQuestionButton.onclick = (e) => {
        e.preventDefault();
        if (qeditor_variableInput.value.trim() === "" || qeditor_labelInput.value.trim() === "") {
            alert("Please fill in both variable name and question label.");
            return;
        }
        const varName = qeditor_variableInput.value.trim();
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName)) {
            alert("Variable name must start with a letter or underscore, and contain only letters, numbers, and underscores.");
            return;
        }
        if (["checkbox", "radio", "select"].includes(selectedType)) {
            const optionsText = qeditor_optionsInput.value.trim();
            if (optionsText === "") {
                alert("Please fill in the options.");
                return;
            }
        }
        if (selectedType === "range") {
            if (!qeditor_minInput.value || !qeditor_maxInput.value || !qeditor_stepInput.value) {
                alert("Please fill in all Likert fields.");
                return;
            }
            const min = parseFloat(qeditor_minInput.value);
            const max = parseFloat(qeditor_maxInput.value);
            const step = parseFloat(qeditor_stepInput.value);
            if (isNaN(min) || isNaN(max) || isNaN(step)) {
                alert("Please enter valid numbers for min, max, and step.");
                return;
            }
            if (min >= max) {
                alert("Min value must be less than max value.");
                return;
            }
            if (step <= 0) {
                alert("Step value must be positive.");
                return;
            }
        }
        // Validate the extra_labels configuration before saving
        if (selectedType === "mediatimeline") {
            const eType = qeditor_extraTypeSelect.value;
            if (["radio", "checkbox"].includes(eType)) {
                if (qeditor_extraOptionsInput.value.trim() === "") {
                    alert("Please fill in the Extra Options.");
                    return;
                }
            } else if (eType === "range") {
                const eMin = parseFloat(qeditor_extraMinInput.value);
                const eMax = parseFloat(qeditor_extraMaxInput.value);
                const eStep = parseFloat(qeditor_extraStepInput.value);
                if (isNaN(eMin) || isNaN(eMax) || isNaN(eStep)) {
                    alert("Please enter valid numbers for the Extra Label Min, Max, and Step.");
                    return;
                }
                if (eMin >= eMax) {
                    alert("Extra Label Min value must be less than Max value.");
                    return;
                }
            }
        }

        var position = questionIndex !== null ? (interface.questions[questionIndex].position || "middle") : "middle";

        // Construct the new question object
        const newQuestion = {
            variable: qeditor_variableInput.value.trim(),
            label: qeditor_labelInput.value.trim(),
            type: selectedType,
            required: qeditor_requiredInput.checked,
            position: position
        };
        
        // add options if applicable
        if (["checkbox", "radio", "select", "range", "mediatimeline", "mediatimestamp"].includes(selectedType)) {
            const optionsText = qeditor_optionsInput.value.trim();
            if (optionsText !== "") {
                newQuestion.options = optionsText.split("\n").map(opt => opt.trim());
            }
        }
        
        // add range properties if applicable
        if (selectedType === "range") {
            newQuestion.min = parseFloat(qeditor_minInput.value);
            newQuestion.max = parseFloat(qeditor_maxInput.value);
            newQuestion.step = parseFloat(qeditor_stepInput.value);
        }

        // add extra_labels properties if applicable
        if (selectedType === "mediatimeline") {
            // add extra_labels_type and extra_labels if applicable
            const eType = qeditor_extraTypeSelect.value;
            if (eType !== "") {
                newQuestion.extra_labels_type = eType;
                if (["radio", "checkbox"].includes(eType)) {
                    const eOpts = qeditor_extraOptionsInput.value.trim();
                    if (eOpts !== "") {
                        newQuestion.extra_labels = eOpts.split("\n").map(opt => opt.trim());
                    } else {
                        newQuestion.extra_labels = [];
                    }
                } else if (eType === "range") {
                    const eMin = parseFloat(qeditor_extraMinInput.value);
                    const eMax = parseFloat(qeditor_extraMaxInput.value);
                    const eStep = parseFloat(qeditor_extraStepInput.value);
                    if (!isNaN(eMin) && !isNaN(eMax) && !isNaN(eStep)) {
                        newQuestion.extra_labels = [eMin, eMax, eStep];
                    }
                }
            }
            // add separate_tracks if applicable
            newQuestion.separate_tracks = qeditor_separateInput.checked;
        }

        // Update or add the question in the interface
        if (questionIndex !== null) {
            interface.updateQuestion(questionIndex, newQuestion);
        } else {
            interface.addQuestion(newQuestion);
        }

        questionEditor.style.display = "none";
        const addQuestionSelect = document.getElementById('add-question-select');
        if (addQuestionSelect) addQuestionSelect.value = "";
    };

    btnDiv.appendChild(addQuestionButton);
    questionEditor.appendChild(btnDiv);
}

async function editProjectQuestions(projectId) {
    Navigation.setPage(editProjectQuestions, projectId);

    const content = document.getElementById('content');
    content.innerHTML = "Loading...";

    const project = await fetchResponse(`projects/${projectId}`, "GET");

    content.innerHTML = "";

    if (project.questions) {
        interface.questions = project.questions; 
    } else {
        interface.questions = [];
    }

    const cardBox = document.createElement('div');
    cardBox.className = "card material-card shadow-sm mx-auto my-4";
    cardBox.style.maxWidth = "1000px"; 

    const cardBody = document.createElement('div');
    cardBody.className = "card-body p-4";

    const headerContainer = document.createElement('div');
    headerContainer.className = "d-flex justify-content-between align-items-md-center flex-column flex-md-row mb-4 border-bottom pb-3 gap-3";
    
    const titleArea = document.createElement('div');
    const title = document.createElement('h5');
    title.className = "m-0 text-dark fw-bold";
    title.textContent = "Edit Project Questions";
    titleArea.appendChild(title);
    
    const projName = document.createElement('div');
    projName.className = "text-muted small mt-1";
    projName.textContent = `Project: ${project.name}`;
    titleArea.appendChild(projName);

    headerContainer.appendChild(titleArea);

    const backButton = document.createElement('button');
    backButton.textContent = '← Back to Projects';
    backButton.className = 'btn btn-outline-secondary btn-sm material-btn align-self-md-start';
    backButton.onclick = () => { Navigation.back(); };
    headerContainer.appendChild(backButton);

    cardBody.appendChild(headerContainer);

    const formElement = document.createElement('form');
    formElement.id = "editProjectForm";

    const instrGroup = document.createElement('div');
    instrGroup.className = "form-group material-group position-relative mb-4 mt-2";

    const instrInput = document.createElement('textarea');
    instrInput.name = "instructions";
    instrInput.id = "instructions";
    instrInput.className = "form-control material-input pt-3 bg-light border-0";
    instrInput.placeholder = "General instructions for annotators...";
    instrInput.value = project.instructions || "";
    instrInput.rows = 2;
    instrInput.style.height = "auto";

    const instrLabel = document.createElement('label');
    instrLabel.htmlFor = "instructions";
    instrLabel.className = "material-label fixed-label px-1 bg-light";
    instrLabel.textContent = "Task Instructions";

    instrGroup.appendChild(instrInput);
    instrGroup.appendChild(instrLabel);
    formElement.appendChild(instrGroup);

    const questionsArea = document.createElement('div');
    questionsArea.className = "border-top pt-4";

    const qHeaderDiv = document.createElement('div');
    qHeaderDiv.className = "d-flex justify-content-between align-items-center mb-3";

    const addQuestionSelect = document.createElement('select');
    addQuestionSelect.className = "form-select material-input w-auto";
    addQuestionSelect.id = "add-question-select";
    addQuestionSelect.style.minWidth = "220px";
    
    const defaultOption = document.createElement('option');
    defaultOption.textContent = `+ Add New Question`;
    defaultOption.value = "";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    addQuestionSelect.appendChild(defaultOption);
    
    const questionTypes = {
        "mediatimeline": "Event Timeline",
        "mediatimestamp": "Event Timestamps",
        "text": "Simple Text Box",
        "textarea": "Text Area",
        "checkbox": "Checkbox (Multi Select)",
        "radio": "Radio (Single Select)",
        "range": "Likert Scale",
        "select": "Dropdown",
        "number": "Number Input",
        "date": "Date Input",
        "time": "Time Input",
        "datetime-local": "Date-Time Input",
        "email": "Email Input"
    };

    Object.entries(questionTypes).forEach(([value, label]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        addQuestionSelect.appendChild(option);
    });

    addQuestionSelect.onchange = () => {
        const selectedType = addQuestionSelect.value;
        if (selectedType !== "") {
            _questionEditing(selectedType, null);
        }
    };
    
    qHeaderDiv.appendChild(addQuestionSelect);
    questionsArea.appendChild(qHeaderDiv);

    const questionDetailsContainer = document.createElement('div');
    questionDetailsContainer.id = "question-details-container";
    questionDetailsContainer.style.display = "none";
    questionsArea.appendChild(questionDetailsContainer);

    const renderedQuestionsContainer = document.createElement('div');
    renderedQuestionsContainer.id = "rendered-questions-container";
    questionsArea.appendChild(renderedQuestionsContainer);

    const questionsJSONContainer = document.createElement('div');
    questionsJSONContainer.id = "questions-json-container";
    questionsJSONContainer.className = "bg-light p-3 border rounded small font-monospace mt-3 overflow-auto";
    questionsJSONContainer.style.display = "none";
    questionsJSONContainer.style.maxHeight = "200px";
    questionsArea.appendChild(questionsJSONContainer);

    formElement.appendChild(questionsArea);

    const submitBtnContainer = document.createElement('div');
    submitBtnContainer.className = "d-flex justify-content-end mt-4 pt-3 border-top";

    const submitButton = document.createElement('button');
    submitButton.textContent = 'Save Project Layout';
    submitButton.className = 'btn btn-primary material-btn px-4 py-2';
    submitButton.onclick = async (e) => {
        e.preventDefault();
        
        const updatedProject = {
            instructions: instrInput.value,
            questions: JSON.parse(interface.questions ? JSON.stringify(interface.questions) : "[]")
        };
        
        const response = await fetchResponse(`projects/${projectId}`, "PUT", updatedProject);
        
        const messages = document.getElementById('message-area');
        if (response !== null && response !== undefined && typeof response === "object" && "status" in response && response.status === "success") {
            messages.innerHTML = "<div class='alert alert-success'>Project updated successfully!</div>";
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => { Navigation.reload(); }, 2000);
        } else { 
            if (typeof response === "object" && "error" in response) {
                messages.innerHTML = "<div class='alert alert-danger'>Error updating project!<br \>" + response.error + "</div>";
            } else {
                messages.innerHTML = "<div class='alert alert-danger'>Error updating project!</div>";
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
    submitBtnContainer.appendChild(submitButton);
    formElement.appendChild(submitBtnContainer);

    cardBody.appendChild(formElement);
    cardBox.appendChild(cardBody);
    content.appendChild(cardBox);

    interface.render();
}


async function editProjectAdjudication(projectId) {
    Navigation.setPage(editProjectAdjudication, projectId);  // <-- set current page

    const content = document.getElementById('content');
    content.innerHTML = "Loading...";

    // fetch project details
    const project = await fetchResponse(`projects/${projectId}`, "GET");

    content.innerHTML = "";

    // Outer Material-style Card
    const cardBox = document.createElement('div');
    cardBox.className = "card material-card shadow-sm mx-auto my-4";
    cardBox.style.maxWidth = "900px";

    const cardBody = document.createElement('div');
    cardBody.className = "card-body p-4";

    // Header & Navigation Container
    const headerContainer = document.createElement('div');
    headerContainer.className = "d-flex justify-content-between align-items-md-center flex-column flex-md-row mb-4 border-bottom pb-3 gap-3";
    
    const titleArea = document.createElement('div');
    const title = document.createElement('h5'); // Using h5, avoiding card-title
    title.className = "m-0 text-dark fw-bold";
    title.textContent = "Adjudication Rules";
    titleArea.appendChild(title);
    
    const projName = document.createElement('div');
    projName.className = "text-muted small mt-1";
    projName.textContent = `Project: ${project.name}`;
    titleArea.appendChild(projName);

    headerContainer.appendChild(titleArea);

    const backButton = document.createElement('button');
    backButton.textContent = '← Back to Projects';
    backButton.className = 'btn btn-outline-secondary btn-sm material-btn align-self-md-start';
    backButton.onclick = () => { Navigation.back(); };
    headerContainer.appendChild(backButton);

    cardBody.appendChild(headerContainer);

    // if no questions, show warning and return
    if (!project || !project.questions || project.questions.length === 0) {
        const warningAlert = document.createElement('div');
        warningAlert.className = "alert alert-warning";
        warningAlert.textContent = "Please first add questions to this project before configuring adjudication rules.";
        cardBody.appendChild(warningAlert);
        cardBox.appendChild(cardBody);
        content.appendChild(cardBox);
        return;
    }

    if (!project.adjudication_rule) {
        project.adjudication_rule = {};
    }
   
    // all variables used in project questions
    const questionVariables = new Set();
    for (const question of project.questions) {
        if ('variable' in question) {
            questionVariables.add(question.variable);
        }
    }

    // Main Form Layout
    const formElement = document.createElement('form');
    formElement.id = "editProjectForm";

    const formRow = document.createElement('div');
    formRow.className = "row mt-2";

    // --- Column 1: Configuration Inputs ---
    const col1 = document.createElement('div');
    col1.className = "col-md-6 pe-md-4";

    const configHeader = document.createElement('h6');
    configHeader.className = "text-muted font-weight-bold mb-3";
    configHeader.textContent = "Rule Configuration";
    col1.appendChild(configHeader);

    // Adjudication Show Switch
    const switchWrapper = document.createElement('div');
    switchWrapper.className = "form-check form-switch mb-4";
    
    const warningInput = document.createElement('input');
    warningInput.className = "form-check-input";
    warningInput.type = "checkbox";
    warningInput.id = "adjudication_show";
    warningInput.checked = project.adjudication_show || false;
    warningInput.style.cursor = "pointer";

    const warningLabel = document.createElement('label');
    warningLabel.className = "form-check-label ms-1";
    warningLabel.htmlFor = "adjudication_show";
    warningLabel.textContent = "Show Adjudication Warning to Users";
    warningLabel.style.cursor = "pointer";

    switchWrapper.appendChild(warningInput);
    switchWrapper.appendChild(warningLabel);
    col1.appendChild(switchWrapper);

    const currentRule = project.adjudication_rule;
    const currentFunction = currentRule.function || "";
    const currentVariable = currentRule.variable || "";
    const currentParameters = currentRule.parameters || {};

    // Function Select
    const funcGroup = document.createElement('div');
    funcGroup.className = "form-group material-group position-relative mb-4 mt-2";
    
    const functionSelect = document.createElement('select');
    functionSelect.className = "form-select material-input";
    functionSelect.required = true;
    
    const defaultFuncOpt = document.createElement('option');
    defaultFuncOpt.textContent = "-- Select Function --";
    defaultFuncOpt.disabled = true;
    defaultFuncOpt.selected = true;
    defaultFuncOpt.value = "";
    functionSelect.appendChild(defaultFuncOpt);
    
    for (const func of ["exact_agreement", "delta_agreement", "always"]) {
        const option = document.createElement('option');
        option.textContent = func;
        option.value = func;
        if (func === currentFunction) {
            defaultFuncOpt.selected = false;
            option.selected = true;
        }
        functionSelect.appendChild(option);
    }

    const funcLabel = document.createElement('label');
    funcLabel.className = "material-label fixed-label px-1 bg-white";
    funcLabel.textContent = "Agreement Function";

    funcGroup.appendChild(functionSelect);
    funcGroup.appendChild(funcLabel);
    col1.appendChild(funcGroup);

    // Variable Select
    const varGroup = document.createElement('div');
    varGroup.className = "form-group material-group position-relative mb-4";
    
    const variableSelect = document.createElement('select');
    variableSelect.setAttribute('multiple', '');
    variableSelect.className = "form-select material-input";
    variableSelect.style.height = Math.min(5, questionVariables.size) * 30 + "px";
    variableSelect.required = currentFunction !== "always" && currentFunction !== "";
    
    const defaultVarOpt = document.createElement('option');
    defaultVarOpt.textContent = "-- Select Variable(s) --";
    defaultVarOpt.disabled = true;
    defaultVarOpt.selected = true;
    defaultVarOpt.value = "";
    variableSelect.appendChild(defaultVarOpt);
    
    for (const variable of questionVariables) {
        const option = document.createElement('option');
        option.textContent = variable;
        option.value = variable;
        if (variable === currentVariable) {
            defaultVarOpt.selected = false;
            option.selected = true;
        }
        variableSelect.appendChild(option);
    }

    const varLabel = document.createElement('label');
    varLabel.className = "material-label fixed-label px-1 bg-white";
    varLabel.textContent = "Target Variable";

    varGroup.appendChild(variableSelect);
    varGroup.appendChild(varLabel);
    col1.appendChild(varGroup);

    // Delta Input
    const deltaGroup = document.createElement('div');
    deltaGroup.className = "form-group material-group position-relative mb-4";
    deltaGroup.style.display = currentFunction === "delta_agreement" ? "block" : "none";

    const deltaInput = document.createElement('input');
    deltaInput.type = "number";
    deltaInput.step = "any";
    deltaInput.min = "0";
    deltaInput.className = "form-control material-input";
    deltaInput.placeholder = "Tolerance (e.g. 2)";
    deltaInput.required = currentFunction === "delta_agreement";
    if (currentFunction === "delta_agreement" && "delta" in currentParameters) {
        deltaInput.value = currentParameters.delta;
    }

    const deltaLabel = document.createElement('label');
    deltaLabel.className = "material-label fixed-label px-1 bg-white";
    deltaLabel.textContent = "Delta / Tolerance";

    deltaGroup.appendChild(deltaInput);
    deltaGroup.appendChild(deltaLabel);
    col1.appendChild(deltaGroup);

    // Change listeners for Dynamic Display
    functionSelect.addEventListener('change', (event) => {
        const selectedFunction = event.target.value;
        
        if (selectedFunction === "delta_agreement") {
            deltaGroup.style.display = "block";
            deltaInput.required = true;
        } else {
            deltaGroup.style.display = "none";
            deltaInput.required = false;
        }

        if (selectedFunction === "always") {
            varGroup.style.display = "none";
            variableSelect.required = false;
            variableSelect.value = "";
        } else {
            varGroup.style.display = "block";
            variableSelect.required = true;
        }
    });

    formRow.appendChild(col1);

    // --- Column 2: JSON Preview & Delete ---
    const col2 = document.createElement('div');
    col2.className = "col-md-6 border-start ps-md-4 mt-4 mt-md-0 d-flex flex-column";

    const previewHeader = document.createElement('div');
    previewHeader.className = "d-flex justify-content-between align-items-center mb-3";
    
    const pTitle = document.createElement('h6');
    pTitle.className = "text-muted font-weight-bold m-0";
    pTitle.textContent = "Current Rule Preview";
    previewHeader.appendChild(pTitle);

    const deleteRuleButton = document.createElement('button');
    deleteRuleButton.textContent = 'Delete Rule';
    deleteRuleButton.className = 'btn btn-outline-danger btn-sm material-btn px-3';
    deleteRuleButton.disabled = Object.keys(project.adjudication_rule).length === 0;
    
    deleteRuleButton.onclick = async (e) => {
        e.preventDefault();
        const response = await fetchResponse(`projects/${projectId}`, "PUT", { adjudication_rule: {} });
        const messages = document.getElementById('message-area');
        if (response !== null && response !== undefined && typeof response === "object" && "status" in response && response.status === "success") {
            messages.innerHTML = "<div class='alert alert-success'>Adjudication rule deleted successfully!</div>";
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => { Navigation.reload(); }, 2000);
        } else { 
            if (typeof response === "object" && "error" in response) {
                messages.innerHTML = `<div class='alert alert-danger'>Error deleting rule!<br \>${response.error}</div>`;
            } else {
                messages.innerHTML = "<div class='alert alert-danger'>Error deleting adjudication rule!</div>";
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
    previewHeader.appendChild(deleteRuleButton);
    col2.appendChild(previewHeader);

    const currentRuleJSON = document.createElement('div');
    currentRuleJSON.className = "bg-light p-3 border rounded small font-monospace flex-grow-1 overflow-auto";
    currentRuleJSON.style.minHeight = "150px";
    currentRuleJSON.style.maxHeight = "250px";
    currentRuleJSON.innerHTML = `<pre class="m-0">${JSON.stringify(project.adjudication_rule, null, 2)}</pre>`;
    col2.appendChild(currentRuleJSON);

    formRow.appendChild(col2);
    formElement.appendChild(formRow);

    // --- Submit Button ---
    const buttonContainer = document.createElement('div');
    buttonContainer.className = "d-flex justify-content-end gap-2 mt-4 pt-3 border-top";

    const submitButton = document.createElement('button');
    submitButton.textContent = 'Save Changes';
    submitButton.className = 'btn btn-primary material-btn ripple px-4 py-2';
    submitButton.onclick = async (e) => {
        e.preventDefault();
        
        // validate required selects if "always" isn't chosen
        if (functionSelect.value && functionSelect.value !== "always" && !variableSelect.value) {
            // Let the native HTML5 required validation fire
            formElement.reportValidity();
            return;
        }

        const new_variable = Array.from(variableSelect.selectedOptions).map(opt => opt.value);
        const new_function = functionSelect.value;
        const new_parameters = {};
        if (new_function === "delta_agreement") {
            if(!deltaInput.value) {
                formElement.reportValidity();
                return;
            }
            new_parameters.delta = parseFloat(deltaInput.value);
        }

        const updatedProject = {
            adjudication_show: warningInput.checked,
        };

        const new_rule = {};
        if (new_function) new_rule.function = new_function;
        if (new_variable) new_rule.variables = new_variable;
        if (Object.keys(new_parameters).length > 0) new_rule.parameters = new_parameters;

        if (Object.keys(new_rule).length > 0) {
            updatedProject.adjudication_rule = new_rule;
        }

        const response = await fetchResponse(`projects/${projectId}`, "PUT", updatedProject);
        
        const messages = document.getElementById('message-area');
        if (response !== null && response !== undefined && typeof response === "object" && "status" in response && response.status === "success") {
            messages.innerHTML = "<div class='alert alert-success'>Project updated successfully!</div>";
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setTimeout(() => { Navigation.reload(); }, 2000);
        } else { 
            if (typeof response === "object" && "error" in response) {
                messages.innerHTML = `<div class='alert alert-danger'>Error updating project!<br \>${response.error}</div>`;
            } else {
                messages.innerHTML = "<div class='alert alert-danger'>Error updating project!</div>";
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
    
    buttonContainer.appendChild(submitButton);
    formElement.appendChild(buttonContainer);

    cardBody.appendChild(formElement);
    cardBox.appendChild(cardBody);
    content.appendChild(cardBox);
}


async function _uploadSelectedFiles(files, projectId) {
    const messages = document.getElementById('message-area');
    let successCount = 0;
    let failCount = 0;

    // Loop through all selected files
    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // skip hidden files (e.g. .DS_Store)
        if (file.name.startsWith('.')) continue;

        // Calculate the relative path for metadata
        // For individual files, webkitRelativePath might be empty
        const fullPath = file.webkitRelativePath === "" ? "./" : file.webkitRelativePath;
        const directoryPath = fullPath.includes('/') ? fullPath.substring(0, fullPath.lastIndexOf('/')) : "";

        // Update status message
        messages.innerHTML = `<div class='alert alert-info'>Uploading (${i + 1}/${files.length}): ${file.name}... This may take a few moments.</div>`;

        const metadata = {
            file_path: directoryPath // Backend will use this to organize files
        };

        // Call fetchResponse passing the File object directly
        const response = await fetchResponse("files/upload", "POST", metadata, file);

        // Check response for errors
        if (response && !response.error && response.id) {
            const fileId = response.id;

            // now create the task with the uploaded file ID
            const taskData = {
                project_id: projectId,
                file_id: fileId
            };
            const taskResponse = await fetchResponse(`tasks`, "POST", taskData);
            if (taskResponse && !taskResponse.error) {
                successCount++;
            } else {
                console.error(`Failed to create task for ${file.name}`, taskResponse);
                failCount++;
            }
        } else {
            console.error(`Failed to upload ${file.name}`, response);
            failCount++;
        }
    }

    // Final Status Message
    if (failCount === 0) {
        messages.innerHTML = `<div class='alert alert-success'>Successfully uploaded ${successCount} tasks!</div>`;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => {
            Navigation.reload();
        }, 2000);
    } else {
        messages.innerHTML = `<div class='alert alert-warning'>Upload complete: ${successCount} successful, ${failCount} failed. Check console for details.</div>`;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}


async function editProjectTasks(projectId) {
    Navigation.setPage(editProjectTasks, projectId);  // <-- set current page

    const content = document.getElementById('content');
    content.innerHTML = "Loading...";

    // fetch project details and current tasks
    const project = await fetchResponse(`projects/${projectId}`, "GET");
    const tasks = await fetchResponse(`tasks/project/${projectId}`, "GET");
    const num_tasks = (tasks && Array.isArray(tasks)) ? tasks.length : 0;

    content.innerHTML = "";

    // Outer Material-style Card
    const cardBox = document.createElement('div');
    cardBox.className = "card material-card shadow-sm mx-auto my-4";
    cardBox.style.maxWidth = "850px"; 

    const cardBody = document.createElement('div');
    cardBody.className = "card-body p-4";

    // Header & Navigation Container
    const headerContainer = document.createElement('div');
    headerContainer.className = "d-flex justify-content-between align-items-md-center flex-column flex-md-row mb-4 border-bottom pb-3 gap-3";
    
    const titleArea = document.createElement('div');
    const title = document.createElement('h5'); 
    title.className = "m-0 text-dark fw-bold";
    title.textContent = "Task Management";
    titleArea.appendChild(title);
    
    if (project) {
        const projName = document.createElement('div');
        projName.className = "text-muted small mt-1";
        projName.textContent = `Project: ${project.name}`;
        titleArea.appendChild(projName);
    }

    headerContainer.appendChild(titleArea);

    const backButton = document.createElement('button');
    backButton.textContent = '← Back to Projects';
    backButton.className = 'btn btn-outline-secondary btn-sm material-btn align-self-md-start';
    backButton.onclick = () => { Navigation.back(); };
    headerContainer.appendChild(backButton);

    cardBody.appendChild(headerContainer);

    // Main Layout Form
    const formElement = document.createElement('form');
    formElement.id = "editProjectForm";

    const formRow = document.createElement('div');
    formRow.className = "row mt-2";

    // --- Column 1: Current Tasks (Delete) ---
    const col1 = document.createElement('div');
    col1.className = "col-md-5 pe-md-4 mb-4 mb-md-0";

    const currentHeader = document.createElement('h6');
    currentHeader.className = "text-muted font-weight-bold mb-3";
    currentHeader.textContent = "Current Tasks";
    col1.appendChild(currentHeader);

    const tasksInfo = document.createElement('p');
    tasksInfo.className = "text-dark mb-4";
    tasksInfo.innerHTML = `This project currently has <span class="badge bg-primary rounded-pill fs-6 mx-1">${num_tasks}</span> tasks.`;
    col1.appendChild(tasksInfo);

    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn btn-outline-danger material-btn w-100 py-2';
    deleteButton.textContent = `Delete existing (${num_tasks}) tasks`;
    if (num_tasks === 0) {
        deleteButton.disabled = true;
    }   
    
    deleteButton.onclick = async (e) => {
        e.preventDefault();
        
        const confirmation = prompt(`Are you sure you want to delete all ${num_tasks} tasks for this project? You will also lose all annotations linked to these tasks. This action cannot be undone.\n\nPlease type "DELETE ${num_tasks} TASKS" to confirm.`);
        if (confirmation === `DELETE ${num_tasks} TASKS`) {
            var success = true;
            for (const task of tasks) {
                const response = await fetchResponse(`tasks/${task.id}`, "DELETE");
                if (response !== null && response !== undefined && typeof response === "object" && "status" in response && response.status === "success") {
                    continue;
                } else {
                    success = false;
                    break;
                }
            }
    
            const messages = document.getElementById('message-area');
            if (success) {
                messages.innerHTML = `<div class='alert alert-success'>All tasks deleted successfully!</div>`;
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setTimeout(() => { Navigation.reload(); }, 2000);
            } else { 
                messages.innerHTML = `<div class='alert alert-danger'>Error deleting tasks!</div>`;
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    };
    col1.appendChild(deleteButton);
    formRow.appendChild(col1);

    // --- Column 2: Upload New Tasks ---
    const col2 = document.createElement('div');
    col2.className = "col-md-7 border-start ps-md-4";

    const uploadHeader = document.createElement('h6');
    uploadHeader.className = "text-muted font-weight-bold mb-3";
    uploadHeader.textContent = "Upload New Tasks";
    col2.appendChild(uploadHeader);

    // 1. Directory Upload Section
    const dirWrapper = document.createElement('div');
    dirWrapper.className = "mb-4 pb-3 border-bottom";

    const dirLabel = document.createElement('label');
    dirLabel.className = "form-label fw-bold small text-dark mb-1";
    dirLabel.textContent = "Upload entire directory:";
    dirWrapper.appendChild(dirLabel);

    const dirInputGroup = document.createElement('div');
    dirInputGroup.className = "input-group input-group-sm";

    const dirInput = document.createElement('input');
    dirInput.type = "file";
    dirInput.className = "form-control bg-light text-muted";
    dirInput.setAttribute("webkitdirectory", "");
    dirInput.setAttribute("directory", "");
    dirInput.setAttribute("multiple", "");
    dirInputGroup.appendChild(dirInput);

    const dirSubmitBtn = document.createElement('button');
    dirSubmitBtn.className = "btn btn-primary material-btn px-3";
    dirSubmitBtn.textContent = "Upload";
    dirSubmitBtn.onclick = async (e) => {
        e.preventDefault();
        if (dirInput.files.length === 0) {
            document.getElementById('message-area').innerHTML = `<div class='alert alert-warning'>Please select a directory first.</div>`;
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        await _uploadSelectedFiles(dirInput.files, projectId);
    };
    dirInputGroup.appendChild(dirSubmitBtn);
    dirWrapper.appendChild(dirInputGroup);
    col2.appendChild(dirWrapper);

    // 2. Individual Files Upload Section
    const fileWrapper = document.createElement('div');
    fileWrapper.className = "mb-2";

    const fileLabel = document.createElement('label');
    fileLabel.className = "form-label fw-bold small text-dark mb-1";
    fileLabel.textContent = "Upload individual files:";
    fileWrapper.appendChild(fileLabel);

    const fileInputGroup = document.createElement('div');
    fileInputGroup.className = "input-group input-group-sm";

    const fileInput = document.createElement('input');
    fileInput.type = "file";
    fileInput.className = "form-control bg-light text-muted";
    fileInput.setAttribute("multiple", "");
    fileInputGroup.appendChild(fileInput);

    const fileSubmitBtn = document.createElement('button');
    fileSubmitBtn.className = "btn btn-primary material-btn px-3";
    fileSubmitBtn.textContent = "Upload";
    fileSubmitBtn.onclick = async (e) => {
        e.preventDefault();
        if (fileInput.files.length === 0) {
            document.getElementById('message-area').innerHTML = `<div class='alert alert-warning'>Please select files first.</div>`;
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        await _uploadSelectedFiles(fileInput.files, projectId);
    };
    fileInputGroup.appendChild(fileSubmitBtn);
    fileWrapper.appendChild(fileInputGroup);
    col2.appendChild(fileWrapper);

    formRow.appendChild(col2);
    formElement.appendChild(formRow);

    cardBody.appendChild(formElement);
    cardBox.appendChild(cardBody);
    content.appendChild(cardBox);
}


// submit form data as JSON
async function submitAnnotation(formID, saveForLater = false) {
    // @TODO: check if mediatimeline type of form and validate media events

    if (!formValidator(formID)) return false;

    const form = document.getElementById(formID);
    const formData = new FormData(form);

    // base data
    const jsonData = {
        project_id: formData.get("project_id"),
        task_id: formData.get("task_id"),
        adjudication: formData.get("adjudication"),
        incomplete: saveForLater,
        time: new Date().toLocaleString("en-US", { timeZoneName: "short" }), // Get current date-time
        content: {} // Collect all remaining form fields here
    };

    // actual annotation data
    formData.forEach((value, key) => {
        if (!["project_id", "adjudication", "task_id"].includes(key)) {
            if (key.endsWith("[]")) {
                key = key.slice(0, -2); // Remove [] for checkbox groups
                if (!jsonData.content[key]) jsonData.content[key] = [];
                jsonData.content[key].push(value);
            } else {
                jsonData.content[key] = value;
            }
        }
    });

    // Send data to server
    // console.log("Sent Data:", JSON.stringify(jsonData));
    const response = await fetchResponse("annotations", "POST", jsonData);
    // console.log("Saved:", response);

    // Display message and take action
    const messages = document.getElementById('message-area');
    if (response !== null && response !== undefined) {
        messages.innerHTML = "<div class='alert alert-success'>Data saved successfully!</div>";
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => {
            // Reload current page
            Navigation.reload();
        }, 2000);
    }
    else {
        if (typeof response === "object" && "error" in response) {
            messages.innerHTML = "<div class='alert alert-danger'>Error saving data!<br />" + response.error + "</div>";
        } else {
            messages.innerHTML = "<div class='alert alert-danger'>Error saving data!</div>";
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    return true;
}


// load all annotations for a project, convert them into a CSV file, and trigger a download of that file
function convertToCSV(annotations) {
    if (!Array.isArray(annotations) || annotations.length === 0) {
        return "";
    }

    // Get headers from the keys of all annotations (in case they have different keys, we want to include all)
    // 'content' field is an object, we want to flatten it so that each key in content becomes a separate column with header "content.keyname"
    const headers = [];
    for (const annotation of annotations) {
        for (const key of Object.keys(annotation)) {
            if ((!headers.includes(key)) && (key !== "content") && (key !== "id")) { // exclude 'content' itself from headers, we will add its keys separately
                headers.push(key);
            }
            if (key === "content" && typeof annotation[key] === "object" && annotation[key] !== null) {
                for (const contentKey of Object.keys(annotation[key])) {
                    const contentHeader = `content.${contentKey}`;
                    if (!headers.includes(contentHeader)) {
                        headers.push(contentHeader);
                    }
                }
            }
        }
    }

    // generate the CSV content
    const csvRows = [];

    // add headers row
    csvRows.push(headers.join(","));

    // add data rows
    for (const annotation of annotations) {
        const values = headers.map(header => {
            if (header.startsWith("content.")) {
                const contentKey = header.substring(8);
                const escaped = ("" + annotation.content[contentKey]).replace(/"/g, '""');
                return `"${escaped}"`;
            }
            else {
                const escaped = ("" + annotation[header]).replace(/"/g, '""');
                return `"${escaped}"`;
            }
        });
        csvRows.push(values.join(","));
    }

    return csvRows.join("\n");
}

async function downloadAnnotations(projectId) {
    const annotations = await fetchResponse(`annotations/project/${projectId}`, "GET");
    if (!annotations || annotations.error) {
        console.error("Failed to fetch annotations:", annotations);
        return;
    }

    // Convert annotations to CSV format
    const csvContent = convertToCSV(annotations);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // Create a link element to trigger the download
    const link = document.createElement('a');
    link.href = url;
    // Use project ID and current timestamp (YYYYMMDD) for the filename
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, ''); // get only the date part and remove dashes
    link.setAttribute('download', `annotations_${projectId}_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
