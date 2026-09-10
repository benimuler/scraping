"""Small ffmpeg/ffprobe wrapper used by the mock adapters and by assembly."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

from .logging_utils import get_logger

log = get_logger("ffmpeg")


class FFmpegError(RuntimeError):
    pass


def require(binary: str = "ffmpeg") -> str:
    path = shutil.which(binary)
    if not path:
        raise FFmpegError(
            f"{binary} not found on PATH. Install it "
            "(macOS: brew install ffmpeg, Debian/Ubuntu: apt install ffmpeg)."
        )
    return path


def run(args: list[str], *, quiet: bool = True) -> subprocess.CompletedProcess:
    cmd = [require("ffmpeg"), "-hide_banner", "-nostdin", "-y",
           "-loglevel", "error" if quiet else "info", *args]
    log.debug("ffmpeg %s", " ".join(args))
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise FFmpegError(f"ffmpeg failed ({proc.returncode}):\n"
                          f"{proc.stderr.strip()[-1500:]}")
    return proc


def duration(path: Path) -> float:
    """Media duration in seconds (0.0 when unknown)."""
    proc = subprocess.run(
        [require("ffprobe"), "-v", "error", "-show_entries", "format=duration",
         "-of", "json", str(path)],
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        raise FFmpegError(f"ffprobe failed for {path}: {proc.stderr.strip()[-500:]}")
    try:
        return float(json.loads(proc.stdout)["format"]["duration"])
    except (KeyError, ValueError, json.JSONDecodeError):
        return 0.0


def has_audio(path: Path) -> bool:
    proc = subprocess.run(
        [require("ffprobe"), "-v", "error", "-select_streams", "a",
         "-show_entries", "stream=index", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True,
    )
    return bool(proc.stdout.strip())


def silence(path: Path, seconds: float, sample_rate: int = 48000) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    run(["-f", "lavfi", "-i", f"anullsrc=r={sample_rate}:cl=stereo",
         "-t", f"{max(0.05, seconds):.3f}", "-c:a", "aac", "-b:a", "128k", str(path)])
    return path
