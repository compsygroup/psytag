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

# Installation

<h2 align="center"><strong>Installation</strong></h2>

Psytag has minimum requirements. If you can install and run simple web apps, you can run Psytag. We highly recommend using our Docker images since this option makes installation even easier.&#x20;

### **Installing Psytag**

Installation of Psytag is very straightforward. You need to run a database server (MongoDB), an API backend, and a frontend, just like any full stack webapp. **We recommend using our official Docker images as explained below.** If you like to make changes to Psytag, you can prefer installing directly from GitHub.

{% tabs %}
{% tab title="Docker (Recommended)" %}
If you are installing all the components (DB, backend, frontend) on a the same machine, we recommend creating a virtual Docker network to make configurations easier. This way, you don't need to provide actual IP addresses.&#x20;

```bash
docker network create psytag-net
```

You now need to create some directories to make sure your data and annotations are not lost when the Docker containers stop (i.e., make your data persistent across runs).

```bash
mkdir -p data/mongodb
mkdir -p data/files
mkdir -p config/backend
mkdir -p config/frontend
```

We will map these local directories to Docker containers so that you can access and edit your configurations if needed. This will also guarantee that your data and metadata (annotations) will be persistent. Let's pull and run Docker images now.

```bash
docker run -d --name mongodb --network psytag-net -p 27017:27017 -v ./data/mongodb:/data/db --restart always mongo:latest
docker run -d --name psytag-backend --network psytag-net -p 8000:8000 -v ./config/backend:/app/config -v ./data/files:/app/uploads --restart always compsygroup/psytag:backend-latest
docker run -d --name psytag-frontend --network psytag-net -p 8080:80 -v ./config/frontend:/usr/share/nginx/html/config --restart always compsygroup/psytag:frontend-latest
```

Note that we used `--restart always` flag to tell Docker system to restart the container if it fails or stops for any reason.

Open your browser and visit `localhost:8080`
{% endtab %}

{% tab title="GitHub" %}
If you are installing all the components (DB, backend, frontend) on the same machine, we recommend using local directory mappings to ensure your configuration files, data, and uploads remain persistent across runs.

First, create the necessary directories for persistence:

```bash
mkdir -p data/mongodb
mkdir -p config/backend
mkdir -p config/frontend
```

#### 1. Database Setup

We will run MongoDB using the official Docker image. Run the following command to start your database container:

```bash
docker run -d --name mongodb -p 27017:27017 -v ./data/mongodb:/data/db --restart always mongo:latest
```

#### 2. Backend Setup

Clone the backend repository, navigate into the directory, install the required Python dependencies, and start the FastAPI application using Uvicorn.

```bash
# Clone the repository
git clone https://github.com/compsygroup/psytag-backend
cd psytag-backend

# create upload directory
mkdir uploads

# Install dependencies
pip install --no-cache-dir -r requirements.txt

# Run the application
uvicorn main:app --host 0.0.0.0 --port 8000
```

#### 3. Frontend Setup

Clone the frontend repository. Because the frontend consists of static files (HTML, JS, CSS), you can serve them using a local web server (such as Nginx, Apache, or a simple Python HTTP server) or copy them directly to your web server's host directory.

```bash
# Clone the repository
git clone https://github.com/compsygroup/psytag-frontend
cd psytag-frontend

# Ensure appropriate file permissions for your web server
find . -type d -exec chmod 755 {} +
find . -type f -exec chmod 644 {} +

# Example: Serve locally using Python on port 8080
python3 -m http.server 8080
```

Open your browser and visit `localhost:8080`
{% endtab %}
{% endtabs %}

{% hint style="info" %}
Please note that we use MongoDB to store system management data (such as user accounts, project settings, and your annotations), but not your actual research media. Your raw data files (like videos, images, or audio) are stored separately in the `data/files` directory. If you do not want to host this system data on your own computer, you can skip installing the local MongoDB Docker image and use MongoDB's free, secure cloud service ([Atlas](https://www.mongodb.com/products/platform/atlas-database)) instead. For details, see the [Initial Setup](initial-setup.md) section.
{% endhint %}

### Installing Clients

We provide two optional clients: (1) a Python library for programmatic management of annotation projects (and everything included in Pystag), (2) an Electron desktop app that replicates Psytag frontend with a few extra features (_e.g._, batch uploading media files from your local computer using a CSV file).

{% hint style="info" %}
You don't need to install optional clients. You can use Psytag frontend for management through simple user interfaces. These clients are needed only for advanced use cases.
{% endhint %}

{% tabs %}
{% tab title="Python Library" %}
```bash
pip install psytag
```
{% endtab %}

{% tab title="Electron App" %}
Coming soon
{% endtab %}
{% endtabs %}
