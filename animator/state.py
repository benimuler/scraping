"""Resumable run state.

The whole point: a run that dies halfway — a crash, a rate limit, a Ctrl-C —
must not re-generate shots that already succeeded. Every stage of every shot
records its status, its output path, and a hash of the prompt that produced it.
On the next run a stage is skipped only when all three still line up, so a
changed prompt regenerates but an unchanged one never burns a second credit.
"""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
import time
from pathlib import Path
from typing import Any

from .logging_utils import get_logger

log = get_logger("state")

STAGES = ("image", "video", "voice")
PENDING, RUNNING, DONE, FAILED = "pending", "running", "done", "failed"


def prompt_hash(*parts: Any) -> str:
    joined = "␟".join("" if p is None else str(p) for p in parts)
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()[:16]


class RunState:
    def __init__(self, path: Path, data: dict[str, Any] | None = None):
        self.path = Path(path)
        self.data: dict[str, Any] = data or {
            "version": 1,
            "created_at": time.time(),
            "updated_at": time.time(),
            "providers": {},
            "shots": {},
            "assembly": {},
        }

    # -- persistence -------------------------------------------------------
    @classmethod
    def load_or_new(cls, path: Path) -> "RunState":
        path = Path(path)
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                log.info("resuming from %s", path)
                return cls(path, data)
            except json.JSONDecodeError:
                log.warning("state file %s is corrupt — starting fresh", path)
        return cls(path)

    def save(self) -> None:
        """Atomic write: a crash mid-save must not destroy the resume point."""
        self.data["updated_at"] = time.time()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=str(self.path.parent), suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                json.dump(self.data, fh, indent=2, ensure_ascii=False)
            os.replace(tmp, self.path)
        except BaseException:
            Path(tmp).unlink(missing_ok=True)
            raise

    # -- per-shot bookkeeping ---------------------------------------------
    def shot(self, shot_id: str) -> dict[str, Any]:
        return self.data["shots"].setdefault(
            shot_id, {stage: _blank() for stage in STAGES}
        )

    def stage(self, shot_id: str, stage: str) -> dict[str, Any]:
        return self.shot(shot_id).setdefault(stage, _blank())

    def is_satisfied(self, shot_id: str, stage: str, phash: str,
                     *, needs_file: bool = True) -> bool:
        """True when this stage can be skipped on a resume."""
        entry = self.stage(shot_id, stage)
        if entry.get("status") != DONE:
            return False
        if entry.get("prompt_hash") != phash:
            log.info("%s/%s prompt changed — regenerating", shot_id, stage)
            return False
        if entry.get("skipped"):
            return True
        if needs_file:
            path = entry.get("path")
            if not path or not Path(path).exists():
                log.info("%s/%s output missing — regenerating", shot_id, stage)
                return False
        return True

    def mark_running(self, shot_id: str, stage: str, phash: str) -> None:
        entry = self.stage(shot_id, stage)
        entry.update(status=RUNNING, prompt_hash=phash, error=None,
                     attempts=int(entry.get("attempts", 0)) + 1,
                     started_at=time.time())
        self.save()

    def mark_done(self, shot_id: str, stage: str, phash: str, path: Path | None,
                  provider: str = "", meta: dict[str, Any] | None = None,
                  skipped: bool = False) -> None:
        self.stage(shot_id, stage).update(
            status=DONE, prompt_hash=phash,
            path=str(path) if path else None,
            provider=provider, meta=meta or {}, error=None,
            skipped=skipped, finished_at=time.time(),
        )
        self.save()

    def mark_failed(self, shot_id: str, stage: str, error: str) -> None:
        self.stage(shot_id, stage).update(status=FAILED, error=error,
                                          finished_at=time.time())
        self.save()

    def reset(self, shot_id: str, stages: tuple[str, ...] = STAGES) -> None:
        """Force a shot (or some of its stages) to be regenerated next run."""
        shot = self.shot(shot_id)
        for stage in stages:
            shot[stage] = _blank()
        self.data.get("assembly", {}).clear()
        self.save()
        log.info("reset %s (%s)", shot_id, ", ".join(stages))

    # -- reporting ---------------------------------------------------------
    def path_for(self, shot_id: str, stage: str) -> Path | None:
        raw = self.stage(shot_id, stage).get("path")
        return Path(raw) if raw else None

    def counts(self) -> dict[str, int]:
        out = {DONE: 0, FAILED: 0, PENDING: 0, RUNNING: 0}
        for shot in self.data["shots"].values():
            for stage in STAGES:
                out[shot.get(stage, {}).get("status", PENDING)] = \
                    out.get(shot.get(stage, {}).get("status", PENDING), 0) + 1
        return out

    def failed_shots(self) -> list[str]:
        return [sid for sid, shot in self.data["shots"].items()
                if any(shot.get(st, {}).get("status") == FAILED for st in STAGES)]


def _blank() -> dict[str, Any]:
    return {"status": PENDING, "prompt_hash": None, "path": None, "provider": "",
            "error": None, "attempts": 0, "meta": {}, "skipped": False}
