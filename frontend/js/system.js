let SERVER_URL = "http://127.0.0.1";
let SERVER_PORT = 8000;


const ShortcutManager = {
    bindings: {},
    isListening: false,
    // Store a bound reference to the handler so removeEventListener can find it
    boundHandler: null,

    init() {
        if (this.isListening) return;
        
        if (!this.boundHandler) {
            this.boundHandler = (event) => this.handleEvent(event);
        }
        
        document.addEventListener('keydown', this.boundHandler);
        this.isListening = true;
    },

    register(keyString, callback) {
        this.init(); 
        this.bindings[keyString.toLowerCase()] = callback;
    },

    clearAll() {
        // Completely remove the listener from the DOM
        if (this.isListening && this.boundHandler) {
            document.removeEventListener('keydown', this.boundHandler);
            this.isListening = false;
        }
        // Wipe the bindings map
        this.bindings = {};
    },

    handleEvent(event) {
        let modifiers = "";
        if (event.ctrlKey) modifiers += "ctrl+";
        if (event.altKey) modifiers += "alt+";
        if (event.shiftKey) modifiers += "shift+";

        const keyName = event.key.toLowerCase();
        const fullShortcut = modifiers + keyName;

        if (this.bindings[fullShortcut]) {
            event.preventDefault(); 
            this.bindings[fullShortcut](event);
        }
    }
};


const Navigation = {
    history: [],
    current: -1,

    setPage(pageFunction, ...args) {
        // Automatically wipe out all registered hotkeys before switching views
        ShortcutManager.clearAll();

        // remove any forward history
        this.history = this.history.slice(0, this.current + 1);

         // check if a duplicate entry
        const last = this.history[this.current];
        if (last && last.func === pageFunction && JSON.stringify(last.args) === JSON.stringify(args)) {
            return;
        }

        // add new page state
        this.history.push({func: pageFunction, args: args});
        this.current += 1;

        // remove the message area since this is a new page
        const messages = document.getElementById('message-area');
        messages.innerHTML = "";

        // console.log("History:", this.history);
        // console.log("Current:", this.current);
    },

    reload() {
        if (this.current >= 0) {
            // remove the message area
            const messages = document.getElementById('message-area');
            messages.innerHTML = "";

            const page = this.history[this.current];
            page.func(...page.args);
        }
    },

    back() {
        if (this.current > 0) {
            // remove the message area
            const messages = document.getElementById('message-area');
            messages.innerHTML = "";
            
            this.current -= 1;
            const page = this.history[this.current];
            page.func(...page.args);
        }
    },

    forward() {
        if (this.current < this.history.length - 1) {
            // remove the message area
            const messages = document.getElementById('message-area');
            messages.innerHTML = "";
            
            this.current += 1;
            const page = this.history[this.current];
            page.func(...page.args);
        }
    }
};


// Load config.json 
async function loadBackendConfig() {
    try {
        const response = await fetch("config/backend.json");
        if (!response.ok) throw new Error("Config not found");
        
        const config = await response.json();
        SERVER_URL = config.server_url;
        SERVER_PORT = config.server_port;
    } catch (error) {
        SERVER_URL = "http://127.0.0.1";
        SERVER_PORT = 8000;
    }

    // Create the Content Security Policy Meta Tag to improve security 
    const meta = document.createElement('meta');
    meta.httpEquiv = "Content-Security-Policy";
    meta.content = `
        default-src 'self'; 
        script-src 'self'; 
        style-src 'self'; 
        connect-src 'self' ${SERVER_URL}:${SERVER_PORT}; 
        img-src 'self' data: ${SERVER_URL}:${SERVER_PORT}; 
        media-src 'self' ${SERVER_URL}:${SERVER_PORT};
    `.replace(/\s+/g, ' ').trim();
    // Inject it immediately at the absolute top of the <head>
    document.head.appendChild(meta);
}

async function saveBackendConfig(config) {
    try {
        const response = await fetch("config/backend.json", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(config)
        });
        if (!response.ok) throw new Error("Failed to save config");

        //reload the page to apply new settings
        window.location.reload();
    } catch (error) {
        console.error("Error saving backend config:", error);
    }
}

function showBackendSettingsPage() {
    document.getElementById('topbar').style.display = "none";
    document.getElementById('statusbar').style.display = "none";
    document.getElementById('content').style.display = "none";
    
    const loginContainer = document.getElementById('loginContainer');
    loginContainer.style.display = "block";
    loginContainer.replaceChildren();

    // Outer Material-style Card
    const loginBox = document.createElement('div');
    loginBox.id = "loginBox";
    loginBox.className = "card material-card shadow-lg mx-auto my-4";
    loginBox.style.maxWidth = "450px"; 

    const cardBody = document.createElement('div');
    cardBody.className = "card-body p-4";

    // Circular Logo Frame
    const logoWrapper = document.createElement('div');
    logoWrapper.className = "login-logo-frame mx-auto mb-3 bg-white d-flex align-items-center justify-content-center";
    
    const logoImg = document.createElement('img');
    logoImg.src = "img/compsy_logo.png";
    logoImg.alt = "Compsy Logo";
    logoImg.className = "login-logo-img";
    logoWrapper.appendChild(logoImg);
    cardBody.appendChild(logoWrapper);

    // App Title
    const title = document.createElement('h3');
    title.className = "card-title text-center mb-2";
    title.textContent = "Psytag";
    cardBody.appendChild(title);

    // Error Alert Context
    const errorAlert = document.createElement('p');
    errorAlert.className = "text-center text-danger fw-bold mb-1 small";
    errorAlert.textContent = "Backend Connection Error";
    cardBody.appendChild(errorAlert);

    const description = document.createElement('p');
    description.className = "text-center text-muted mb-4 small";
    description.textContent = `Could not connect to the server at ${SERVER_URL}:${SERVER_PORT}. Please verify settings:`;
    cardBody.appendChild(description);

    const form = document.createElement('form');
    form.id = "connectionForm";

    // Helper to generate fixed-label form groups
    function createFormGroup(id, type, labelText, placeholderText, value = "") {
        const group = document.createElement('div');
        group.className = "form-group material-group position-relative mb-3";

        const input = document.createElement('input');
        input.type = type;
        input.id = id;
        input.name = id;
        input.className = "form-control material-input";
        input.placeholder = placeholderText;
        input.required = true;
        if (value) input.value = value;

        const label = document.createElement('label');
        label.htmlFor = id;
        label.className = "material-label fixed-label";
        label.textContent = labelText;

        group.appendChild(input);
        group.appendChild(label);
        return group;
    }

    form.appendChild(createFormGroup("connUrl", "text", "Server URL", "http://127.0.0.1", SERVER_URL));
    form.appendChild(createFormGroup("connPort", "text", "Port", "8000", SERVER_PORT));

    // Submit Button
    const submitBtn = document.createElement('button');
    submitBtn.type = "submit";
    submitBtn.className = "btn btn-primary material-btn ripple w-100 py-2 mt-4";
    submitBtn.textContent = "Save and Reconnect";
    form.appendChild(submitBtn);

    cardBody.appendChild(form);
    loginBox.appendChild(cardBody);
    loginContainer.appendChild(loginBox);

    // Form Submit Event Listener
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        let server_url = document.getElementById('connUrl').value.trim();
        let server_port = document.getElementById('connPort').value.trim();

        // Ensure scheme prefix formatting is standard
        if (!server_url.startsWith('http://') && !server_url.startsWith('https://')) {
            server_url = 'http://' + server_url;
        }

        // Send payload to save to disk and refresh
        saveBackendConfig({ server_url, server_port });
    });
}


// Fetch function with optional file upload support
async function fetchResponse(endpoint, method="POST", data=null, fileInputOrObj=null) {
    const headers = {"Content-Type": "application/json"};
    const token = sessionStorage.getItem('token');
    if (token) headers["authorization"] = token;

    const options = {
        method: method,
        headers: headers
    };

    // --- MODE 1: File Upload ---
    if (fileInputOrObj) {
        // Remove Content-Type so browser sets it with boundary
        delete headers["Content-Type"]; 

        const formData = new FormData();
        let fileToUpload = null;

        // Check if argument is a String (ID) or a File Object
        if (typeof fileInputOrObj === 'string') {
            const fileInput = document.getElementById(fileInputOrObj);
            if (fileInput && fileInput.files.length > 0) {
                fileToUpload = fileInput.files[0];
            } else {
                console.error(`File input '${fileInputOrObj}' not found or empty.`);
                return { error: "File selection required" };
            }
        } else if (fileInputOrObj instanceof File) {
            fileToUpload = fileInputOrObj;
        }

        if (fileToUpload) {
            formData.append("upload", fileToUpload);
        } else {
            return { error: "No valid file object found" };
        }

        if (data) {
            // Backend expects 'metadata' field as a JSON string
            formData.append("metadata", JSON.stringify(data));
        }

        options.body = formData;
    } 
    // --- MODE 2: Standard JSON Request ---
    else if (data) {
        options.body = JSON.stringify(data);
    }

    const response = await fetch(`${SERVER_URL}:${SERVER_PORT}/${endpoint}`, options);
    
    let result = await response.json();

    if (result.token) {
        sessionStorage.setItem('token', result.token); // Refresh token
    }

    if (response.status === 401) {
        sessionStorage.clear();
        if (typeof showLoginPage === "function") showLoginPage();
        throw new Error("Unauthorized. Logging out.");
    }

    if ('data' in result && result.data !== null) {
        result = result.data;
    }

    return result;
}


async function attemptLogin(event) {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const result = await fetchResponse('login', 'POST', { username, password });

    if (result) {
        // check if password is temporary
        if (result === "temporary") {
            // delete any existing token so that user has to change password (refreshing page will not help)
            sessionStorage.removeItem('token');
            showPasswordChangePage();
        } else {
            initializeApp();
        }
    } else {
        document.getElementById('loginError').innerText = "Invalid credentials or no access to the application.";
    }
}

async function attemptPasswordChange(event) {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('old_password').value;
    const new_password0 = document.getElementById('new_password0').value;
    const new_password1 = document.getElementById('new_password1').value;

    // first attempt to login with old credentials, which will create a new token if successful
    const loginResult = await fetchResponse('login', 'POST', { username, password });

    if (!loginResult) {
        document.getElementById('loginError').innerText = "Old password is incorrect.";
        return;
    }
    
    // check if two passwords match
    if (new_password0 !== new_password1) {
        document.getElementById('loginError').innerText = "Passwords do not match.";
        return;
    }
    // check if old password and new password are the same
    if (password === new_password0) {
        document.getElementById('loginError').innerText = "New password must be different from old password.";
        return;
    }
    //check if password meets criteria
    if (new_password1.length < 8) {
        document.getElementById('loginError').innerText = "Password must be at least 8 characters long.";
        return;
    }
    else if ((!/[A-Z]/.test(new_password1)) || (!/[a-z]/.test(new_password1)) || (!/[0-9]/.test(new_password1))) {
        document.getElementById('loginError').innerText = "Password must contain at least one uppercase letter, one lowercase letter, and one digit.";
        return;
    }

    const result = await fetchResponse('users/change_password', 'POST', {old_password: password, new_password: new_password1});

    if (result === true) {
        // show message for successful password change for 2.5 seconds and then initialize app
        document.getElementById('loginError').style.color = "green";
        document.getElementById('loginError').innerText = "Password changed successfully. Redirecting...";
        setTimeout(() => {
            document.getElementById('loginError').style.color = "red";
            initializeApp();
        }, 2500);
    } else {
        document.getElementById('loginError').innerText = "Failed to change password.";
    }
}

function showLoginPage() {
    document.getElementById('topbar').style.display = "none";
    document.getElementById('statusbar').style.display = "none";
    document.getElementById('content').style.display = "none";
    
    const loginContainer = document.getElementById('loginContainer');
    loginContainer.style.display = "block";
    loginContainer.replaceChildren();

    // Outer Material-style Card
    const loginBox = document.createElement('div');
    loginBox.id = "loginBox";
    loginBox.className = "card material-card shadow-lg mx-auto my-4";
    loginBox.style.maxWidth = "400px"; // Slightly narrower for login view

    const cardBody = document.createElement('div');
    cardBody.className = "card-body p-4";

    // Circular Logo Frame
    const logoWrapper = document.createElement('div');
    logoWrapper.className = "login-logo-frame mx-auto mb-3 bg-white d-flex align-items-center justify-content-center";
    
    const logoImg = document.createElement('img');
    logoImg.src = "img/compsy_logo.png";
    logoImg.alt = "Compsy Logo";
    logoImg.className = "login-logo-img";
    logoWrapper.appendChild(logoImg);
    cardBody.appendChild(logoWrapper);

    // App Title
    const title = document.createElement('h3');
    title.className = "card-title text-center mb-4";
    title.textContent = "Psytag";
    cardBody.appendChild(title);

    const form = document.createElement('form');
    form.id = "loginForm";

    // Helper to generate fixed-label form groups
    function createFormGroup(id, type, labelText, placeholderText) {
        const group = document.createElement('div');
        group.className = "form-group material-group position-relative mb-3";

        const input = document.createElement('input');
        input.type = type;
        input.id = id;
        input.name = id;
        input.className = "form-control material-input";
        input.placeholder = placeholderText;
        input.required = true;

        const label = document.createElement('label');
        label.htmlFor = id;
        label.className = "material-label fixed-label";
        label.textContent = labelText;

        group.appendChild(input);
        group.appendChild(label);
        return group;
    }

    form.appendChild(createFormGroup("username", "text", "Username", "admin"));
    form.appendChild(createFormGroup("password", "password", "Password", "password"));

    // Submit Button
    const submitBtn = document.createElement('button');
    submitBtn.type = "submit";
    submitBtn.className = "btn btn-primary material-btn ripple w-100 py-2 mt-4";
    submitBtn.textContent = "Login";
    form.appendChild(submitBtn);

    cardBody.appendChild(form);

    // Error Area
    const loginError = document.createElement('div');
    loginError.id = "loginError";
    loginError.className = "mt-3 text-center font-weight-bold";
    cardBody.appendChild(loginError);

    loginBox.appendChild(cardBody);
    loginContainer.appendChild(loginBox);

    form.addEventListener('submit', attemptLogin);
}


function showPasswordChangePage() {
    document.getElementById('topbar').style.display = "none";
    document.getElementById('statusbar').style.display = "none";
    document.getElementById('content').style.display = "none";
    
    const loginContainer = document.getElementById('loginContainer');
    loginContainer.style.display = "block";
    loginContainer.replaceChildren();

    // Outer Material-style Card
    const loginBox = document.createElement('div');
    loginBox.id = "loginBox";
    loginBox.className = "card material-card shadow-lg mx-auto my-4";
    loginBox.style.maxWidth = "450px"; 

    const cardBody = document.createElement('div');
    cardBody.className = "card-body p-4";

    // Circular Logo Frame
    const logoWrapper = document.createElement('div');
    logoWrapper.className = "login-logo-frame mx-auto mb-3 bg-white d-flex align-items-center justify-content-center";
    
    const logoImg = document.createElement('img');
    logoImg.src = "img/compsy_logo.png";
    logoImg.alt = "Compsy Logo";
    logoImg.className = "login-logo-img";
    logoWrapper.appendChild(logoImg);
    cardBody.appendChild(logoWrapper);

    // Form Title
    const title = document.createElement('h3');
    title.className = "card-title text-center mb-4";
    title.textContent = "Change Password";
    cardBody.appendChild(title);

    const form = document.createElement('form');
    form.id = "passwordChangeForm";

    // Helper to generate fixed-label form groups
    function createFormGroup(id, type, labelText, placeholderText) {
        const group = document.createElement('div');
        group.className = "form-group material-group position-relative mb-3";

        const input = document.createElement('input');
        input.type = type;
        input.id = id;
        input.name = id;
        input.className = "form-control material-input";
        input.placeholder = placeholderText;
        input.required = true;

        const label = document.createElement('label');
        label.htmlFor = id;
        label.className = "material-label fixed-label";
        label.textContent = labelText;

        group.appendChild(input);
        group.appendChild(label);
        return group;
    }

    form.appendChild(createFormGroup("username", "text", "Username", "Username"));
    form.appendChild(createFormGroup("old_password", "password", "Old Password", "Current password"));
    form.appendChild(createFormGroup("new_password0", "password", "New Password", "New password"));
    form.appendChild(createFormGroup("new_password1", "password", "Confirm New Password", "Confirm new password"));

    // Submit Button
    const submitBtn = document.createElement('button');
    submitBtn.type = "submit";
    submitBtn.className = "btn btn-primary material-btn ripple w-100 py-2 mt-4";
    submitBtn.textContent = "Update Password";
    form.appendChild(submitBtn);

    cardBody.appendChild(form);

    // Error Area
    const loginError = document.createElement('div');
    loginError.id = "loginError";
    loginError.className = "mt-3 text-center font-weight-bold";
    cardBody.appendChild(loginError);

    loginBox.appendChild(cardBody);
    loginContainer.appendChild(loginBox);

    form.addEventListener('submit', attemptPasswordChange);
}


function hideLoginPage() {
    document.getElementById('topbar').style.display = "block";
    const statusbar = document.getElementById('statusbar');
    statusbar.style.display = "block";
    statusbar.style.backgroundColor = "#cacaca";
    statusbar.style.textAlign = "center";
    document.getElementById('content').style.display = "block";
    document.getElementById('loginContainer').style.display = "none";
}


function logout() {
    sessionStorage.clear();
    initializeApp();
}


async function initializeApp() {
    try {
        // Test connection health check before proceeding
        const response = await fetch(`${SERVER_URL}:${SERVER_PORT}/is_first_time`, { method: "GET" });
        const isFirstTime = await response.json();
        
        if (isFirstTime?.data !== undefined ? isFirstTime.data : isFirstTime) {
            setupApp();
        } else {
            const token = sessionStorage.getItem('token');
            if (!token) showLoginPage();
            else {
                hideLoginPage();
                const user = await fetchResponse("users/my.info", "GET");
                document.getElementById('userFullName').innerText = user.fullname;
                document.getElementById('topAdminMenu').style.display = (user.admin || user.manager) ? 'block' : 'none';
                
                await loadProjects();
                // await loadNextTask('691a1d0338c3ff3d5bbfcc9c');
                // await manageUsers();
                // await manageProjects();
                // await editProjectTasks('698de37dbde7ba97035f7bf2');
                // await editProjectInfo('691a1d0338c3ff3d5bbfcc9c');
                // await editProjectUsers('691a1d0338c3ff3d5bbfcc9c');
                // await editProjectQuestions('691a1d0338c3ff3d5bbfcc9c');
                // await editProjectAdjudication('691a1d0338c3ff3d5bbfcc9c');
            }
        }
    } catch (error) {
        console.error(`Backend unreachable at ${SERVER_URL}:${SERVER_PORT}, opening connection setup:`, error);
        showBackendSettingsPage();
    }
}