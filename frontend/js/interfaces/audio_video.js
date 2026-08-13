class AudioWaveformComponent {
    constructor(container, mediaElement, options = {}) {
        if (!container) throw new Error("AudioWaveformComponent requires a container");
        if (!mediaElement) throw new Error("AudioWaveformComponent requires an audio/video element");

        this.container = container;
        this.media = mediaElement;
        this.options = options;
        
        // Define annotation mode (region or point)
        this.mode = options.mode || "region";

        this.height = options.height || 180;
        this.timelineHeight = options.timelineHeight || 24;
        this.waveformHeight = this.height - this.timelineHeight;
        this.samples = options.samples || 4096;
        this.regionColors = options.regionColors || {};
        this.defaultRegionColor = options.defaultRegionColor || "#5ac1fd";
        this.onRegionSelected = options.onRegionSelected || null;
        this.onRegionCreated = options.onRegionCreated || null;
        this.onRegionChanged = options.onRegionChanged || null;

        this.waveform = null;
        this.regions = [];
        this.selectedRegionId = null;
        this.dragMode = null;
        this.dragRegionId = null;
        this.pendingRegionStart = null;
        this.pendingRegionStop = null;
        this.regionCounter = 0;

        this.zoomLevel = 1;
        this.minZoomLevel = 1;
        this.maxZoomLevel = options.maxZoomLevel || 20;

        this.ignoreNextClick = false;
        this.initialized = false;

        this.onRegionCleared = options.onRegionCleared || null;
    }

    render() {
        this.container.innerHTML = "";

        this.wrapper = document.createElement("div");
        this.wrapper.className = "av-waveform-component";
        this.wrapper.style.width = "100%";
        this.wrapper.style.maxWidth = (this.options.maxWidth || 700) + "px";
        this.wrapper.style.color = "#ccc";
        this.wrapper.style.boxSizing = "border-box";

        this.viewport = document.createElement("div");
        this.viewport.className = "av-waveform-viewport";
        this.viewport.style.position = "relative";
        this.viewport.style.width = (this.options.maxWidth || 700) + "px";
        this.viewport.style.height = this.height + "px";
        this.viewport.style.overflowX = "scroll";
        this.viewport.style.overflowY = "hidden";
        this.viewport.style.background = "#f1f1f1";
        this.viewport.style.boxSizing = "border-box";
        this.viewport.style.cursor = "crosshair";

        this.content = document.createElement("div");
        this.content.className = "av-waveform-content";
        this.content.style.position = "relative";
        this.content.style.height = this.height + "px";
        this.content.style.width = "100%";

        this.canvas = document.createElement("canvas");
        this.canvas.className = "av-waveform-canvas";
        this.canvas.style.position = "absolute";
        this.canvas.style.left = "0px";
        this.canvas.style.top = "0px";
        this.canvas.style.height = this.height + "px";
        this.canvas.style.width = "100%";
        this.canvas.style.zIndex = 1;

        this.regionLayer = document.createElement("div");
        this.regionLayer.className = "av-region-layer";
        this.regionLayer.style.position = "absolute";
        this.regionLayer.style.left = "0px";
        this.regionLayer.style.top = this.timelineHeight + "px";
        this.regionLayer.style.height = this.waveformHeight + "px";
        this.regionLayer.style.width = "100%";
        this.regionLayer.style.zIndex = 2;
        this.regionLayer.style.pointerEvents = "none";

        this.draftRegion = document.createElement("div");
        this.draftRegion.className = "av-draft-region";
        this.draftRegion.style.position = "absolute";
        this.draftRegion.style.top = this.timelineHeight + "px";
        this.draftRegion.style.height = this.waveformHeight + "px";
        this.draftRegion.style.background = "rgba(90,193,253,0.25)";
        this.draftRegion.style.border = "1px dashed rgba(0,0,0,0.5)";
        this.draftRegion.style.display = "none";
        this.draftRegion.style.zIndex = 3;
        this.draftRegion.style.pointerEvents = "none";

        this.playhead = document.createElement("div");
        this.playhead.className = "av-playhead";
        this.playhead.style.position = "absolute";
        this.playhead.style.top = "0px";
        this.playhead.style.height = this.height + "px";
        this.playhead.style.width = "2px";
        this.playhead.style.background = "red";
        this.playhead.style.zIndex = 4;
        this.playhead.style.pointerEvents = "none";

        this.content.appendChild(this.canvas);
        this.content.appendChild(this.regionLayer);
        this.content.appendChild(this.draftRegion);
        this.content.appendChild(this.playhead);
        this.viewport.appendChild(this.content);
        this.wrapper.appendChild(this.viewport);
        this.container.appendChild(this.wrapper);

        this.viewport.addEventListener("click", (e) => this.onViewportClick(e));
        this.viewport.addEventListener("mousedown", (e) => this.onMouseDown(e));
        document.addEventListener("mousemove", (e) => this.onMouseMove(e));
        document.addEventListener("mouseup", () => this.onMouseUp());
        this.viewport.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });
        
        this.viewport.addEventListener("scroll", (e) => {
            if (this.options.onScroll) this.options.onScroll(this.viewport.scrollLeft);
        });

        this.media.addEventListener("loadedmetadata", () => this.initialize());
        this.media.addEventListener("loadeddata", () => this.initialize());

        if (this.media.readyState >= 1) this.initialize();
        else setTimeout(() => { if (this.media.readyState >= 1) this.initialize(); }, 500);
    }

    async initialize() {
        if (this.initialized || !this.media.duration || isNaN(this.media.duration)) return;
        this.initialized = true;
        this.resizeContent();
        await this.loadWaveform();
        this.draw();
        this.updatePlayhead();
    }

    resizeContent() {
        const viewportWidth = this.viewport.clientWidth || this.wrapper.clientWidth || (this.options.maxWidth || 700);
        this.contentWidth = Math.max(viewportWidth, viewportWidth * this.zoomLevel);
        this.content.style.width = this.contentWidth + "px";
        this.canvas.style.width = this.contentWidth + "px";
        this.regionLayer.style.width = this.contentWidth + "px";

        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.round(this.contentWidth * dpr);
        this.canvas.height = Math.round(this.height * dpr);
        this.canvas.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    async loadWaveform() {
        try {
            const url = this.media.currentSrc || this.media.src;
            if (!url) return;

            const baseUrl = url.split('?')[0];
            const fileIdMatch = baseUrl.match(/\/files\/serve\/([a-zA-Z0-9_-]+)/);
            if (fileIdMatch) {
                const fid = fileIdMatch[1];
                const fileData = await fetchResponse(`files/${fid}`, "GET");
                if (fileData && fileData.waveform && fileData.waveform.length > 0) {
                    this.waveform = fileData.waveform;
                    return;
                }
            }
            console.warn("Failed to fetch precomputed waveform, falling back to computing waveform from audio data");
            await this.computeWaveform();
        } catch (e) {
            console.warn("Failed to fetch precomputed waveform, falling back to computing waveform from audio data", e);
            await this.computeWaveform();
        }
    }

    async computeWaveform() {
        try {
            const url = this.media.currentSrc || this.media.src;
            if (!url) return;

            const resp = await fetch(url);
            const arrayBuffer = await resp.arrayBuffer();
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            const length = audioBuffer.length;
            const mono = new Float32Array(length);

            for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
                const ch = audioBuffer.getChannelData(c);
                for (let i = 0; i < length; i++) {
                    mono[i] += ch[i] / audioBuffer.numberOfChannels;
                }
            }

            const block = Math.max(1, Math.floor(length / this.samples));
            this.waveform = new Float32Array(this.samples);

            for (let i = 0; i < this.samples; i++) {
                let max = 0;
                const start = i * block;
                const stop = Math.min(start + block, length);
                for (let j = start; j < stop; j++) {
                    max = Math.max(max, Math.abs(mono[j]));
                }
                this.waveform[i] = max;
            }

            let maxVal = 0;
            for (let i = 0; i < this.waveform.length; i++) {
                maxVal = Math.max(maxVal, this.waveform[i]);
            }
            if (maxVal > 0) {
                for (let i = 0; i < this.waveform.length; i++) {
                    this.waveform[i] /= maxVal;
                }
            }
        } catch (e) {
            console.warn("Audio waveform generation failed", e);
            this.waveform = null;
        }
    }

    draw() {
        this.resizeContent();
        const ctx = this.canvas.getContext("2d");
        ctx.clearRect(0, 0, this.contentWidth, this.height);
        this.drawTimeline(ctx);
        this.drawWaveform(ctx);
        this.renderRegions();
        this.updateDraftRegion();
        this.updatePlayhead();
    }

    drawTimeline(ctx) {
        ctx.fillStyle = "#f1f1f1";
        ctx.fillRect(0, 0, this.contentWidth, this.timelineHeight);
        ctx.fillStyle = "#555";
        ctx.font = "10px Arial";
        ctx.strokeStyle = "#ccc";
        ctx.lineWidth = 1;

        const duration = this.media.duration || 0;
        if (!duration) return;

        const targetGap = 90;
        const rawStep = duration / Math.max(1, Math.floor(this.contentWidth / targetGap));
        const step = this.niceTimeStep(rawStep);

        for (let t = 0; t <= duration; t += step) {
            const x = this.timeToX(t);
            ctx.beginPath();
            ctx.moveTo(x, this.timelineHeight - 6);
            ctx.lineTo(x, this.height);
            ctx.stroke();
            ctx.fillText(this.formatTime(t), x + 3, 12);
        }
    }

    drawWaveform(ctx) {
        const top = this.timelineHeight;
        const h = this.waveformHeight;
        ctx.fillStyle = "rgba(80,80,80,0.28)";

        if (!this.waveform) {
            ctx.fillText("Waveform unavailable", 10, top + 20);
            return;
        }

        for (let x = 0; x < this.contentWidth; x++) {
            const idx = Math.floor((x / this.contentWidth) * this.waveform.length);
            const val = this.waveform[idx] || 0;
            const barH = Math.max(1, val * h * 0.85);
            ctx.fillRect(x, top + (h - barH) / 2, 1, barH);
        }
    }

    niceTimeStep(raw) {
        const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];
        for (const s of steps) {
            if (s >= raw) return s;
        }
        return 3600;
    }

    onViewportClick(e) {
        if (this.ignoreNextClick) {
            this.ignoreNextClick = false;
            return;
        }
        if (this.dragMode) return;
        if (e.target.closest && e.target.closest(".av-region")) return;

        this.clearRegionSelection();

        const x = this.eventToContentX(e);
        const t = this.xToTime(x);
        this.media.currentTime = Math.min(Math.max(0, t), this.media.duration || 0);
    }

    onMouseDown(e) {
        const regionElement = e.target.closest ? e.target.closest(".av-region") : null;

        // POINT MODE LOGIC
        if (this.mode === "point") {
            if (regionElement) {
                this.dragMode = "move-point";
                this.dragRegionId = regionElement.dataset.regionId;
                this.selectRegion(this.dragRegionId);
                e.preventDefault();
                return;
            }
            if (e.shiftKey) {
                const x = this.eventToContentX(e);
                const t = Math.min(Math.max(0, this.xToTime(x)), this.media.duration || 0);
                this.addRegion(t, t, null, true, false);
                this.ignoreNextClick = true;
                e.preventDefault();
            }
            return;
        }

        // REGION MODE LOGIC
        const leftHandle = e.target.closest ? e.target.closest(".av-region-handle-left") : null;
        const rightHandle = e.target.closest ? e.target.closest(".av-region-handle-right") : null;

        if (leftHandle) {
            this.dragMode = "resize-left";
            this.dragRegionId = leftHandle.parentElement.dataset.regionId;
            e.preventDefault();
            return;
        }

        if (rightHandle) {
            this.dragMode = "resize-right";
            this.dragRegionId = rightHandle.parentElement.dataset.regionId;
            e.preventDefault();
            return;
        }
        
        if (regionElement) {
            const region = this.regions.find(r => r.id === regionElement.dataset.regionId);
            if (region && region.active) {
                this.selectRegion(regionElement.dataset.regionId);
            }
            return;
        }

        if (e.shiftKey) {
            const x = this.eventToContentX(e);
            const t = Math.min(Math.max(0, this.xToTime(x)), this.media.duration || 0);
            this.pendingRegionStart = t;
            this.pendingRegionStop = t;
            this.media.currentTime = t;
            this.dragMode = "new-region";
            this.updateDraftRegion();
            e.preventDefault();
        }
    }

    onMouseMove(e) {
        if (!this.dragMode) return;

        const x = this.eventToContentX(e);
        const t = Math.min(Math.max(0, this.xToTime(x)), this.media.duration || 0);
        const region = this.regions.find(r => r.id === this.dragRegionId);

        // Point Dragging
        if (this.dragMode === "move-point" && region && region.active) {
            region.start = t;
            region.stop = t;
            this.renderRegions();
            if (this.onRegionChanged) this.onRegionChanged(region);
            return;
        }

        // Region Drawing
        if (this.dragMode === "new-region") {
            this.pendingRegionStop = t;
            this.media.currentTime = t;
            this.updateDraftRegion();
            return;
        }

        // Region Resizing
        if (this.dragMode === "resize-left" && region && region.active) {
            region.start = Math.min(t, region.stop - 0.01);
            this.renderRegions();
            if (this.onRegionChanged) this.onRegionChanged(region);
        }
        else if (this.dragMode === "resize-right" && region && region.active) {
            region.stop = Math.max(t, region.start + 0.01);
            this.renderRegions();
            if (this.onRegionChanged) this.onRegionChanged(region);
        }
    }

    onMouseUp() {
        if (this.dragMode === "move-point") {
            this.ignoreNextClick = true;
        }

        if (this.dragMode === "new-region" && this.pendingRegionStart !== null && this.pendingRegionStop !== null) {
            const start = this.pendingRegionStart;
            const stop = this.pendingRegionStop;

            if (Math.abs(stop - start) > 0.05) {
                this.addRegion(Math.min(start, stop), Math.max(start, stop), null, true, true);
                this.ignoreNextClick = true;
            }
        }

        this.dragMode = null;
        this.dragRegionId = null;
        this.pendingRegionStart = null;
        this.pendingRegionStop = null;
        this.updateDraftRegion();
    }

    eventToContentX(e) {
        const rect = this.viewport.getBoundingClientRect();
        return e.clientX - rect.left + this.viewport.scrollLeft;
    }

    timeToX(t) {
        const duration = this.media.duration || 1;
        return (t / duration) * this.contentWidth;
    }

    xToTime(x) {
        const duration = this.media.duration || 0;
        return (x / this.contentWidth) * duration;
    }

    addRegion(start, stop, label = null, active = true, select = false) {
        const region = {
            id: "av-region-" + this.regionCounter++,
            start: start,
            stop: stop,
            label: label,
            active: active
        };

        this.regions.push(region);
        this.renderRegions();

        if (select) this.selectRegion(region.id);
        if (this.onRegionCreated) this.onRegionCreated(region);

        return region;
    }

    setRegionLabel(regionId, label) {
        const region = this.regions.find(r => r.id === regionId);
        if (!region || !region.active) return;

        region.label = label;
        this.renderRegions();

        if (this.onRegionChanged) this.onRegionChanged(region);
    }

    selectRegion(regionId) {
        const region = this.regions.find(r => r.id === regionId);
        if (!region) return;

        this.selectedRegionId = regionId;
        this.renderRegions();

        if (this.onRegionSelected) this.onRegionSelected(region);
    }

    clearRegionSelection() {
        this.selectedRegionId = null;
        this.renderRegions();
        if (this.onRegionCleared) this.onRegionCleared();
    }

    deleteSelectedRegion() {
        if (!this.selectedRegionId) return;
        const region = this.regions.find(r => r.id === this.selectedRegionId);
        if (!region || !region.active) return;

        this.regions = this.regions.filter(r => r.id !== this.selectedRegionId);
        this.selectedRegionId = null;
        this.renderRegions();

        if (this.onRegionCleared) this.onRegionCleared();
    }

    renderRegions() {
        if (!this.regionLayer) return;
        this.regionLayer.innerHTML = "";

        for (const region of this.regions) {
            const el = document.createElement("div");
            el.className = "av-region";
            el.dataset.regionId = region.id;
            el.style.position = "absolute";
            
            // Get solid version of the color for lines/flags
            let solidColor = this.regionColor(region);
            if (solidColor.length === 9 && solidColor.startsWith('#')) solidColor = solidColor.substring(0, 7);
            else if (solidColor.startsWith('rgba')) solidColor = solidColor.replace(/[\d\.]+\)$/g, '1)');

            if (this.mode === "point") {
                el.style.left = (this.timeToX(region.start) - 6) + "px";
                el.style.width = "12px";
                el.style.top = "0px";
                el.style.height = this.height + "px";
                el.style.background = "transparent";
                el.style.border = "none";
                el.style.cursor = region.active ? "ew-resize" : "default";
                el.style.opacity = region.active ? "1" : "0.4";
                el.style.pointerEvents = region.active ? "auto" : "none";
                el.title = `${this.formatTime(region.start)} ${region.label || ""}`;

                // Thin vertical line
                const line = document.createElement("div");
                line.style.position = "absolute";
                line.style.left = "5px";
                line.style.top = "0px";
                line.style.width = "2px";
                line.style.height = "100%";
                line.style.background = solidColor;
                el.appendChild(line);

                // Flag circle at top
                const flag = document.createElement("div");
                flag.style.position = "absolute";
                flag.style.left = "0px";
                flag.style.top = "0px";
                flag.style.width = "15px";
                flag.style.height = "15px";
                flag.style.borderRadius = "50%";
                flag.style.background = solidColor;
                if (region.id === this.selectedRegionId) {
                    flag.style.border = "2px solid #000";
                    flag.style.transform = "scale(1.2)";
                }
                el.appendChild(flag);

                // Floating label text
                const label = document.createElement("div");
                label.textContent = region.label || "Unlabeled";
                label.style.position = "absolute";
                label.style.left = "14px";
                label.style.top = "0px";
                label.style.fontSize = "10px";
                label.style.color = "#000";
                label.style.background = "rgba(255,255,255,0.85)";
                label.style.padding = "1px 3px";
                label.style.borderRadius = "3px";
                label.style.pointerEvents = "none";
                el.appendChild(label);

                // Point-specific Delete button
                if (region.active && region.id === this.selectedRegionId) {
                    const deleteBtn = document.createElement("button");
                    deleteBtn.type = "button";
                    deleteBtn.className = "av-region-delete-button";
                    deleteBtn.innerHTML = '<i class="bi bi-x-circle-fill"></i>';
                    deleteBtn.title = "Delete point";
                    deleteBtn.style.position = "absolute";
                    deleteBtn.style.top = "16px";
                    deleteBtn.style.left = "-4px";
                    deleteBtn.style.width = "19px";
                    deleteBtn.style.height = "19px";
                    deleteBtn.style.padding = "0";
                    deleteBtn.style.border = "0";
                    deleteBtn.style.borderRadius = "50%";
                    deleteBtn.style.background = "rgba(255,255,255)";
                    deleteBtn.style.color = "#000";
                    deleteBtn.style.fontSize = "15px";
                    deleteBtn.style.lineHeight = "16px";
                    deleteBtn.style.display = "flex";
                    deleteBtn.style.alignItems = "center";
                    deleteBtn.style.justifyContent = "center";
                    deleteBtn.style.cursor = "pointer";
                    deleteBtn.style.zIndex = 5;

                    deleteBtn.onpointerdown = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.deleteSelectedRegion();
                    };
                    el.appendChild(deleteBtn);
                }

            } else { // Standard Region Mode
                el.style.left = this.timeToX(region.start) + "px";
                el.style.width = Math.max(2, this.timeToX(region.stop) - this.timeToX(region.start)) + "px";
                el.style.top = "0px";
                el.style.height = this.waveformHeight + "px";
                el.style.background = this.regionColor(region);
                el.style.border = region.id === this.selectedRegionId ? "2px solid #c03f1c" : "1px solid rgba(0,0,0,0.25)";
                el.style.boxSizing = "border-box";
                el.style.cursor = region.active ? "pointer" : "default";
                el.style.opacity = region.active ? "1" : "0.35";
                el.style.pointerEvents = region.active ? "auto" : "none";
                el.title = `${this.formatTime(region.start)} - ${this.formatTime(region.stop)} ${region.label || ""}`;

                const label = document.createElement("div");
                label.textContent = region.label || "Unlabeled";
                label.style.fontSize = "10px";
                label.style.color = "#222";
                label.style.padding = "2px";
                label.style.pointerEvents = "none";
                el.appendChild(label);

                if (region.active) {
                    const left = document.createElement("div");
                    left.className = "av-region-handle-left";
                    left.style.position = "absolute";
                    left.style.left = "0px";
                    left.style.top = "0px";
                    left.style.width = "5px";
                    left.style.height = "100%";
                    left.style.cursor = "ew-resize";
                    left.style.background = "rgba(0,0,0,0.18)";
                    el.appendChild(left);

                    const right = document.createElement("div");
                    right.className = "av-region-handle-right";
                    right.style.position = "absolute";
                    right.style.right = "0px";
                    right.style.top = "0px";
                    right.style.width = "5px";
                    right.style.height = "100%";
                    right.style.cursor = "ew-resize";
                    right.style.background = "rgba(0,0,0,0.18)";
                    el.appendChild(right);
                }

                if (region.active && region.id === this.selectedRegionId) {
                    const deleteButton = document.createElement("button");
                    deleteButton.type = "button";
                    deleteButton.className = "av-region-delete-button";
                    deleteButton.innerHTML = '<i class="bi bi-x-circle-fill"></i>';
                    deleteButton.title = "Delete region";

                    deleteButton.style.position = "absolute";
                    deleteButton.style.top = "2px";
                    deleteButton.style.right = "2px";
                    deleteButton.style.width = "19px";
                    deleteButton.style.height = "19px";
                    deleteButton.style.padding = "0";
                    deleteButton.style.border = "0";
                    deleteButton.style.borderRadius = "50%";
                    deleteButton.style.background = "rgba(255,255,255)";
                    deleteButton.style.color = "#000";
                    deleteButton.style.fontSize = "15px";
                    deleteButton.style.lineHeight = "16px";
                    deleteButton.style.display = "flex";
                    deleteButton.style.alignItems = "center";
                    deleteButton.style.justifyContent = "center";
                    deleteButton.style.cursor = "pointer";
                    deleteButton.style.zIndex = 5;

                    deleteButton.onpointerdown = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.deleteSelectedRegion();
                    };

                    el.appendChild(deleteButton);
                }
            }

            this.regionLayer.appendChild(el);
        }
    }

    updateDraftRegion() {
        if (!this.draftRegion) return;

        if (this.dragMode !== "new-region" || this.pendingRegionStart === null || this.pendingRegionStop === null) {
            this.draftRegion.style.display = "none";
            return;
        }

        const x0 = this.timeToX(Math.min(this.pendingRegionStart, this.pendingRegionStop));
        const x1 = this.timeToX(Math.max(this.pendingRegionStart, this.pendingRegionStop));
        this.draftRegion.style.left = x0 + "px";
        this.draftRegion.style.width = Math.max(2, x1 - x0) + "px";
        this.draftRegion.style.display = "block";
    }

    regionColor(region) {
        const color = this.regionColors[region.label] || this.defaultRegionColor;
        if (color.startsWith("rgba")) return color;
        if (color.startsWith("#")) return color + "99";
        return color;
    }

    getActiveRegions() {
        return this.regions
            .filter(r => r.active)
            .map(r => {
                let out;
                
                // Export formatting based on annotation mode
                if (this.mode === "point") {
                    out = { time: r.start, label: r.label };
                } else {
                    out = { start: r.start, stop: r.stop, label: r.label };
                }

                if (r.extra !== undefined && r.extra !== null && r.extra !== "") {
                    if (!Array.isArray(r.extra) || r.extra.length > 0) {
                        out.extra = r.extra;
                    }
                }

                return out;
            });
    }

    setZoom(level, silent = false) {
        const oldX = this.timeToX(this.media.currentTime || 0) - this.viewport.scrollLeft;
        this.zoomLevel = Math.min(Math.max(this.minZoomLevel, level), this.maxZoomLevel);
        this.draw();
        const newX = this.timeToX(this.media.currentTime || 0);
        this.viewport.scrollLeft = Math.max(0, newX - oldX);

        if (!silent && this.options.onZoom) {
            this.options.onZoom(this.zoomLevel);
        }
    }

    onWheel(e) {
        if (!e.shiftKey) return;
        e.preventDefault();
        
        const rawDelta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
        if (rawDelta === 0) return;
        
        const delta = Math.sign(rawDelta);
        
        if (delta > 0) {
            this.setZoom(this.zoomLevel / 1.2);
        } else {
            this.setZoom(this.zoomLevel * 1.2);
        }
    }

    updatePlayhead() {
        if (!this.playhead || !this.media.duration) return;
        this.playhead.style.left = this.timeToX(this.media.currentTime || 0) + "px";
    }

    formatTime(seconds) {
        seconds = Math.max(0, Math.floor(seconds || 0));
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
}