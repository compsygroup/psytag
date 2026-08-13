window.addEventListener('DOMContentLoaded', () => {
    // Programmatically bind actions for top bar using event listeners to avoid unsafe inline scripting triggers
    document.getElementById('nav-projects').addEventListener('click', () => loadProjects());
    // document.getElementById('nav-help').addEventListener('click', () => loadAbout());
    document.getElementById('nav-manage-projects').addEventListener('click', () => manageProjects());
    document.getElementById('nav-manage-users').addEventListener('click', () => manageUsers());
    document.getElementById('nav-logout').addEventListener('click', () => logout());

    // Load content area
    // Ensure config is loaded before making requests
    loadBackendConfig().then(() => {
        initializeApp(); // Load projects after config is ready
    });
});

