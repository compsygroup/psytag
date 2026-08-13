import sys, os, requests
from typing import Any, Dict, Optional
from pathlib import Path
import json, mimetypes

SERVER_URL = os.getenv("SERVER_URL", "http://127.0.0.1")
SERVER_PORT = os.getenv("SERVER_PORT", "8000")

_session = requests.Session()
_token: Optional[str] = None

def login_api(api_key: str, server_url: str = None, server_port: str = None):
    if server_url:
        global SERVER_URL
        SERVER_URL = server_url
    if server_port:
        global SERVER_PORT
        SERVER_PORT = server_port
    
    data: Dict[str, Any] = {"api_key": api_key}
    out = fetch_response("login.api", "POST", data)

    # token is auto-captured by fetch_response; no need to set it again
    if isinstance(out, dict) and "token" in out and out["token"]:
        print("Login successful using API key.")
    else:
        print("Login failed using API key.")
        sys.exit(1)

def set_token(tok: str) -> None:
    global _token
    _token = tok

def get_base() -> str:
    # check if SERVER_URL has already http:// or https:// part
    if SERVER_URL.startswith("http://") or SERVER_URL.startswith("https://"):
        return f"{SERVER_URL}:{SERVER_PORT}"
    else:
        return f"http://{SERVER_URL}:{SERVER_PORT}"

def fetch_response(endpoint: str, method: str = "POST", data: Optional[Dict[str, Any]] = None, file_path: Optional[str] = None) -> Any:
    # check if the server is reachable
    try:
        resp = _session.get(get_base())
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"Error connecting to server: {e}")
        sys.exit(1)
    
    # if token is not set and the endpoint is not login, return error
    if not _token and endpoint != "login.api":
        print("No authentication token found. Please login first.")
        sys.exit(1)

    url = f"{get_base().rstrip('/')}/{endpoint.lstrip('/')}"

    if file_path:  # multipart/form-data.
        headers = {}  # NOTE: requests will set Content-Type multipart automatically
        if _token:
            headers["authorization"] = _token
        with open(file_path, "rb") as f:
            # guess mime
            ctype, _ = mimetypes.guess_type(file_path)
            files = {"upload": (Path(file_path).name, f, ctype or "application/octet-stream")}
            data = {"metadata": json.dumps(data)}
            resp = _session.post(url, data=data, files=files, headers=headers)
    else:
        headers = {"Content-Type": "application/json"}
        if _token:
            headers["authorization"] = _token
        resp = _session.request(method=method.upper(), url=url, json=data, headers=headers)
    
    out = resp.json() if resp.content else {}
        
    if isinstance(out, dict) and "token" in out and out["token"]:
        set_token(out["token"])
    
    if resp.status_code == 401:
        set_token(None)
        print("Unauthorized access. Please check your API key or login credentials.")
        sys.exit(1)
    elif isinstance(out, dict) and "error" in out and out["error"]:
        print(f"Error occurred: {out['error']}")
        sys.exit(1)

    return out.get("data", out)
