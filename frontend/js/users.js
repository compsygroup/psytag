async function manageUsers(userId=null) {
    Navigation.setPage(manageUsers, userId);  // <-- set current page

    const current_user = await fetchResponse("users/my.info", "GET"); // user info

    // only managers and admins can manage users
    if (!current_user.admin && !current_user.manager) {
        const messages = document.getElementById('message-area');
        messages.innerHTML = "<div class='alert alert-danger'>Unauthorized access</div>";
        return;
    }

    const content = document.getElementById('content');
    content.innerHTML = "Loading...";

    // fetch users
    const all_users = await fetchResponse("users", "GET");

    // order users by fullname first, then by username ascending
    all_users.sort((a, b) => {
        if (a.fullname !== b.fullname) {
            return a.fullname < b.fullname ? 1 : -1;
        }
        return a.username < b.username ? 1 : -1;
    });

    // fetch user details if editing an existing one
    var user = {};
    if (userId !== null) {
        user = await fetchResponse(`users/${userId}`, "GET");
    } else {
        user = {
            username: null,
            fullname: null,
            email: null,
            active: true,
            admin: false,
            manager: false,
            API_access: false,
            password_access: false
        };
    }

    content.innerHTML = "";

    // Outer Material-style Card
    const cardBox = document.createElement('div');
    cardBox.className = "card material-card shadow-sm mx-auto my-4";
    cardBox.style.maxWidth = "800px"; 

    const cardBody = document.createElement('div');
    cardBody.className = "card-body p-4";

    // Header & Controls container
    const headerContainer = document.createElement('div');
    headerContainer.className = "d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 border-bottom pb-3 gap-3";
    
    const title = document.createElement('h3');
    title.className = "card-title m-0";
    title.textContent = userId ? "Edit User" : "Create New User";
    headerContainer.appendChild(title);

    // Dropdown User Selector
    const userSelect = document.createElement('select');
    userSelect.className = 'form-select material-input w-auto flex-grow-1 flex-md-grow-0';
    userSelect.style.minWidth = '250px';
    
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '+ Create New User';
    userSelect.appendChild(defaultOption);
    
    for (const u of all_users) {
        const option = document.createElement('option');
        option.value = u.id;
        if (userId && u.id === userId) {
            option.selected = true;
        }
        option.textContent = `${u.fullname} (${u.username})`;
        userSelect.appendChild(option);
    }
    
    userSelect.onchange = () => {
        // If empty, route to create new user (null)
        manageUsers(userSelect.value ? userSelect.value : null);
    };
    
    headerContainer.appendChild(userSelect);
    cardBody.appendChild(headerContainer);

    // Main editing form
    const formElement = document.createElement('form');
    formElement.id = "editUserForm";

    const formRow = document.createElement('div');
    formRow.className = "row";

    // --- Column 1: Text Fields ---
    const col1 = document.createElement('div');
    col1.className = "col-md-7 pe-md-4";

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

    col1.appendChild(createFormGroup("fullname", "text", "Full Name", "John Doe", true, user.fullname));
    col1.appendChild(createFormGroup("username", "text", "Username", "johndoe", true, user.username));
    col1.appendChild(createFormGroup("email", "email", "Email", "email@address.com", true, user.email));
    formRow.appendChild(col1);

    // --- Column 2: Permissions / Toggles ---
    const col2 = document.createElement('div');
    col2.className = "col-md-5 border-start ps-md-4 mt-4 mt-md-0";

    const permissionsHeader = document.createElement('h6');
    permissionsHeader.className = "text-muted font-weight-bold mb-3";
    permissionsHeader.textContent = "Permissions & Status";
    col2.appendChild(permissionsHeader);

    // Helper for Bootstrap Form Switches
    function createSwitch(id, labelText, isChecked) {
        const wrapper = document.createElement('div');
        wrapper.className = "form-check form-switch mb-3";

        const input = document.createElement('input');
        input.className = "form-check-input";
        input.type = "checkbox";
        input.id = id;
        input.name = id;
        input.checked = isChecked;
        input.style.cursor = "pointer";

        const label = document.createElement('label');
        label.className = "form-check-label";
        label.htmlFor = id;
        label.textContent = labelText;
        label.style.cursor = "pointer";

        wrapper.appendChild(input);
        wrapper.appendChild(label);
        return wrapper;
    }

    col2.appendChild(createSwitch("active", "Active Account", user.active));
    col2.appendChild(createSwitch("api_access", "API Access", user.API_access));
    col2.appendChild(createSwitch("password_access", "Password Access", user.password_access));
    // show these two toggles only if the current user is an admin
    if (current_user.admin) {
        col2.appendChild(createSwitch("admin", "System Admin", user.admin));
        col2.appendChild(createSwitch("manager", "Project Manager", user.manager));
    }
    
    formRow.appendChild(col2);
    formElement.appendChild(formRow);

    // --- Submit Button ---
    const buttonContainer = document.createElement('div');
    buttonContainer.className = "d-flex justify-content-end gap-2 mt-4 pt-3 border-top";

    const submitButton = document.createElement('button');
    submitButton.type = "submit";
    submitButton.className = "btn btn-primary material-btn ripple px-4 py-2";
    submitButton.textContent = userId === null ? 'Create User' : 'Save Changes';

    const deleteButton = document.createElement('button');
    deleteButton.type = "button";
    deleteButton.className = "btn btn-danger material-btn ripple px-4 py-2";
    deleteButton.textContent = 'Delete User';

    buttonContainer.appendChild(submitButton);
    buttonContainer.appendChild(deleteButton);
    formElement.appendChild(buttonContainer);
    
    cardBody.appendChild(formElement);
    cardBox.appendChild(cardBody);
    content.appendChild(cardBox);

    submitButton.onclick = async (e) => {
        e.preventDefault();
        
        // collect updated data
        const updatedUser = {
            fullname: document.getElementById('fullname').value,
            username: document.getElementById('username').value,
            email: document.getElementById('email').value,
            active: document.getElementById('active').checked,
            API_access: document.getElementById('api_access').checked,
            password_access: document.getElementById('password_access').checked
        };

        // only include admin and manager if current user is admin
        if (current_user.admin) {
            updatedUser.admin = document.getElementById('admin').checked;
            updatedUser.manager = document.getElementById('manager').checked;
        }

        // send update request
        let response;
        let word_success;
        let word_failure;
        let control;

        if (userId === null) {
            response = await fetchResponse(`users`, "POST", updatedUser);
            word_success = "created";
            word_failure = "creating";
            control = (response !== null && response !== undefined);
        } else {
            response = await fetchResponse(`users/${userId}`, "PUT", updatedUser);
            word_success = "updated";
            word_failure = "updating";
            control = (response !== null && response !== undefined && typeof response === "object" && "status" in response && response.status === "success");
        }      
        
        // Display message and take action
        const messages = document.getElementById('message-area');
        if (control) {
            // response can be an existing user ID
            if (typeof response === "string" || typeof response === "number") {
                response = {id: response};
            }
            let message = `<div class='alert alert-success'>User ${word_success} successfully!</div>`;
            
            let can_continue = true;
            if ("password" in response) {
                message += `<div class='alert alert-info margintop5'>A temporary password was generated for the user: <strong>${response.password}</strong><br />
                Please make sure to share this password with the user as it will not be shown again. The user will need to change the password after logging in.
                </div>`;
                can_continue = false;
            }
            if ("API_key" in response) {
                message += `<div class='alert alert-info margintop5'>An API key was generated for the user: <strong>${response.API_key}</strong><br />
                Please make sure to share this API key with the user as it will not be shown again. The user should keep it secure.
                </div>`;
                can_continue = false;
            }
            if ("password" in response || "API_key" in response) {
                message += `<div class='alert alert-warning margintop5'>The page will not be reloaded automatically. Please click Continue to return to the user list.</div>`;
                message += `<button class='btn btn-primary material-btn margintop10' id='continueMsgButton'>Continue</button><br /><br />`;
            }
            messages.innerHTML = message;
            window.scrollTo({ top: 0, behavior: 'smooth' });

            if (can_continue) {
                setTimeout(() => {
                    Navigation.reload();
                }, 2000);
            } else {
                document.getElementById('continueMsgButton').addEventListener('click', () => {
                    Navigation.reload();
                });
            }
        } else { 
            messages.innerHTML = `<div class='alert alert-danger'>Error ${word_failure} user!</div>`;
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    deleteButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete this user?')) {
            const messages = document.getElementById('message-area');
            fetchResponse(`users/${userId}`, "DELETE")
                .then(response => {
                    if (response !== null && response !== undefined && typeof response === "object" && "status" in response && response.status === "success") {
                        messages.innerHTML = `<div class='alert alert-success'>User deleted successfully!</div>`;
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        setTimeout(() => {
                            Navigation.reload();
                        }, 2000);
                    } else {
                        if (response !== null && response !== undefined && typeof response === "object" && "error" in response) {
                            messages.innerHTML = `<div class='alert alert-danger'>Error deleting user: ${response.error}</div>`;
                        } else {
                            messages.innerHTML = `<div class='alert alert-danger'>Error deleting user!</div>`;
                        }
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                });
        }
    });
}