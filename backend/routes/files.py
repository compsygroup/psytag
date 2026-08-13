from fastapi import APIRouter, Depends
from fastapi import UploadFile, File as FastFile, Form
from fastapi import Request, HTTPException
from fastapi.responses import StreamingResponse
from typing import Any, Dict
from datetime import datetime, timezone
import uuid, pathlib, os, hashlib
import json
import librosa
import numpy as np
from moviepy import VideoFileClip
import traceback

from lib.functions import validate_id
from lib.models import File, Task, User, Project
from lib.auth import Authenticator, verify_token
from lib.project import user_admin_or_manager

# check if config/upload.json exists, if not use default values
if not os.path.isfile("config/upload.json"):
    UPLOAD_DIR = "uploads"
    MAX_UPLOAD_BYTES = 1 * 1024 * 1024 * 1024  # 1 GB
else: 
    with open("config/upload.json", "r") as f:
            config = json.load(f)

            if config.get("dir", None):
                UPLOAD_DIR = config["dir"]
            else:
                UPLOAD_DIR = "uploads"
            
            if config.get("max_bytes", None):
                MAX_UPLOAD_BYTES = config["max_bytes"]
            else:
                MAX_UPLOAD_BYTES= 1 * 1024 * 1024 * 1024  # 1 GB

router = APIRouter(prefix="/files", tags=["files"], dependencies=[Depends(verify_token)])

@router.get("/") # read all files
def list_files(token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    user = User.read(token_payload['uid'])
    if user is None:
        return {"data": None, "error": "Invalid user"}

    # only admins can see all files
    if getattr(user, "admin", False):
        files = File.all()
    else:
        files = File.all(query={"user_id": user.id})
    
    if files is None:
        return {"data": None, "error": "Unauthorized"}
    
    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": [file for file in files], "token": refreshed_token}


@router.get("/{fid}")  # read a specific file by ID
def read_file(fid: str, token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if the provided file ID is valid
    if not validate_id(fid, File):
        return {"data": None, "error": "File not found"}
    file = File.read(fid)
    
    # check if user is admin
    user = User.read(token_payload['uid'])
    if user is None or (not getattr(user, "admin", False) and file.user_id != user.id):
        return {"data": None, "error": "Unauthorized"}

    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": file, "token": refreshed_token}


@router.get("/project/{pid}")  # read all files of a project
def list_project_files(pid: str, token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if the provided project ID is valid
    if not validate_id(pid, Project):
        return {"data": None, "error": "Project not found"}

    # check if the user is admin or manager of the project
    if not user_admin_or_manager(pid, token_payload['uid']):
        return {"data": None, "error": "Unauthorized"}

    # get all files of the project (we need to read tasks of the project to get their file IDs)
    tasks = Task.all(query={"project_id": pid})
    file_ids = [task['file_id'] for task in tasks if 'file_id' in task]

    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": [File.read(id) for id in file_ids], "token": refreshed_token}


@router.post("/")  # ingest a new file (let everybody to ingest a file)
def ingest_file(nfile: File, token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if required fields are provided
    required_fields = ["file_path"]
    for field in required_fields:
        if not getattr(nfile, field, None):
            return {"data": None, "error": f"{field} is required"}
    
    # check if file exists on the server
    server_path = os.path.join(UPLOAD_DIR, nfile.file_path.lstrip(os.sep))
    if not os.path.isfile(server_path):
        return {"data": None, "error": f"file_path does not exist on the server: {server_path}"}

    # calculate sha256sum of the file
    sha256 = hashlib.sha256()
    with open(server_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256.update(byte_block)
    file_hash = sha256.hexdigest()
        
    # check if a file with the same sha256sum already ingested
    existing_files = File.all(query={"sha256sum": file_hash})
    
    existing = False
    if len(existing_files) > 0:
        fid = existing_files[0]['id']
        existing = True
    else:
        # @TODO: Check against SDS
        
        # automatically fill other fields
        nfile.date_created = datetime.now(timezone.utc).isoformat()
        nfile.user_id = token_payload['uid']
        nfile.sha256sum = file_hash
        # modality (video, image, or audio) based on suffix
        nfile.data_type = server_path.split('.')[-1].lower()
        if nfile.data_type in ["mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "vob", "ogv", "mpg", "mpeg", "3gp", "3g2"]:
            nfile.modality = "video"
        elif nfile.data_type in ["jpg", "png", "jpeg", "bmp", "tiff", "gif", "avif", "svg", "webp", "heic", "raw"]:
            nfile.modality = "image"
        elif nfile.data_type in ["mp3", "wav", "flac", "aac", "ogg", "wma", "alac", "aiff", "pcm", "m4a"]:
            nfile.modality = "audio"
        else:
            nfile.modality = "unknown"
        # @TODO: extract more metadata from the file, specific to modalitity (https://chatgpt.com/s/t_694b5216d1a4819182cecc48cc20e5d7)
        ctype = nfile.modality + "/" + nfile.data_type
        nfile.header = {"Content-Type": ctype,
                       "Size-Bytes": os.path.getsize(server_path),
                       "Filename": os.path.basename(server_path)}
        
        # Precompute waveform for audio/video media
        if nfile.modality in ["audio", "video"]:
            try:
                if nfile.modality == "video":
                    try:
                        video_clip = VideoFileClip(server_path)
                        
                        # Cleanly check if an audio track actually exists
                        if video_clip.audio is not None:
                            sr = 22050  # standard sample rate for waveform generation
                            y_raw = video_clip.audio.to_soundarray(fps=sr)
                            video_clip.close()
                            
                            # moviepy returns shape (samples, channels). Convert to mono (1D array)
                            if y_raw is not None and y_raw.ndim > 1:
                                y = np.mean(y_raw, axis=1)
                            elif y_raw is not None:
                                y = y_raw
                            else:
                                y = np.zeros(10)
                        else:
                            # No audio track found
                            video_clip.close()
                            y = np.zeros(10)
                            sr = 22050
                            
                    except Exception as e:
                        print(f"Video extraction failed: {e}")
                        y = np.zeros(10)
                        sr = 22050
                else:
                    y, sr = librosa.load(server_path, sr=None, mono=True)
                
                # Dynamic sampling:
                duration_seconds = len(y) / sr
                target_resolution = 30 # points per second (1 point every 33ms, 1 frame for 30fps video)
                
                # Calculate samples, clamping between 10 (min) and 16384 (max)
                calculated_samples = int(duration_seconds * target_resolution)
                samples = max(10, min(calculated_samples, 16384))
                
                length = len(y)
                block = max(1, length // samples)
                waveform = []
                for i in range(samples):
                    start = i * block
                    stop = min(start + block, length)
                    if start < length:
                        waveform.append(float(np.max(np.abs(y[start:stop]))))
                    else:
                        waveform.append(0.0)
                max_val = max(waveform) if waveform else 0
                if max_val > 0:
                    waveform = [w / max_val for w in waveform]
                nfile.waveform = waveform
            except Exception as e:
                print(f"Waveform generation failed: {e}")
                traceback.print_exc()
        
        nfile.create()
        # check if the file was ingested correctly
        if not nfile.exists(True):
            return {"data": None, "error": "Failed to ingest file"}
        fid = nfile.id

    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": {"id": fid, "existing": existing}, "token": refreshed_token}


@router.post("/upload")  # upload a new file (only admins)
async def upload_file(upload: UploadFile = FastFile(...), metadata: str = Form("{}"), token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # only admins or managers can upload files
    current_user = User.read(token_payload['uid'])
    if (current_user is None) or ((not getattr(current_user, "admin", False)) and (not getattr(current_user, "manager", False))):
        return {"data": None, "error": "Unauthorized"}
    
    # convert nfile from Form string to File object
    nfile = File(**json.loads(metadata)) if metadata else File()
    # add fields in metadata that are not in File model to nfile.extra
    for key in json.loads(metadata).keys():
        if not hasattr(nfile, key):
            if nfile.extra is None:
                nfile.extra = {}
            nfile.extra[key] = json.loads(metadata)[key]
    
    # check if required fields are provided
    required_fields = ["file_path"]
    for field in required_fields:
        if not getattr(nfile, field, None):
            return {"data": None, "error": f"{field} is required"}
        
    # check if upload is provided
    if upload is None:
        return {"data": None, "error": "File upload is required"}
    
    # make sure we have / in nfile.file_path, not \ (for Windows)
    nfile.file_path = nfile.file_path.replace("\\", "/")

    # save the uploaded file to UPLOAD_DIR with a unique name
    # treat nfile.file_path as the new folder relative to UPLOAD_DIR, but sanitize it
    rel_path = os.path.normpath(nfile.file_path).lstrip(os.sep).replace("..", "")
    folder_path = os.path.join(UPLOAD_DIR, rel_path)
    os.makedirs(folder_path, exist_ok=True)
    
    # suffix = pathlib.Path(upload.filename).suffix
    # unique_filename = str(uuid.uuid4()) + suffix
    # saved_path = os.path.join(folder_path, unique_filename)
    
    # sanitize filename to avoid directory traversal
    unique_filename = os.path.basename(upload.filename)
    saved_path = os.path.join(folder_path, unique_filename)

    # store original filename just in case
    nfile.original_file_name = upload.filename
    
    sha256 = hashlib.sha256()
    total_bytes = 0
    with open(saved_path, "wb") as buffer:
        while True:
            chunk = upload.file.read(1024 * 1024)  # read in 1 MB chunks
            if not chunk:
                break
            total_bytes += len(chunk)
            if total_bytes > MAX_UPLOAD_BYTES:
                buffer.close()
                os.remove(saved_path)
                # raise HTTPException(status_code=413, detail="Uploaded file too large")
                return {"data": None, "error": "Uploaded file exceeds maximum allowed size"}
            buffer.write(chunk)
            sha256.update(chunk)
    file_hash = sha256.hexdigest()
    # close underlying UploadFile file
    try:
        upload.file.close()
    except Exception:
        pass
    
    # @TODO: check sha256 with user provided hash in nfile.sha256sum if provided

    nfile.file_path = os.path.join(rel_path, unique_filename).replace("\\", "/")
    
    # call ingest_file to handle the rest without code duplication
    response = ingest_file(nfile, token_payload)
    
    # in failure or pre-existing, delete the newly uploaded file to avoid orphan files
    condition1 = "error" in response and response["error"]
    condition2 = "data" in response and response["data"] and "existing" in response["data"] and response["data"]["existing"]
    if condition1 or condition2:
        try:
            if os.path.isfile(saved_path):
                os.remove(saved_path)
        except Exception:
            pass
    
    return response


@router.put("/{fid}")  # update a specific file
def update_file(fid: str, data: Dict[str, Any], token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if the provided file ID is valid
    if not validate_id(fid, File):
        return {"data": None, "error": "File not found"}
    nfile = File.read(fid)
    
    # check if user is admin or the creator of the file
    user = User.read(token_payload['uid'])
    if user is None or (not getattr(user, "admin", False) and nfile.user_id != user.id):
        return {"data": None, "error": "Unauthorized"}

    # update fields
    for key, value in data.items():
        setattr(nfile, key, value)
    nfile.date_modified = datetime.now(timezone.utc).isoformat()
    nfile.update()

    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": {"status": "success"}, "token": refreshed_token}


@router.delete("/{fid}/{full_delete}")  # delete a specific file
def delete_file(fid: str, full_delete: bool = True, token_payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    # check if the provided file ID is valid
    if not validate_id(fid, File):
        return {"data": None, "error": "File not found"}
    nfile = File.read(fid)
    
    # check if user is admin or the creator of the file
    user = User.read(token_payload['uid'])
    if user is None or (not getattr(user, "admin", False) and nfile.user_id != user.id):
        return {"data": None, "error": "Unauthorized"}

    # delete the file
    nfile.delete()
    
    # delete the actual file from the server if full_delete is True
    if full_delete:
        server_path = os.path.join(UPLOAD_DIR, nfile.file_path.lstrip(os.sep))
        try:
            if os.path.isfile(server_path):
                os.remove(server_path)
        except Exception:
            pass

    # refresh token after each successful request
    refreshed_token = Authenticator.refresh_token(token_payload)

    return {"data": {"status": "success"}, "token": refreshed_token}


@router.get("/serve/{fid}")
def serve_file(fid: str, request: Request, token: str = None):
    # Manually verify the token since it's coming from a query parameter
    # verify_token raises an exception on failure
    try:
        token_payload = verify_token(token)
    except Exception:
        return {"data": None, "error": "Unauthorized"}
    
    # check if user is part of any project that uses this file (a task that has this file_id and a project_id that the user is part of)
    user = User.read(token_payload['uid'])
    all_projects = Project.all()
    user_projects = [project for project in all_projects if (user.id in project['users'] or user.id in project['managers'] or user.id == project['user_id'])]
    for project in user_projects:
        tasks = Task.all(query={"project_id": project['id'], "file_id": fid})
        if len(tasks) > 0:
             break
    else:
        if not getattr(user, "admin", False):
            return {"data": None, "error": "Unauthorized"}
    
    if not validate_id(fid, File):
        return {"data": None, "error": "File not found"}
    nfile = File.read(fid)

    # file_path = os.path.join(UPLOAD_DIR, nfile.file_path.lstrip(os.sep))
    normalized_path = nfile.file_path.replace("\\", "/")
    file_path = os.path.normpath(os.path.join(UPLOAD_DIR, normalized_path.lstrip("/")))
    if not os.path.isfile(file_path):
        return {"data": None, "error": f"File not found on server: {nfile.file_path} {file_path}"}

    # Handle Range Header (Seeking)
    file_size = os.path.getsize(file_path)
    range_header = request.headers.get("Range")
    
    start = 0
    end = file_size - 1
    status_code = 200

    if range_header:
        # Standard format: "bytes=start-end"
        try:
            ranges = range_header.replace("bytes=", "").split("-")
            if ranges[0]:
                start = int(ranges[0])
            if ranges[1]:
                end = int(ranges[1])
            
            status_code = 206
        except (ValueError, IndexError):
            pass # Fallback to full file if header is malformed

    # Validate range boundaries
    if start > end or start >= file_size:
        raise HTTPException(status_code=416, detail="Requested Range Not Satisfiable")
    
    if end >= file_size:
        end = file_size - 1

    content_length = end - start + 1

    # Define File Generator
    def file_generator(path, offset, chunk_size=8192):
        with open(path, "rb") as f:
            f.seek(offset)
            remaining = content_length
            while remaining > 0:
                chunk = f.read(min(chunk_size, remaining))
                if not chunk:
                    break
                yield chunk
                remaining -= len(chunk)

    # Set Response Headers
    file_header = nfile.header or {} 
    content_type = file_header.get("Content-Type", "application/octet-stream")
    headers = {
        "Accept-Ranges": "bytes",
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Content-Length": str(content_length),
        "Content-Disposition": f'inline; filename="{os.path.basename(file_path)}"',
    }

    return StreamingResponse(
        file_generator(file_path, start),
        status_code=status_code,
        media_type=content_type,
        headers=headers
    )

