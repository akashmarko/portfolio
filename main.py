"""
main.py — Portfolio Desktop FastAPI backend
-------------------------------------------
Serves the static frontend and exposes /api/projects from projects.json.
To run:  uvicorn main:app --reload
"""

import json
import pathlib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

# ── App init ─────────────────────────────────────────────────────────────────
app = FastAPI(title="Portfolio Desktop API")

# ── CORS (allow all origins for local dev) ───────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# ── Load project data at startup ─────────────────────────────────────────────
_BASE = pathlib.Path(__file__).parent
_PROJECTS_FILE = _BASE / "projects.json"

with open(_PROJECTS_FILE, encoding="utf-8") as fh:
    PROJECTS: list[dict] = json.load(fh)

# ── Static files ──────────────────────────────────────────────────────────────
# Serves everything under ./static at the /static URL prefix.
app.mount("/static", StaticFiles(directory=str(_BASE / "static")), name="static")

# ── API routes ────────────────────────────────────────────────────────────────

@app.get("/api/projects")
def get_projects() -> JSONResponse:
    """Return the full list of portfolio projects from projects.json."""
    return JSONResponse(content=PROJECTS)


# ── Root-level assets (must be declared before the catch-all) ────────────────
@app.get("/style.css")
def serve_css() -> FileResponse:
    return FileResponse(str(_BASE / "style.css"), media_type="text/css")

@app.get("/script.js")
def serve_js() -> FileResponse:
    return FileResponse(str(_BASE / "script.js"), media_type="application/javascript")

# ── Catch-all: serve index.html for any non-API, non-static path ──────────────
@app.get("/{full_path:path}")
def serve_frontend(full_path: str) -> FileResponse:
    index = _BASE / "index.html"
    return FileResponse(str(index))
