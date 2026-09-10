"""Stage 5 — the batch orchestrator.

Walks the shot list in order and drives image -> video -> voice for each shot,
consulting the run state before every stage so a resumed run never re-pays for
work that already succeeded.
"""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from . import character_bible, prompts as prompt_stage, script_breakdown
from .assembly import assemble
from .config import Config
from .llm import build_client
from .logging_utils import BudgetExceeded, CreditGuard, get_logger
from .models import Project, Shot
from .providers import ProviderError, build_all
from .state import RunState, prompt_hash

log = get_logger("orchestrator")


@dataclass
class Pipeline:
    cfg: Config
    dry_run: bool = False
    fail_fast: bool = False

    def __post_init__(self) -> None:
        self.out_dir: Path = self.cfg.out_dir() / str(self.cfg.get("project.name", "demo"))
        self.out_dir.mkdir(parents=True, exist_ok=True)
        self.guard = CreditGuard.from_config(self.cfg, self.dry_run)
        # A dry run must never touch the real resume point: if it wrote "done"
        # into state.json, the next real run would skip every shot and produce
        # an empty film.
        suffix = ".dryrun" if self.dry_run else ""
        self.state_path = self.out_dir / f"state{suffix}.json"
        self.project_path = self.out_dir / f"project{suffix}.json"
        self.state = RunState.load_or_new(self.state_path)
        self.providers = build_all(self.cfg, self.guard, self.dry_run)
        self.state.data["providers"] = {k: p.name for k, p in self.providers.items()}
        self.project: Project | None = None

    # -- stages 1-3 --------------------------------------------------------
    def prepare(self, script_text: str, force: bool = False) -> Project:
        """Breakdown + character bible + prompts, cached on disk.

        These are the only LLM-backed steps, so they are cached against a hash
        of the script: re-running the pipeline on an unchanged script costs
        nothing here.
        """
        project_path = self.project_path
        script_id = hashlib.sha256(script_text.encode("utf-8")).hexdigest()[:16]

        if project_path.exists() and not force and \
                self.state.data.get("script_hash") == script_id:
            log.info("reusing the cached breakdown (%s)", project_path)
            self.project = Project.load(project_path)
            return self.project

        client = build_client(self.cfg, self.guard)
        project = script_breakdown.breakdown(script_text, self.cfg, client)
        character_bible.build(project, self.cfg, client)
        prompt_stage.build(project, self.cfg)

        project.save(project_path)
        self.state.data["script_hash"] = script_id
        self.state.save()
        log.info("breakdown written to %s", project_path)
        self.project = project
        return project

    # -- stages 4-5 --------------------------------------------------------
    def run_shots(self, only: list[str] | None = None,
                  force: list[str] | None = None) -> dict[str, Any]:
        project = self._require_project()
        force = force or []
        started = time.monotonic()
        failures: list[tuple[str, str]] = []

        for shot in project.shots:
            if only and shot.id not in only:
                continue
            if shot.id in force:
                self.state.reset(shot.id)
            log.info("── %s (%s, %.1fs) ─────────────────────────────",
                     shot.id, shot.location or "no location", shot.duration)
            try:
                self._render_shot(project, shot)
            except BudgetExceeded:
                raise
            except (ProviderError, RuntimeError) as exc:
                failures.append((shot.id, str(exc)))
                log.error("%s failed: %s", shot.id, exc)
                if self.fail_fast:
                    break

        summary = {
            "elapsed_s": round(time.monotonic() - started, 1),
            "failures": failures,
            "counts": self.state.counts(),
        }
        log.info("shots finished in %.1fs — %s", summary["elapsed_s"], summary["counts"])
        if failures:
            log.warning("%d shot(s) failed: %s", len(failures),
                        ", ".join(sid for sid, _ in failures))
        return summary

    def _render_shot(self, project: Project, shot: Shot) -> None:
        image_path = self._stage_image(shot)
        self._stage_video(shot, image_path)
        self._stage_voice(project, shot)

    def _stage_image(self, shot: Shot) -> Path | None:
        provider = self.providers["image"]
        phash = prompt_hash(provider.name, shot.image_prompt, shot.negative_prompt)
        out = self.out_dir / "images" / f"{shot.id}{provider.output_suffix}"

        if self.state.is_satisfied(shot.id, "image", phash):
            path = self.state.path_for(shot.id, "image")
            log.info("%s image: reusing %s", shot.id, path)
            return path

        self.state.mark_running(shot.id, "image", phash)
        try:
            result = provider.generate(
                shot.image_prompt,
                {"shot_id": shot.id, "negative_prompt": shot.negative_prompt,
                 "duration": shot.duration},
                out,
            )
        except Exception as exc:
            self.state.mark_failed(shot.id, "image", str(exc))
            raise
        self.state.mark_done(shot.id, "image", phash, result.path, provider.name,
                             result.meta, skipped=result.dry_run)
        return result.path

    def _stage_video(self, shot: Shot, image_path: Path | None) -> None:
        provider = self.providers["video"]
        phash = prompt_hash(provider.name, shot.animation_prompt, shot.negative_prompt,
                            shot.duration, str(image_path))
        out = self.out_dir / "video" / f"{shot.id}{provider.output_suffix}"

        if self.state.is_satisfied(shot.id, "video", phash):
            log.info("%s video: reusing %s (no credits spent)", shot.id,
                     self.state.path_for(shot.id, "video"))
            return

        self.state.mark_running(shot.id, "video", phash)
        try:
            result = provider.generate(
                shot.animation_prompt,
                {"shot_id": shot.id, "image_path": image_path,
                 "duration": shot.duration, "negative_prompt": shot.negative_prompt,
                 "fps": int(self.cfg.get("project.fps", 24)),
                 "resolution": self.cfg.resolution()},
                out,
            )
        except Exception as exc:
            self.state.mark_failed(shot.id, "video", str(exc))
            raise
        self.state.mark_done(shot.id, "video", phash, result.path, provider.name,
                             result.meta, skipped=result.dry_run)

    def _stage_voice(self, project: Project, shot: Shot) -> None:
        provider = self.providers["voice"]
        line = prompt_stage.voice_line(project, shot)
        out = self.out_dir / "voice" / f"{shot.id}{provider.output_suffix}"

        if line is None:
            phash = prompt_hash(provider.name, "<silent>")
            if not self.state.is_satisfied(shot.id, "voice", phash, needs_file=False):
                self.state.mark_done(shot.id, "voice", phash, None, provider.name,
                                     {"silent": True}, skipped=True)
            log.info("%s voice: silent shot", shot.id)
            return

        text, voice = line
        phash = prompt_hash(provider.name, text, voice)
        if self.state.is_satisfied(shot.id, "voice", phash):
            log.info("%s voice: reusing %s", shot.id, self.state.path_for(shot.id, "voice"))
            return

        self.state.mark_running(shot.id, "voice", phash)
        try:
            result = provider.generate(text, {"shot_id": shot.id, "voice": voice}, out)
        except Exception as exc:
            self.state.mark_failed(shot.id, "voice", str(exc))
            raise
        self.state.mark_done(shot.id, "voice", phash, result.path, provider.name,
                             result.meta, skipped=result.dry_run)

    # -- stages 6 ----------------------------------------------------------
    def build_music(self) -> Path | None:
        project = self._require_project()
        provider = self.providers["music"]
        out = self.out_dir / "music" / f"bed{provider.output_suffix}"
        phash = prompt_hash(provider.name, project.style, project.total_duration())
        entry = self.state.data.setdefault("music", {})

        if entry.get("prompt_hash") == phash and entry.get("path") \
                and Path(entry["path"]).exists():
            return Path(entry["path"])

        result = provider.generate(
            f"score for {project.title}: {project.logline}. {project.style}",
            {"shot_id": "music_bed", "duration": project.total_duration()},
            out,
        )
        entry.update(prompt_hash=phash, path=str(result.path) if result.path else None,
                     provider=provider.name, meta=result.meta)
        self.state.save()
        # A silent bed adds nothing to the mix; skip the extra encode pass.
        if result.meta.get("silent"):
            return None
        return result.path

    def assemble(self) -> Path | None:
        project = self._require_project()
        if self.dry_run:
            log.info("[DRY-RUN] would assemble %d shots into %s",
                     len(project.shots), self.out_dir / "film.mp4")
            return None
        music = self.build_music()
        film = assemble(project, self.state, self.cfg, self.out_dir, music)
        self.state.data["assembly"] = {"path": str(film), "at": time.time()}
        self.state.save()
        return film

    # -- used by the UI ----------------------------------------------------
    def regenerate(self, shot_id: str, stages: tuple[str, ...] = ("image", "video", "voice")
                   ) -> dict[str, Any]:
        project = self._require_project()
        shot = next((s for s in project.shots if s.id == shot_id), None)
        if shot is None:
            raise KeyError(f"unknown shot {shot_id!r}")
        self.state.reset(shot_id, stages)
        self._render_shot(project, shot)
        return self.state.shot(shot_id)

    def finish(self) -> None:
        self.guard.dump(self.out_dir / ("ledger.dryrun.json" if self.dry_run else "ledger.json"))
        print(self.guard.summary())

    def _require_project(self) -> Project:
        if self.project is None:
            path = self.project_path
            if not path.exists():
                raise RuntimeError("no breakdown yet — run `prepare` first")
            self.project = Project.load(path)
        return self.project


def load_script(path: str | Path) -> str:
    text = Path(path).read_text(encoding="utf-8")
    if not text.strip():
        raise ValueError(f"script file is empty: {path}")
    return text


def status_report(cfg: Config) -> dict[str, Any]:
    """Everything the UI needs, read straight off disk."""
    out_dir = cfg.out_dir() / str(cfg.get("project.name", "demo"))
    state = RunState.load_or_new(out_dir / "state.json")
    project_path = out_dir / "project.json"
    project = Project.load(project_path) if project_path.exists() else None
    ledger_path = out_dir / "ledger.json"
    ledger = json.loads(ledger_path.read_text()) if ledger_path.exists() else {}
    return {"out_dir": out_dir, "state": state, "project": project, "ledger": ledger}
