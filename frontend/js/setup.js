function setupApp() {
    document.getElementById('topbar').style.display = "none";
    document.getElementById('content').style.display = "none";
    document.getElementById('statusbar').style.display = "block";

    // display compsy logo in status bar
    const statusBar = document.getElementById('statusbar');
    statusBar.replaceChildren(); // Clean container safely without innerHTML
    const logoContainer = document.createElement('div');
    const logoImg = document.createElement('img');
    logoImg.src = "img/compsy_group_full.png";
    logoImg.alt = "Compsy Logo";
    logoImg.className = "compsy-logo";
    logoContainer.appendChild(logoImg);
    statusBar.appendChild(logoContainer);
    
    const loginContainer = document.getElementById('loginContainer');
    loginContainer.style.display = "block";
    loginContainer.replaceChildren(); // Clean container safely without innerHTML

    // Outer Material-style Card
    const setupBox = document.createElement('div');
    setupBox.id = "setupBox";
    setupBox.className = "card material-card shadow-lg mx-auto my-4";

    const cardBody = document.createElement('div');
    cardBody.className = "card-body p-4";

    const title = document.createElement('h2');
    title.className = "card-title text-center mb-4";
    title.textContent = "Psytag Setup";
    cardBody.appendChild(title);

    const form = document.createElement('form');
    form.id = "setupForm";

    // Helper to generate fixed-label form groups
    function createFormGroup(id, type, labelText, placeholderText, isRequired = false, value = "") {
        const group = document.createElement('div');
        group.className = "form-group material-group position-relative mb-3";

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

    // --- Section 1: Generic Fields ---
    const genericFields = document.createElement('div');
    genericFields.id = "genericFields";
    genericFields.className = "setup-section";

    genericFields.appendChild(createFormGroup("username", "text", "Username", "admin", true));
    genericFields.appendChild(createFormGroup("fullName", "text", "Full Name", "Admin User", true));
    genericFields.appendChild(createFormGroup("email", "email", "Email", "admin@example.edu", true));

    // Login Type Select
    const selectGroup = document.createElement('div');
    selectGroup.className = "form-group material-group position-relative mb-3";

    const select = document.createElement('select');
    select.id = "loginType";
    select.name = "loginType";
    select.className = "form-control material-input";
    select.required = true;

    const optDefault = document.createElement('option');
    optDefault.value = "";
    optDefault.disabled = true;
    optDefault.selected = true;
    optDefault.textContent = "Select Login Type";

    const optLocal = document.createElement('option');
    optLocal.value = "local";
    optLocal.textContent = "Local";

    const optLdap = document.createElement('option');
    optLdap.value = "ldap";
    optLdap.textContent = "LDAP";

    select.appendChild(optDefault);
    select.appendChild(optLocal);
    select.appendChild(optLdap);

    const selectLabel = document.createElement('label');
    selectLabel.htmlFor = "loginType";
    selectLabel.className = "material-label select-label";
    selectLabel.textContent = "Login Type";

    selectGroup.appendChild(select);
    selectGroup.appendChild(selectLabel);
    genericFields.appendChild(selectGroup);
    form.appendChild(genericFields);

    // --- Section 2: Local Password Fields ---
    const localFields = document.createElement('div');
    localFields.id = "localFields";
    localFields.className = "setup-section";
    localFields.style.display = "none";

    localFields.appendChild(createFormGroup("password", "password", "Password", "password"));
    localFields.appendChild(createFormGroup("passwordConfirm", "password", "Confirm Password", "password"));
    form.appendChild(localFields);

    // --- Section 3: LDAP Fields ---
    const ldapFields = document.createElement('div');
    ldapFields.id = "ldapFields";
    ldapFields.className = "setup-section";
    ldapFields.style.display = "none";

    ldapFields.appendChild(createFormGroup("ldapServer", "text", "LDAP Server", "ldap://your-ldap-server.com"));
    ldapFields.appendChild(createFormGroup("ldapDomain", "text", "LDAP User Domain (Optional)", "yourdomain-edu"));
    ldapFields.appendChild(createFormGroup("ldapBase", "text", "LDAP Base Domain (Optional)", "dc=example,dc=com"));
    form.appendChild(ldapFields);

    // --- Section 4: Database Fields ---
    const dbFields = document.createElement('div');
    dbFields.id = "dbFields";
    dbFields.className = "setup-section border-top pt-3 mt-3";

    const dbHeader = document.createElement('h6');
    dbHeader.className = "text-muted font-weight-bold mb-3";
    dbHeader.textContent = "Database Configuration";
    dbFields.appendChild(dbHeader);

    dbFields.appendChild(createFormGroup("dbUri", "text", "Database URI", "mongodb://mongodb:27017", true));
    dbFields.appendChild(createFormGroup("dbName", "text", "Database Name", "psytag", true));
    form.appendChild(dbFields);

    // --- Section 5: Storage Upload Fields ---
    const uploadFields = document.createElement('div');
    uploadFields.id = "uploadFields";
    uploadFields.className = "setup-section border-top pt-3 mt-3";

    const uploadHeader = document.createElement('h6');
    uploadHeader.className = "text-muted font-weight-bold mb-3";
    uploadHeader.textContent = "Storage Configuration";
    uploadFields.appendChild(uploadHeader);

    const uploadMaxGroup = document.createElement('div');
    uploadMaxGroup.className = "form-group material-group position-relative mb-3";

    const uploadMaxInput = document.createElement('input');
    uploadMaxInput.type = "number";
    uploadMaxInput.id = "uploadMax";
    uploadMaxInput.name = "uploadMax";
    uploadMaxInput.className = "form-control material-input";
    uploadMaxInput.placeholder = "1024";
    uploadMaxInput.required = true;

    const uploadMaxLabel = document.createElement('label');
    uploadMaxLabel.htmlFor = "uploadMax";
    uploadMaxLabel.className = "material-label";
    uploadMaxLabel.textContent = "Maximum Upload Size (MB)";

    uploadMaxGroup.appendChild(uploadMaxInput);
    uploadMaxGroup.appendChild(uploadMaxLabel);
    uploadFields.appendChild(uploadMaxGroup);
    form.appendChild(uploadFields);

    // --- Buttons ---
    const buttonContainer = document.createElement('div');
    buttonContainer.className = "d-flex justify-content-end gap-2 mt-4 pt-2";

    const submitBtn = document.createElement('button');
    submitBtn.type = "submit";
    submitBtn.id = "submitButton";
    submitBtn.className = "btn btn-primary material-btn ripple px-4 py-2";
    submitBtn.textContent = "Setup";

    const continueBtn = document.createElement('button');
    continueBtn.type = "button";
    continueBtn.id = "continueButton";
    continueBtn.className = "btn btn-success material-btn ripple px-4 py-2";
    continueBtn.style.display = "none";
    continueBtn.textContent = "Continue";

    buttonContainer.appendChild(submitBtn);
    buttonContainer.appendChild(continueBtn);
    form.appendChild(buttonContainer);

    cardBody.appendChild(form);

    // Status / Error Area
    const setupError = document.createElement('div');
    setupError.id = "setupError";
    setupError.className = "mt-3 text-center font-weight-bold";
    cardBody.appendChild(setupError);

    setupBox.appendChild(cardBody);
    loginContainer.appendChild(setupBox);

    // Attach Event Listeners
    select.addEventListener('change', showHideSetupFields);
    form.addEventListener('submit', attemptSetup);
    continueBtn.addEventListener('click', initializeApp);
}


function showHideSetupFields() {
    var loginTypeSelect = document.getElementById('loginType');
    var loginType = loginTypeSelect.value;

    var localFields = document.getElementById('localFields');
    var ldapFields = document.getElementById('ldapFields');
    if (loginType === 'local') {
        // show local fields, hide LDAP fields
        localFields.style.display = 'block';
        ldapFields.style.display = 'none';
        // make local fields required, ldap fields not required
        document.getElementById('password').required = true;
        document.getElementById('passwordConfirm').required = true;
        document.getElementById('ldapServer').required = false;
    } else if (loginType === 'ldap') {
        localFields.style.display = 'none';
        ldapFields.style.display = 'block';
        // make LDAP fields required, local fields not required
        document.getElementById('password').required = false;
        document.getElementById('passwordConfirm').required = false;
        document.getElementById('ldapServer').required = true;
    } else {
        localFields.style.display = 'none';
        ldapFields.style.display = 'none';
        document.getElementById('password').required = false;
        document.getElementById('passwordConfirm').required = false;
        document.getElementById('ldapServer').required = false;
    }
}


async function attemptSetup(event) {
    event.preventDefault(); // prevent form submission
    
    var username = document.getElementById('username').value;
    var fullname = document.getElementById('fullName').value;
    var email = document.getElementById('email').value;
    var loginType = document.getElementById('loginType').value;
    var db_uri = document.getElementById('dbUri').value;
    var db_name = document.getElementById('dbName').value;
    //var upload_dir = document.getElementById('uploadDir').value;
    var upload_max = document.getElementById('uploadMax').value;

    // makesure username is a valid identifier
    var identifierPattern = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
    if (!identifierPattern.test(username)) {
        document.getElementById('setupError').innerText = "Username must start with a letter or underscore and can only contain letters, digits, underscores, or hyphens.";
        return;
    }

    // check email format
    var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        document.getElementById('setupError').innerText = "Please enter a valid email address.";
        return;
    }

    // check format of db_uri
    if (!db_uri.startsWith('mongodb://') && !db_uri.startsWith('mongodb+srv://')) {
        document.getElementById('setupError').innerText = "Database URI must start with mongodb:// or mongodb+srv://";
        return;
    }
    // make sure db_name is a valid identifier
    if (!identifierPattern.test(db_name)) {
        document.getElementById('setupError').innerText = "Database Name must start with a letter or underscore and can only contain letters, digits, underscores, or hyphens.";
        return;
    }
    
    // // make sure upload_dir is a valid path name
    // var pathPattern = /^[a-zA-Z0-9_\-\/]+$/;
    // if (!pathPattern.test(upload_dir)) {
    //     document.getElementById('setupError').innerText = "Please type a valid upload path.";
    //     return;
    // }
    // // reverse slashes in upload_dir to avoid confusion with escape characters
    // upload_dir = upload_dir.replace(/\\/g, '/');

    // make sure upload_max is a positive integer and less than 3GB (user enter in MB)
    var uploadMaxInt = parseInt(upload_max);
    if (isNaN(uploadMaxInt) || uploadMaxInt <= 0 || uploadMaxInt > 3000) {
        document.getElementById('setupError').innerText = "Maximum Upload Size must be a positive integer less than or equal to 3000 (MB).";
        return;
    }
    // convert uploadMaxInt from MB to bytes
    upload_max = uploadMaxInt * 1024 * 1024;

    var setupData = {
        username: username,
        fullname: fullname,
        email: email,
        login_type: loginType,
        db_uri: db_uri,
        db_name: db_name,
        //upload_dir: upload_dir,
        upload_max: upload_max
    };

    if (loginType === 'local') {
        var password = document.getElementById('password').value;
        var passwordConfirm = document.getElementById('passwordConfirm').value;

        // check if two passwords match
        if (password !== passwordConfirm) {
            document.getElementById('setupError').innerText = "Passwords do not match.";
            return;
        }
        //check if password meets criteria
        if (password.length < 8) {
            document.getElementById('setupError').innerText = "Password must be at least 8 characters long.";
            return;
        }
        else if ((!/[A-Z]/.test(password)) || (!/[a-z]/.test(password)) || (!/[0-9]/.test(password))) {
            document.getElementById('setupError').innerText = "Password must contain at least one uppercase letter, one lowercase letter, and one digit.";
            return;
        }

        setupData.password = password;
    }
    else if (loginType === 'ldap') {
        ldap_server = document.getElementById('ldapServer').value;
        ldap_domain = document.getElementById('ldapDomain').value;
        ldap_base = document.getElementById('ldapBase').value;

        // check the format of ldap_server
        if (!ldap_server.startsWith('ldap://') && !ldap_server.startsWith('ldaps://')) {
            document.getElementById('setupError').innerText = "LDAP Server must start with ldap:// or ldaps://";
            return;
        }
        // if provided, check the format of ldap_base
        if (ldap_base.length > 0) {
            const dcPattern = /^dc=[^,]+(,dc=[^,]+)*$/i;
            if (!dcPattern.test(ldap_base)) {
                document.getElementById('setupError').innerText = "LDAP Base Domain must be in the format dc=example,dc=com";
                return;
            }
        }

        setupData.ldap_server = ldap_server;
        setupData.ldap_domain = ldap_domain;
        setupData.ldap_base = ldap_base;
    }

    const response = await fetchResponse("setup", "POST", setupData);
    if (response && response.status === "success") {
        // show message for successful setup for 2.5 seconds and then initialize app
        document.getElementById('setupError').style.color = "green";
        message = "Setup completed successfully! <br>Please save the following API key securely. " +
              "It will not be displayed again and you will need it to access the system. <br><br>" +
              "<b>API Key: " + response.API_key + "</b>" +
              "<br><br>Once you save the API key, click Continue to proceed to the application.";
        document.getElementById('setupError').innerHTML = message;
        document.getElementById('submitButton').style.display = "none";
        document.getElementById('continueButton').style.display = "block";
    } else {
        document.getElementById('setupError').innerText = "Failed to complete setup.";
    }
}