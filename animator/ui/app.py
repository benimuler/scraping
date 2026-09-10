"""Stage 7 — a small local Flask app to review the film and re-roll bad shots.

Deliberately minimal: it reads the same state.json the CLI writes, so the two
never disagree, and a regeneration from the UI is the same code path as
`animator regen <shot_id>`.
"""

from __future__ import annotations

import threading
import traceback
from pathlib import Path
from typing import Any

from flask import Flask, abort, jsonify, render_template, request, send_file

from ..config import Config
from ..logging_utils import get_logger
from ..orchestrator import Pipeline
from ..state import STAGES, RunState

log = get_logger("ui")


def create_app(cfg: Config) -> Flask:
    app = Flask(__name__)
    app.config["ANIMATOR_CFG"] = cfg
    out_dir = cfg.out_dir() / str(cfg.get("project.name", "demo"))

    jobs: dict[str, dict[str, Any]] = {}
    jobs_lock = threading.Lock()

    def snapshot() -> dict[str, Any]:
        from ..models import Project

        state = RunState.load_or_new(out_dir / "state.json")
        project_path = out_dir / "project.json"
        project = Project.load(project_path) if project_path.exists() else None
        film = out_dir / "film.mp4"

        shots = []
        for shot in (project.shots if project else []):
            entry = state.shot(shot.id)
            shots.append({
                "id": shot.id,
                "duration": shot.duration,
                "location": shot.location,
                "action": shot.action,
                "dialogue": shot.dialogue,
                "speaker": shot.speaker,
                "camera": shot.camera,
                "characters": shot.characters,
                "image_prompt": shot.image_prompt,
                "animation_prompt": shot.animation_prompt,
                "stages": {
                    stage: {
                        "status": entry.get(stage, {}).get("status", "pending"),
                        "error": entry.get(stage, {}).get("error"),
                        "provider": entry.get(stage, {}).get("provider", ""),
                        "attempts": entry.get(stage, {}).get("attempts", 0),
                        "has_file": bool(entry.get(stage, {}).get("path")
                                         and Path(entry[stage]["path"]).exists()),
                    }
                    for stage in STAGES
                },
            })

        with jobs_lock:
            running = {sid: j for sid, j in jobs.items() if j["status"] == "running"}
            recent = {sid: j for sid, j in jobs.items() if j["status"] != "running"}

        return {
            "title": project.title if project else "no breakdown yet",
            "logline": project.logline if project else "",
            "style": project.style if project else "",
            "characters": [vars(c) for c in (project.characters if project else [])],
            "shots": shots,
            "film": film.exists(),
            "providers": state.data.get("providers", {}),
            "jobs": {"running": list(running), "recent": recent},
        }

    @app.get("/")
    def index():
        return render_template("index.html", data=snapshot())

    @app.get("/api/status")
    def api_status():
        return jsonify(snapshot())

    @app.get("/media/<stage>/<shot_id>")
    def media(stage: str, shot_id: str):
        if stage not in STAGES:
            abort(404)
        state = RunState.load_or_new(out_dir / "state.json")
        path = state.path_for(shot_id, stage)
        if not path or not Path(path).exists():
            abort(404)
        return send_file(Path(path).resolve(), conditional=True)

    @app.get("/media/film")
    def film():
        path = out_dir / "film.mp4"
        if not path.exists():
            abort(404)
        return send_file(path.resolve(), conditional=True)

    @app.post("/api/regen/<shot_id>")
    def regen(shot_id: str):
        body = request.get_json(silent=True) or {}
        stages = tuple(s for s in body.get("stages", STAGES) if s in STAGES) or STAGES

        with jobs_lock:
            if jobs.get(shot_id, {}).get("status") == "running":
                return jsonify({"ok": False, "error": "already regenerating"}), 409
            jobs[shot_id] = {"status": "running", "stages": list(stages), "error": None}

        def worker():
            try:
                # A fresh Pipeline per job: it reloads state from disk, so a
                # regeneration started here behaves exactly like the CLI.
                pipeline = Pipeline(cfg, dry_run=False)
                pipeline.regenerate(shot_id, stages)
                pipeline.finish()
                result = {"status": "done", "stages": list(stages), "error": None}
            except Exception as exc:  # surfaced in the UI, not swallowed
                log.error("regen %s failed: %s", shot_id, exc)
                log.debug("%s", traceback.format_exc())
                result = {"status": "failed", "stages": list(stages), "error": str(exc)}
            with jobs_lock:
                jobs[shot_id] = result

        threading.Thread(target=worker, name=f"regen-{shot_id}", daemon=True).start()
        return jsonify({"ok": True, "shot": shot_id, "stages": list(stages)})

    @app.post("/api/assemble")
    def api_assemble():
        try:
            pipeline = Pipeline(cfg, dry_run=False)
            film_path = pipeline.assemble()
            pipeline.finish()
            return jsonify({"ok": True, "film": str(film_path)})
        except Exception as exc:
            return jsonify({"ok": False, "error": str(exc)}), 500

    return app
