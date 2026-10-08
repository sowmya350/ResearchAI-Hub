import os
import re
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import auth
import db
import explorer_module
import gene_module
import satellite_module


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="ResearchAI Hub API", lifespan=lifespan)
ORIGINS = ["http://localhost:5173"] + [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS,
                   allow_methods=["*"], allow_headers=["*"])
MAX_BYTES = 10 * 1024 * 1024


class Credentials(BaseModel):
    username: str
    password: str


async def _read(file: UploadFile) -> bytes:
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file.")
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File too large (max 10 MB).")
    return data


# ---------- Auth ----------
@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/auth/register")
def register(c: Credentials):
    username = c.username.strip()
    if not re.fullmatch(r"[A-Za-z0-9_.-]{3,30}", username):
        raise HTTPException(422, "Username must be 3-30 characters: letters, numbers, _ . -")
    if len(c.password) < 6:
        raise HTTPException(422, "Password must be at least 6 characters.")
    uid = db.create_user(username, auth.hash_password(c.password))
    if uid is None:
        raise HTTPException(409, "That username is already taken.")
    return {"token": auth.create_token(uid, username), "user": {"id": uid, "username": username}}


@app.post("/api/auth/login")
def login(c: Credentials):
    user = db.get_user(c.username.strip())
    if not user or not auth.verify_password(c.password, user["password_hash"]):
        raise HTTPException(401, "Invalid username or password.")
    return {"token": auth.create_token(user["id"], user["username"]),
            "user": {"id": user["id"], "username": user["username"]}}


@app.get("/api/auth/me")
def me(user=Depends(auth.current_user)):
    return user


# ---------- Modules (login required) ----------
@app.post("/api/gene/analyze")
async def gene_analyze(file: UploadFile = File(...), user=Depends(auth.current_user)):
    data = await _read(file)
    try:
        result = gene_module.analyze(data)
    except gene_module.ValidationError as e:
        raise HTTPException(422, str(e))
    s = result["summary"]
    result["analysis_id"] = db.save_analysis(
        user["id"], "gene", file.filename,
        f"{s['samples']} samples, {s['genes']} genes, CV accuracy {s['cv_accuracy']:.0%}", result)
    return result


@app.post("/api/satellite/predict")
async def satellite_predict(file: UploadFile = File(...), user=Depends(auth.current_user)):
    data = await _read(file)
    try:
        result = satellite_module.predict(data)
    except satellite_module.ValidationError as e:
        raise HTTPException(422, str(e))
    result["analysis_id"] = db.save_analysis(
        user["id"], "satellite", file.filename,
        f"{result['label']} ({result['confidence']:.0%})", result)
    return result


@app.post("/api/explorer/analyze")
async def explorer_analyze(file: UploadFile = File(...), user=Depends(auth.current_user)):
    data = await _read(file)
    try:
        result = explorer_module.analyze(data)
    except explorer_module.ValidationError as e:
        raise HTTPException(422, str(e))
    s = result["summary"]
    result["analysis_id"] = db.save_analysis(
        user["id"], "explorer", file.filename, f"{s['rows']} rows x {s['columns']} columns", result)
    return result


# ---------- Saved results (history) ----------
@app.get("/api/history")
def history(user=Depends(auth.current_user)):
    return db.list_analyses(user["id"])


@app.get("/api/history/{aid}")
def history_item(aid: int, user=Depends(auth.current_user)):
    item = db.get_analysis(user["id"], aid)
    if not item:
        raise HTTPException(404, "Result not found.")
    return item


@app.delete("/api/history/{aid}")
def history_delete(aid: int, user=Depends(auth.current_user)):
    if not db.delete_analysis(user["id"], aid):
        raise HTTPException(404, "Result not found.")
    return {"deleted": aid}


# ---------- Serve the built React app (cloud / Docker deployment) ----------
STATIC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
if os.path.isdir(os.path.join(STATIC, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC, "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(404, "Not found.")
        root = os.path.realpath(STATIC)
        candidate = os.path.realpath(os.path.join(STATIC, full_path))
        if full_path and candidate.startswith(root + os.sep) and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(STATIC, "index.html"))
