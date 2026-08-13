async function renderForm(mainWrap, task) {
    const questions = task.questions;
    const project_id = task.project_id;

    // task instructions
    const taskInstructions = document.createElement('div');
    taskInstructions.innerHTML = task.instructions;
    mainWrap.appendChild(taskInstructions);

    // main form
    const form = document.createElement('form');
    form.id = "dynamicForm";
    const projectIdInput = document.createElement('input'); // hidden project id input
    projectIdInput.type = 'hidden';
    projectIdInput.name = 'project_id';
    projectIdInput.value = project_id;
    form.appendChild(projectIdInput);
    const taskIdInput = document.createElement('input'); // hidden task id input
    taskIdInput.type = 'hidden';
    taskIdInput.name = 'task_id';
    taskIdInput.value = task.id;
    form.appendChild(taskIdInput);
    const adjudicationInput = document.createElement('input'); // hidden adjudication input
    adjudicationInput.type = 'hidden';
    adjudicationInput.name = 'adjudication';
    adjudicationInput.value = (task.status === "adjudicating") ? true : false;
    form.appendChild(adjudicationInput);
    mainWrap.appendChild(form);

    // define the main grid (table) of the rendered display: one row, three columns
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    const row = document.createElement('tr');
    const leftCol = document.createElement('td');
    const middleCol = document.createElement('td');
    const rightCol = document.createElement('td');
    table.className = "rendered-questions-main-table";
    // if (!videoEventsExists) {
    //     middleCol.style.maxWidth = "700px";
    // }
    row.appendChild(leftCol);
    row.appendChild(middleCol);
    row.appendChild(rightCol);
    tbody.appendChild(row);
    table.appendChild(tbody);
    form.appendChild(table);

    // video/image/etc element
    // @TODO: make tokens short-lived and handle expired token case (maybe with a retry mechanism to get a new token and update the src of the element)
    if (task.modality === "video" || task.modality === "audio") {
        const mediaContainer = document.createElement('div'); // media container
        mediaContainer.className = 'media-container';
        const mainMedia = document.createElement('div'); // main media container
        mainMedia.className = 'main-media';
        mainMedia.style.maxWidth = "700px";
        const mediaElement = task.modality === "video" ? document.createElement('video') : document.createElement('audio'); // media element
        mediaElement.controls = true;
        mediaElement.playsInline = true;
        mediaElement.style.width = "100%";
        mediaElement.id = "task-media";
        const sourceElement = document.createElement('source'); // video source
        const token = sessionStorage.getItem('token');
        sourceElement.src = `${SERVER_URL}:${SERVER_PORT}/files/serve/${task.file_id}?token=${token}`;
        sourceElement.type = task.modality === "video" ? `video/${task.data_type}` : `audio/${task.data_type}`;
        mediaElement.appendChild(sourceElement);
        mainMedia.appendChild(mediaElement);
        mediaContainer.appendChild(mainMedia);
        middleCol.appendChild(mediaContainer);
    }
    else if (task.modality === "image") {
        const imgElement = document.createElement('img');
        imgElement.style.maxWidth = "100%";
        imgElement.id = "task-image";
        const token = sessionStorage.getItem('token');
        imgElement.src = `${SERVER_URL}:${SERVER_PORT}/files/serve/${task.file_id}?token=${token}`;
        middleCol.appendChild(imgElement);
    }

    // incomplete annotations and annotations to adjudicate, if any
    const populated_values = task.populated_values ? task.populated_values : null;
    const annotations_to_adjudicate = task.annotations_to_adjudicate ? task.annotations_to_adjudicate : null;

    // render each question
    var allInterfaces = {}; // store all interface instances, which will be used to populate annotations when clicking save/submit buttons
    var interfaceCounter = 0;
    questions.forEach(q => {
        const questionContainer = document.createElement("div");
        questionContainer.setAttribute("class", "question");

        // print label for the question, except for mediatimeline type
        if (q.type !== "mediatimeline") {
            questionContainer.appendChild(document.createElement("br"));
            const label = document.createElement("label");
            label.innerHTML = q.label;
            label.setAttribute("for", q.variable);
            questionContainer.appendChild(label);

            // indicate if the field is required
            if (q.required !== undefined && q.required == true) {
                questionContainer.setAttribute("required", "");

                const requiredSpan = document.createElement("span");
                requiredSpan.setAttribute("class", "req-x");
                requiredSpan.innerHTML = "*";
                questionContainer.appendChild(requiredSpan);
            }
            questionContainer.appendChild(document.createElement("br"));
        }

        var interfaceElement;
        // Handle different question types
        if (q.type === "mediatimeline" || q.type === "mediatimestamp") { // media events annotation
            interfaceElement = new MediaTimelineInterface(questionContainer, q, populated_values, annotations_to_adjudicate);
            interfaceElement.render();
        } else { // usual form elements (text, checkbox, radio, select, textarea, number, range, etc.)
            interfaceElement = new FormInterface(questionContainer, q, populated_values, annotations_to_adjudicate);
            interfaceElement.render();
        }
        
        allInterfaces[interfaceCounter] = interfaceElement; // store the interface instance for later use when clicking save/submit buttons
        interfaceCounter++;

        const position = q.position || "middle";
        if (position === "left") {
            leftCol.appendChild(questionContainer);
            leftCol.style.minWidth = "410px"; // this is applied only if a content is added
        } else if (position === "middle") {
            middleCol.appendChild(questionContainer);
        } else {
            rightCol.appendChild(questionContainer);
            rightCol.style.minWidth = "410px"; // this is applied only if a content is added
        }
    });

    form.appendChild(document.createElement("br"));

    // save button
    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.className = 'btn btn-info';
    saveButton.name = 'saveAnnotation';
    saveButton.onclick = () => {
        for (const key in allInterfaces) {
            allInterfaces[key].populateAllAnnotations();
        }
        return submitAnnotation("dynamicForm", true);
    };
    saveButton.textContent = "Save for later";
    form.appendChild(saveButton);

    // space between buttons
    const space = document.createElement('span');
    space.innerHTML = "&nbsp;&nbsp;&nbsp;";
    form.appendChild(space);

    // submit button
    const submitButton = document.createElement('button');
    submitButton.type = 'button';
    submitButton.className = 'btn btn-info';
    submitButton.name = 'submitAnnotation';
    submitButton.onclick = () => { 
        for (const key in allInterfaces) {
            allInterfaces[key].populateAllAnnotations();
        }
        return submitAnnotation("dynamicForm", false);
    };
    submitButton.textContent = "Submit";
    form.appendChild(submitButton);
    form.appendChild(document.createElement("br"));
    form.appendChild(document.createElement("br"));
}