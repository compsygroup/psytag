class AnnotationInterface {
    keyboardShortcuts = {};

    constructor(container, properties, previousAnnotations = null, annotationsToAdjudicate = null) {
        if (!properties["type"] || !properties["variable"]) {
            throw new Error(`properties must include "type" and "variable" fields`);
        }

        this.container = container;
        this.properties = properties;
        this.previousAnnotations = previousAnnotations;
        this.annotationsToAdjudicate = annotationsToAdjudicate;
    }

    initialize() {
        // if annotations_to_adjudicate exists, create a table.
        // left column: input field
        // right column: previous annotations to adjudicate as text
        if (this.annotationsToAdjudicate) {
            const table = document.createElement("table");
            table.className = "table table-borderless mb-0";
            
            const tbody = document.createElement("tbody");
            const tr = document.createElement("tr");
            
            const td1 = document.createElement("td"); // left column
            td1.className = "align-top pe-4";
            td1.style.width = "60%";

            const td2 = document.createElement("td"); // right column
            td2.className = "align-top p-3 bg-warning bg-opacity-10 rounded border border-warning border-opacity-25";
            td2.style.width = "40%";
            
            tr.appendChild(td1);
            tr.appendChild(td2);
            tbody.appendChild(tr);
            table.appendChild(tbody);
            this.container.appendChild(table);
            
            // populate right column with previous annotations
            const title = document.createElement("h6");
            title.className = "fw-bold text-dark mb-3 border-bottom border-warning pb-2";
            title.textContent = "Previous Annotations (Adjudication)";
            td2.appendChild(title);

            let counter = 1;
            this.annotationsToAdjudicate.forEach(annotation => {
                const annoDiv = document.createElement("div");
                annoDiv.className = "mb-2 text-dark";
                annoDiv.innerHTML = `<span class="badge bg-warning text-dark me-2">A${counter}</span> ${annotation[this.properties.variable]}`;
                td2.appendChild(annoDiv);
                counter++;
            });

            this.container = td1; // set container to left column for input field
        }
    }

    render() {
        throw new Error("render() method must be implemented by subclass");
    }

    populateAllAnnotations() {
        // do nothing. this is used only for mediatimeline interface
        return true;
    }

    // Helper method to batch-register keyboard shortcuts
    bindShortcuts() {
        const shortcutMap = this.keyboardShortcuts;
        Object.entries(shortcutMap).forEach(([key, callback]) => {
            ShortcutManager.register(key, callback);
        });
    }
}

class FormInterface extends AnnotationInterface {
    constructor(container, properties, previousAnnotations = null, annotationsToAdjudicate = null) {
        super(container, properties, previousAnnotations, annotationsToAdjudicate);
        
        if (properties.type === "checkbox" || properties.type === "radio" || properties.type === "select") {
            if (!properties["options"]) {
                throw new Error(`properties must include "options" field`);
            }
        }

        this.initialize();
    }

    render() {
        if (this.properties.type === "checkbox" || this.properties.type === "radio") {
            this.#renderCheckRadio();
        }
        else if (this.properties.type === "textarea") {
            this.#renderTextArea();
        }
        else if (this.properties.type === "select") {
            this.#renderSelect();
        }
        else if (this.properties.type === "range") {
            this.#renderRange();
        }
        else { //text, number, etc.
            this.#renderInput();
        }
    }

    #renderCheckRadio() {
        const options = this.properties.options;
        const inputType = this.properties.type; // "checkbox" or "radio"
        const variable = this.properties.variable;

        const wrapperDiv = document.createElement("div");
        wrapperDiv.className = "d-flex flex-column gap-2 pt-1";

        options.forEach((option, index) => {
            // create DOM elements
            const checkWrapper = document.createElement("div");
            checkWrapper.className = "form-check";

            const input = document.createElement("input");
            input.className = "form-check-input border-secondary";
            input.type = inputType;
            input.name = inputType === "checkbox" ? `${variable}[]` : variable;
            input.value = option;
            input.id = `${variable}_opt_${index}`;

            // Prefill previous values if available
            if (this.previousAnnotations) {
                if (inputType === "checkbox" && this.previousAnnotations[variable]?.includes(option)) {
                    input.checked = true;
                }
                else if (inputType === "radio" && this.previousAnnotations[variable] === option) {
                    input.checked = true;
                }
            }

            const label = document.createElement("label");
            label.className = "form-check-label text-dark";
            label.htmlFor = input.id;
            label.textContent = option;
            
            checkWrapper.appendChild(input);
            checkWrapper.appendChild(label);
            wrapperDiv.appendChild(checkWrapper);
        });

        this.container.appendChild(wrapperDiv);
    }

    #renderTextArea() {
        // create DOM elements
        const variable = this.properties.variable;
        
        const textarea = document.createElement("textarea");
        textarea.className = "form-control bg-light text-dark";
        textarea.name = variable;
        textarea.rows = 4;
        textarea.style.resize = "vertical";

        // Prefill previous value if available
        if (this.previousAnnotations && this.previousAnnotations[variable]) {
            textarea.value = this.previousAnnotations[variable];
        }

        // display
        this.container.appendChild(textarea);
    }

    #renderSelect() {
        const options = this.properties.options;
        const variable = this.properties.variable;

        // create DOM elements
        const select = document.createElement("select");
        select.className = "form-select bg-light text-dark w-auto";
        select.style.minWidth = "250px";
        select.name = variable;

        // add default empty option
        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "-- Select an option --";
        defaultOption.disabled = false;
        defaultOption.selected = true;
        select.appendChild(defaultOption);

        // add options
        options.forEach(option => {
            const optionElement = document.createElement("option");
            optionElement.value = option;
            optionElement.textContent = option;
            // Prefill previous value if available
            if (this.previousAnnotations && this.previousAnnotations[variable] === option) {
                optionElement.selected = true;
            }
            select.appendChild(optionElement);
        });

        // display
        this.container.appendChild(select);
    }

    #renderRange() {
        const variable = this.properties.variable;
        const min = parseFloat(this.properties.min !== undefined ? this.properties.min : 0);
        const max = parseFloat(this.properties.max !== undefined ? this.properties.max : 100);
        const step = parseFloat(this.properties.step !== undefined ? this.properties.step : 1);
        const isDiscrete = Number.isInteger(step);
        const labels = this.properties.options || [];

        const wrapper = document.createElement("div");
        wrapper.className = "range-input-wrapper pt-2 pb-4"; 
        wrapper.style.width = "100%";
        wrapper.style.maxWidth = "600px";

        const inputElement = document.createElement("input");
        inputElement.type = "range";
        inputElement.name = variable;
        inputElement.min = min;
        inputElement.max = max;
        inputElement.step = step;
        inputElement.className = "form-range"; 

        let currentValue = (this.previousAnnotations && this.previousAnnotations[variable] !== undefined)
            ? parseFloat(this.previousAnnotations[variable])
            : min; 
        inputElement.value = currentValue;

        if (isDiscrete) {
            wrapper.appendChild(inputElement);
            
            const ticksContainer = document.createElement("div");
            ticksContainer.className = "position-relative w-100 mt-2";
            
            const numSteps = Math.floor((max - min) / step) + 1;
            for (let i = 0; i < numSteps; i++) {
                const tickVal = min + (i * step);
                const labelText = (labels.length > i) ? labels[i] : tickVal.toString();
                
                const tickLabel = document.createElement("div");
                tickLabel.className = "text-muted text-center fw-medium";
                tickLabel.textContent = labelText;
                
                const percent = (i / (numSteps - 1)) * 100;
                // Bootstrap .form-range thumb is 1rem (16px) wide. 
                // The offset compensates for the thumb radius to center labels exactly under the thumb.
                const offset = 8 - (percent / 100) * 16;
                
                tickLabel.style.position = "absolute";
                tickLabel.style.left = `calc(${percent}% + ${offset}px)`;
                tickLabel.style.width = "80px"; 
                tickLabel.style.wordWrap = "break-word";
                tickLabel.style.textAlign = "center";
                tickLabel.style.fontSize = "0.80rem";
                tickLabel.style.lineHeight = "1.2";

                if (labelText.length > 10) {
                    tickLabel.style.transform = "translateX(-50%) rotate(-30deg)";
                    tickLabel.style.transformOrigin = "top center"; 
                } else {
                    tickLabel.style.transform = "translateX(-50%)";
                }
                
                ticksContainer.appendChild(tickLabel);
            }
            wrapper.appendChild(ticksContainer);
        } else {
            const flexContainer = document.createElement("div");
            flexContainer.className = "d-flex align-items-center gap-3";
            
            inputElement.style.flexGrow = "1";
            flexContainer.appendChild(inputElement);
            
            const valueDisplay = document.createElement("span");
            valueDisplay.className = "badge bg-secondary rounded-pill fs-6 px-3 py-2";
            valueDisplay.textContent = parseFloat(inputElement.value).toFixed(2);
            valueDisplay.style.minWidth = "60px";
            flexContainer.appendChild(valueDisplay);
            
            inputElement.addEventListener("input", (e) => {
                valueDisplay.textContent = parseFloat(e.target.value).toFixed(2);
            });
            
            wrapper.appendChild(flexContainer);
        }

        this.container.appendChild(wrapper);
    }

    #renderInput() {
        const variable = this.properties.variable;

        // create DOM elements
        const inputElement = document.createElement("input");
        inputElement.className = "form-control bg-light text-dark";
        inputElement.style.maxWidth = "400px";
        inputElement.type = this.properties.type;
        inputElement.name = variable;

        // Set min, max, and step attributes if defined (type=number)
        if (this.properties.min !== undefined) inputElement.min = this.properties.min;
        if (this.properties.max !== undefined) inputElement.max = this.properties.max;
        if (this.properties.step !== undefined) inputElement.step = this.properties.step;

        // Prefill previous values if available
        if (this.previousAnnotations && this.previousAnnotations[variable] !== undefined) {
            inputElement.value = this.previousAnnotations[variable];
        }

        // display
        this.container.appendChild(inputElement);
    }
}