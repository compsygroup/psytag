class MediaTimelineInterface extends AnnotationInterface {
    constructor(container, properties, previousAnnotations = null, annotationsToAdjudicate = null) {
        super(container, properties, previousAnnotations, annotationsToAdjudicate);
        
        this.classification = false;
        if (properties["options"] && Array.isArray(properties["options"]) && properties["options"].length > 0) {
            this.classification = true;
        }
        
        // Define annotation modes based on question type
        this.isPointMode = properties.type === "mediatimestamp";
        this.isMultiTrack = this.classification && properties["separate_tracks"] === true && !this.isPointMode;
        
        this.playRegionEnd = null;
        this.waveforms = [];
        
        this.initialize();
    }

    initialize() {
        this.media = document.getElementById("task-media");
        if (!this.media) {
            throw new Error(`Media element is missing. Please ensure there is a media element with id "task-media".`);
        }
        if (!(this.media instanceof HTMLVideoElement || this.media instanceof HTMLAudioElement)) {
            throw new Error(`Media element must be a video or audio element.`);
        }
        this.media.style.display = this.media instanceof HTMLVideoElement ? "block" : "none"; 
        this.colorMap = this.classification ? this.makeColorMap(this.properties.options) : {};
        this.selectedLabel = this.classification ? this.properties.options[0] || null : null;

        this.keyboardShortcuts = {
            'arrowright':     () => this.seek(1),
            'arrowleft':      () => this.seek(-1),
            'arrowup':        () => this.seek(10),
            'arrowdown':      () => this.seek(-10)
        }

        // Map hotkeys 1-9 to real-time point dropping or updating selection
        if (this.isPointMode && this.classification) {
            this.properties.options.forEach((opt, idx) => {
                if (idx < 9) {
                    this.keyboardShortcuts[(idx + 1).toString()] = () => {
                        this.selectedLabel = opt;
                        
                        let updatedSelection = false;
                        for (const w of this.waveforms) {
                            if (w.selectedRegionId) {
                                w.setRegionLabel(w.selectedRegionId, opt);
                                updatedSelection = true;
                                break;
                            }
                        }
                        
                        if (!updatedSelection) {
                            this.dropPointAtPlayhead(opt);
                        }
                        
                        if (!this.isMultiTrack) this.updateLabelButtonState();
                    };
                }
            });
        }
    }

    render() {
        const hint = document.createElement("div");
        hint.style.fontSize = "9pt";
        hint.style.color = "#666";
        hint.style.marginBottom = "3px";
        
        // Contextual Hints
        if (this.isPointMode) {
            hint.innerHTML = "Press 1, 2, 3... or option buttons to drop a point marker at playhead. Shift+click waveform to drop manually. Drag markers to adjust.";
        } else {
            hint.textContent = "Click to seek. Shift+click/drag to create a region."; 
            hint.textContent += !this.isMultiTrack ? " Select a region, then click a label to assign class." : "";
        }
        this.container.appendChild(hint);

        // Render classification label buttons
        if (this.classification && !this.isMultiTrack) {
            const labelBar = document.createElement("div");
            labelBar.className = "audio-classification-label-bar";
            labelBar.style.margin = "4px 0";
            this.labelButtons = {};
            for (const opt of this.properties.options) {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.textContent = opt;
                btn.className = "btn btn-sm btn-secondary";
                btn.style.marginRight = "4px";
                btn.style.backgroundColor = this.colorMap[opt];
                btn.style.borderColor = this.colorMap[opt];
                btn.onclick = () => {
                    this.selectedLabel = opt;
                    
                    let updatedSelection = false;
                    for (const w of this.waveforms) {
                        if (w.selectedRegionId) {
                            w.setRegionLabel(w.selectedRegionId, opt);
                            updatedSelection = true;
                            break;
                        }
                    }
                    
                    if (!updatedSelection && this.isPointMode) {
                        this.dropPointAtPlayhead(opt);
                    }
                    
                    this.updateLabelButtonState();
                };
                this.labelButtons[opt] = btn;
                labelBar.appendChild(btn);
            }
            this.container.appendChild(labelBar);
        }

        const numTracks = this.isMultiTrack ? this.properties.options.length : 1;
        const trackHeight = this.properties.height || (this.isMultiTrack ? 80 : 180);

        for (let i = 0; i < numTracks; i++) {
            const opt = this.isMultiTrack ? this.properties.options[i] : null;

            const trackContainer = document.createElement("div");
            trackContainer.style.marginBottom = this.isMultiTrack ? "10px" : "0px";

            if (this.isMultiTrack) {
                const trackLabel = document.createElement("div");
                trackLabel.textContent = opt;
                trackLabel.style.fontWeight = "bold";
                trackLabel.style.fontSize = "10pt";
                trackLabel.style.marginBottom = "2px";
                trackLabel.style.color = "#333";
                trackContainer.appendChild(trackLabel);
            }
            
            const waveformContainer = document.createElement("div");
            trackContainer.appendChild(waveformContainer);
            this.container.appendChild(trackContainer);

            // Pass the annotation mode down to the component
            const w = new AudioWaveformComponent(waveformContainer, this.media, {
                mode: this.isPointMode ? "point" : "region",
                regionColors: this.colorMap,
                maxWidth: this.properties.max_width || 700,
                height: trackHeight,
                defaultRegionColor: this.isMultiTrack ? this.colorMap[opt] : "#5ac1fd",
                onRegionCreated: (region) => {
                    if (this.isMultiTrack) {
                        w.setRegionLabel(region.id, opt);
                    } else if (!region.label && this.selectedLabel) {
                        w.setRegionLabel(region.id, this.selectedLabel);
                    }
                },
                onRegionSelected: (region) => {
                    this.waveforms.forEach(otherW => {
                        if (otherW !== w) otherW.clearRegionSelection();
                    });

                    if (region.label) this.selectedLabel = region.label;
                    if (this.classification && !this.isMultiTrack) this.updateLabelButtonState();
                    this.renderExtraLabels(region);
                },
                onRegionCleared: () => {
                    const anySelected = this.waveforms.some(cw => cw.selectedRegionId !== null);
                    if (!anySelected) {
                        this.hideExtraLabels();
                    }
                },
                onZoom: (level) => {
                    this.waveforms.forEach(otherW => {
                        if (otherW !== w) otherW.setZoom(level, true);
                    });
                },
                onScroll: (scrollLeft) => {
                    this.waveforms.forEach(otherW => {
                        if (otherW !== w) otherW.viewport.scrollLeft = scrollLeft;
                    });
                }
            });

            w.render();
            this.waveforms.push(w);
        }

        this.controlsContainer = document.createElement("div");
        this.container.appendChild(this.controlsContainer);

        this.extraContainer = document.createElement("div");
        this.extraContainer.className = "audio-extra-labels-container";
        this.extraContainer.style.display = "none";
        this.extraContainer.style.marginTop = "6px";
        this.extraContainer.style.padding = "6px";
        this.extraContainer.style.border = "1px solid #ddd";
        this.extraContainer.style.background = "#f8f8f8";
        this.extraContainer.style.fontSize = "9pt";
        this.container.appendChild(this.extraContainer);

        const hidden = document.createElement("input");
        hidden.type = "hidden";
        hidden.name = this.properties.variable;
        hidden.id = this.properties.variable + "-audio-classification-result";
        this.container.appendChild(hidden);
        this.hiddenInput = hidden;

        this.renderControls();
        
        if (this.classification && !this.isMultiTrack) this.updateLabelButtonState();

        this.media.addEventListener("timeupdate", () => this.onTimeUpdate());
        this.media.addEventListener("play", () => this.updatePlayButtonUI());
        this.media.addEventListener("pause", () => this.updatePlayButtonUI());
        this.media.addEventListener("ended", () => this.updatePlayButtonUI());

        const loadAnnotations = () => this.applyExistingAnnotations();
        if (this.media.readyState >= 1) setTimeout(loadAnnotations, 500);
        else this.media.addEventListener("loadedmetadata", () => setTimeout(loadAnnotations, 500), {once: true});
        
        this.bindShortcuts();
    }

    // New utility to drop points instantly at playhead
    dropPointAtPlayhead(label) {
        if (!this.media || this.waveforms.length === 0) return;
        const t = this.media.currentTime;
        const w = this.waveforms[0]; 
        w.addRegion(t, t, label, true, false);
    }

    renderControls() {
        this.controlsContainer.innerHTML = "";
        this.controlsContainer.className = "av-controls";
        this.controlsContainer.style.width = "100%";
        this.controlsContainer.style.maxWidth = (this.properties.max_width || 700) + "px";
        this.controlsContainer.style.padding = "3px";
        this.controlsContainer.style.fontSize = "9pt";
        this.controlsContainer.style.boxSizing = "border-box";
        this.controlsContainer.style.display = "flex";
        this.controlsContainer.style.alignItems = "center";
        this.controlsContainer.style.justifyContent = "space-between";

        this.btnBack10 = this.makeButton("<<", () => this.seek(-10));
        this.btnBack1 = this.makeButton("<", () => this.seek(-1));
        this.btnPlay = this.makeButton("Play", () => {
            const hasSelectedRegion = this.waveforms.some(w => w.selectedRegionId !== null);
            if (hasSelectedRegion && !this.isPointMode) {
                this.playSelectedRegion();
            } else {
                this.playPause();
            }
        });
        this.btnForward1 = this.makeButton(">", () => this.seek(1));
        this.btnForward10 = this.makeButton(">>", () => this.seek(10));

        this.timeText = document.createElement("span");
        this.timeText.style.margin = "0 8px";
        this.timeText.textContent = "00:00:00 / 00:00:00";

        this.btnMute = this.makeButton("Mute", () => {
            this.media.muted = !this.media.muted;
            this.btnMute.innerHTML = this.media.muted
            ? "<i class='bi bi-volume-mute-fill'></i>"
            : "<i class='bi bi-volume-up-fill'></i>";
        });

        this.volume = document.createElement("input");
        this.volume.type = "range";
        this.volume.min = 0;
        this.volume.max = 1;
        this.volume.step = 0.05;
        this.volume.value = this.media.volume;
        this.volume.style.width = "70px";
        this.volume.style.height = "3px";
        this.volume.style.accentColor = "#1976d2";
        this.volume.className = "av-volume-slider";
        this.volume.oninput = () => { this.media.volume = parseFloat(this.volume.value); };
        
        this.btnZoomOut = this.makeButton("-", () => {
            if (this.waveforms.length > 0) {
                const w = this.waveforms[0];
                w.setZoom(w.zoomLevel - 1);
            }
        });
        this.btnZoomIn = this.makeButton("+", () => {
            if (this.waveforms.length > 0) {
                const w = this.waveforms[0];
                w.setZoom(w.zoomLevel + 1);
            }
        });

        this.btnPlay.innerHTML = '<i class="bi bi-play-fill"></i>';
        this.btnBack10.innerHTML = '<i class="bi bi-rewind-fill"></i>';
        this.btnBack1.innerHTML = '<i class="bi bi-skip-start-fill"></i>';
        this.btnForward1.innerHTML = '<i class="bi bi-skip-end-fill"></i>';
        this.btnForward10.innerHTML = '<i class="bi bi-fast-forward-fill"></i>';
        this.btnMute.innerHTML = '<i class="bi bi-volume-up-fill"></i>';
        this.btnZoomOut.innerHTML = '<i class="bi bi-zoom-out"></i>';
        this.btnZoomIn.innerHTML = '<i class="bi bi-zoom-in"></i>';

        const controls_left = document.createElement("div");
        controls_left.style.display = "flex";
        controls_left.style.alignItems = "center";
        controls_left.style.flex = "0 0 auto";

        const controls_mid = document.createElement("div");
        controls_mid.style.display = "flex";
        controls_mid.style.alignItems = "center";
        controls_mid.style.justifyContent = "center";
        controls_mid.style.flex = "1 1 auto";

        const controls_right = document.createElement("div");
        controls_right.style.display = "flex";
        controls_right.style.alignItems = "center";
        controls_right.style.flex = "0 0 auto";

        controls_left.appendChild(this.btnZoomOut);
        controls_left.appendChild(this.btnZoomIn);
        controls_mid.appendChild(this.btnBack10);
        controls_mid.appendChild(this.btnBack1);
        controls_mid.appendChild(this.btnPlay);
        controls_mid.appendChild(this.btnForward1);
        controls_mid.appendChild(this.btnForward10);
        controls_right.appendChild(this.timeText);
        controls_right.appendChild(this.btnMute);
        controls_right.appendChild(this.volume);

        this.controlsContainer.appendChild(controls_left);
        this.controlsContainer.appendChild(controls_mid);
        this.controlsContainer.appendChild(controls_right);
    }

    makeButton(text, callback) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "generic-controls";
        btn.textContent = text;
        btn.onclick = callback;
        btn.style.marginLeft = "2px";
        btn.style.width = "28px";
        btn.style.height = "24px";
        btn.style.padding = "0";
        btn.style.display = "inline-flex";
        btn.style.alignItems = "center";
        btn.style.justifyContent = "center";
        btn.style.border = "0px";
        btn.style.background = "none";
        btn.style.fontSize = "15px";

        return btn;
    }

    seek(seconds) {
        if (!this.media || !this.media.duration) return;
        this.media.currentTime = Math.min(Math.max(0, this.media.currentTime + seconds), this.media.duration);
    }

    playPause() {
        if (!this.media) return;
        if (this.media.paused) this.media.play();
        else this.media.pause();
    }

    playSelectedRegion() {
        if (!this.media || this.waveforms.length === 0) return;
        
        let selectedRegion = null;
        for (const w of this.waveforms) {
            if (w.selectedRegionId) {
                selectedRegion = w.regions.find(r => r.id === w.selectedRegionId);
                break;
            }
        }
        
        if (!selectedRegion) return;

        if (this.media.paused) {
            this.playRegionEnd = selectedRegion.stop;
            this.media.currentTime = selectedRegion.start;
            this.media.play();
        } else {
            this.media.pause();
        }
    }

    onTimeUpdate() {
        if (this.playRegionEnd !== null && this.media.currentTime >= this.playRegionEnd) {
            this.media.pause();
            this.media.currentTime = this.playRegionEnd;
            this.playRegionEnd = null;
        }

        this.waveforms.forEach(w => w.updatePlayhead());
        this.updateTimeUI();
    }

    updateTimeUI() {
        if (this.timeText && this.media && this.waveforms.length > 0) {
            const formatter = this.waveforms[0].formatTime;
            this.timeText.textContent = `${formatter(this.media.currentTime || 0)} / ${formatter(this.media.duration || 0)}`;
        }
    }

    updatePlayButtonUI() {
        if (this.btnPlay && this.media) {
            this.btnPlay.innerHTML = this.media.paused
            ? '<i class="bi bi-play-fill"></i>'
            : '<i class="bi bi-pause-fill"></i>';
        }
    }

    updateLabelButtonState() {
        if (this.isMultiTrack) return;
        for (const [label, btn] of Object.entries(this.labelButtons)) {
            btn.style.outline = (label === this.selectedLabel) ? "3px solid #111" : "none";
        }
    }

    makeColorMap(options) {
        const colors = ["#93d75b", "#5ac1fd", "#e39a5e", "#e3d85e", "#c256c2", "#ff7f7f", "#8dd3c7", "#bebada"];
        const out = {};
        options.forEach((opt, idx) => { out[opt] = colors[idx % colors.length]; });
        return out;
    }

    applyExistingAnnotations() {
        if (this.waveforms.length === 0 || !this.waveforms[0].initialized) {
            setTimeout(() => this.applyExistingAnnotations(), 300);
            return;
        }

        if (this.previousAnnotations && this.previousAnnotations[this.properties.variable] !== undefined) {
            this.addRegionsFromValue(this.previousAnnotations[this.properties.variable], true);
        }

        if (this.annotationsToAdjudicate) {
            const merged = mergeObjectsArray(this.annotationsToAdjudicate);
            if (merged[this.properties.variable] !== undefined) {
                this.addRegionsFromValue(merged[this.properties.variable], false);
            }
        }
    }

    addRegionsFromValue(value, active = true) {
        let annotations = value;
        if (typeof annotations === "string") {
            try { annotations = JSON.parse(annotations); } catch (e) { return; }
        }
        if (!Array.isArray(annotations)) return;
        
        for (const item of annotations) {
            let start, stop, label, extra;

            // Accommodate array parsing for both point [time, label, extra] and region [start, stop, label, extra]
            if (Array.isArray(item) && item.length >= 2) {
                if (this.isPointMode) {
                    start = parseFloat(item[0]);
                    stop = start;
                    label = item[1];
                    if (item.length >= 3) extra = item[2];
                } else {
                    start = parseFloat(item[0]);
                    stop = parseFloat(item[1]);
                    label = item[2];
                    if (item.length >= 4) extra = item[3];
                }
            } else if (item && typeof item === "object") {
                if (this.isPointMode) {
                    start = parseFloat(item.time !== undefined ? item.time : item.start);
                    stop = start;
                } else {
                    start = parseFloat(item.start);
                    stop = parseFloat(item.stop);
                }
                label = item.label || item.class || item.value || null;
                if (item.extra !== undefined) extra = item.extra;
            }

            if (!isNaN(start) && !isNaN(stop)) {
                let targetWaveform = this.waveforms[0];
                
                if (this.isMultiTrack && label) {
                    const trackIndex = this.properties.options.indexOf(label);
                    if (trackIndex >= 0 && trackIndex < this.waveforms.length) {
                        targetWaveform = this.waveforms[trackIndex];
                    }
                }
                
                const region = targetWaveform.addRegion(start, stop, label, active, false);
                if (extra !== undefined) region.extra = extra;
            }
        }
    }

    hideExtraLabels() {
        if (!this.extraContainer) return;
        this.extraContainer.innerHTML = "";
        this.extraContainer.style.display = "none";
    }

    renderExtraLabels(region) {
        if (!this.extraContainer) return;

        const type = this.properties.extra_labels_type;
        if (!type || !region || !region.active) {
            this.hideExtraLabels();
            return;
        }

        this.extraContainer.innerHTML = "";
        this.extraContainer.style.display = "block";

        const title = document.createElement("div");
        title.textContent = "Extra annotation";
        title.style.fontWeight = "bold";
        title.style.marginBottom = "4px";
        this.extraContainer.appendChild(title);

        if (type === "text" || type === "textarea") {
            this.renderExtraText(region);
        }
        else if (type === "radio") {
            this.renderExtraRadio(region);
        }
        else if (type === "checkbox") {
            this.renderExtraCheckbox(region);
        }
        else if (type === "range") {
            this.renderExtraRange(region);
        }
    }

    renderExtraText(region) {
        const textarea = document.createElement("textarea");
        textarea.rows = 3;
        textarea.cols = 50;
        textarea.value = region.extra || "";

        textarea.oninput = () => {
            const value = textarea.value.trim();
            if (value === "") delete region.extra;
            else region.extra = value;
        };

        this.extraContainer.appendChild(textarea);
    }

    renderExtraRadio(region) {
        const options = this.properties.extra_labels || [];
        const radioInputs = [];

        for (const opt of options) {
            const input = document.createElement("input");
            input.type = "radio";
            input.value = opt;
            input.checked = region.extra === opt;

            input.onmousedown = () => {
                input.dataset.wasChecked = input.checked ? "true" : "false";
            };

            input.onclick = () => {
                if (input.dataset.wasChecked === "true") {
                    input.checked = false;
                    delete region.extra;
                } else {
                    radioInputs.forEach(x => {
                        if (x !== input) x.checked = false;
                    });
                    input.checked = true;
                    region.extra = opt;
                }
            };

            radioInputs.push(input);

            this.extraContainer.appendChild(input);
            this.extraContainer.appendChild(document.createTextNode(" " + opt));
            this.extraContainer.appendChild(document.createElement("br"));
        }
    }

    renderExtraCheckbox(region) {
        const options = this.properties.extra_labels || [];
        const current = Array.isArray(region.extra) ? region.extra : [];

        for (const opt of options) {
            const input = document.createElement("input");
            input.type = "checkbox";
            input.value = opt;
            input.checked = current.includes(opt);

            input.onchange = () => {
                const checked = Array.from(this.extraContainer.querySelectorAll("input[type='checkbox']:checked"))
                    .map(x => x.value);

                if (checked.length === 0) delete region.extra;
                else region.extra = checked;
            };

            this.extraContainer.appendChild(input);
            this.extraContainer.appendChild(document.createTextNode(" " + opt));
            this.extraContainer.appendChild(document.createElement("br"));
        }
    }

    renderExtraRange(region) {
        let cfg = this.properties.extra_labels || [];
        if ((!Array.isArray(cfg)) || cfg.length != 3) {
            cfg = [0, 10, 1];
        }

        const min = cfg[0] 
        const max = cfg[1] 
        const step = cfg[2]

        const valueText = document.createElement("span");
        valueText.style.marginLeft = "8px";

        const input = document.createElement("input");
        input.type = "range";
        input.min = min;
        input.max = max;
        input.step = step;
        input.value = region.extra !== undefined ? region.extra : min;

        valueText.textContent = input.value;

        input.oninput = () => {
            region.extra = parseFloat(input.value);
            valueText.textContent = input.value;
        };

        this.extraContainer.appendChild(input);
        this.extraContainer.appendChild(valueText);
    }

    populateAllAnnotations() {
        let allRegions = [];
        this.waveforms.forEach(w => {
            allRegions = allRegions.concat(w.getActiveRegions());
        });
        
        this.hiddenInput.value = JSON.stringify(allRegions);
        return true;
    }
}