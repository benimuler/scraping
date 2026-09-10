"""Stage 6 — assemble the shots into one film.

Two passes, because the clips come back from a provider with whatever geometry
and codec it felt like using:

  1. normalise each shot to identical video/audio parameters and lay its voice
     line onto the clip;
  2. concatenate the normalised segments (stream copy) and, if a real music bed
     exists, mix it under the whole thing.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .ffmpeg import duration as probe_duration, run
from .logging_utils import get_logger
from .models import Project

log = get_logger("assembly")

VOICE_LEAD_IN = 0.25  # seconds of silence before a line starts


def assemble(project: Project, state, cfg, out_dir: Path,
             music_path: Path | None = None) -> Path:
    asm = cfg.section("assembly")
    width, height = cfg.resolution()
    fps = int(cfg.get("project.fps", 24))
    segments_dir = out_dir / "segments"
    segments_dir.mkdir(parents=True, exist_ok=True)

    segments: list[Path] = []
    for shot in project.shots:
        clip = state.path_for(shot.id, "video")
        if not clip or not Path(clip).exists():
            log.warning("%s has no video — skipping it in the cut", shot.id)
            continue
        voice = state.path_for(shot.id, "voice")
        voice = voice if voice and Path(voice).exists() else None
        segment = segments_dir / f"{shot.id}.mp4"
        _normalise(Path(clip), voice, segment, shot.duration, width, height, fps, asm)
        segments.append(segment)

    if not segments:
        raise RuntimeError("nothing to assemble: no shot produced a video clip")

    listing = segments_dir / "concat.txt"
    listing.write_text(
        "".join(f"file '{s.resolve().as_posix()}'\n" for s in segments), encoding="utf-8"
    )

    joined = out_dir / "film_novo.mp4" if music_path else out_dir / "film.mp4"
    run(["-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy", str(joined)])

    final = out_dir / "film.mp4"
    if music_path and Path(music_path).exists():
        _mix_music(joined, Path(music_path), final, asm)
        joined.unlink(missing_ok=True)
    else:
        final = joined

    log.info("final film: %s (%d shots, %.1fs)", final, len(segments),
             probe_duration(final))
    return final


def _normalise(clip: Path, voice: Path | None, out: Path, seconds: float,
               width: int, height: int, fps: int, asm: dict[str, Any]) -> None:
    """One shot -> a segment with fixed geometry, fps, codec and an audio track."""
    clip_seconds = probe_duration(clip) or seconds
    target = min(seconds, clip_seconds) if clip_seconds else seconds

    args = ["-i", str(clip)]
    if voice:
        args += ["-i", str(voice)]
    else:
        args += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]

    gain = float(asm.get("dialogue_gain_db", 0) or 0)
    video_chain = (
        f"[0:v]scale={width}:{height}:force_original_aspect_ratio=decrease,"
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:color=black,"
        f"setsar=1,fps={fps},format=yuv420p[v]"
    )
    audio_chain = (
        f"[1:a]adelay={int(VOICE_LEAD_IN * 1000)}|{int(VOICE_LEAD_IN * 1000)},"
        f"volume={gain}dB,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,"
        f"apad[a]"
    )
    run([
        *args,
        "-filter_complex", f"{video_chain};{audio_chain}",
        "-map", "[v]", "-map", "[a]",
        "-t", f"{target:.3f}",
        "-c:v", str(asm.get("video_codec", "libx264")),
        "-preset", str(asm.get("preset", "medium")),
        "-crf", str(asm.get("crf", 20)),
        "-c:a", str(asm.get("audio_codec", "aac")),
        "-b:a", str(asm.get("audio_bitrate", "192k")),
        "-ar", "48000", "-ac", "2",
        "-video_track_timescale", "90000",
        "-movflags", "+faststart",
        str(out),
    ])


def _mix_music(film: Path, music: Path, out: Path, asm: dict[str, Any]) -> None:
    gain = float(asm.get("music_gain_db", -18) or -18)
    run([
        "-i", str(film), "-i", str(music),
        "-filter_complex",
        f"[1:a]volume={gain}dB,aresample=48000[m];"
        f"[0:a][m]amix=inputs=2:duration=first:dropout_transition=2[a]",
        "-map", "0:v", "-map", "[a]",
        "-c:v", "copy", "-c:a", str(asm.get("audio_codec", "aac")),
        "-b:a", str(asm.get("audio_bitrate", "192k")),
        "-movflags", "+faststart", str(out),
    ])
