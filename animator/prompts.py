"""Stage 3 — shot list to prompts.

Two prompts per shot:
  * image_prompt      — the first frame, a still. Carries the full character
                        bible so the character looks identical in every shot.
  * animation_prompt  — how that still should move. Kling reads the image for
                        appearance, so this text describes motion only.
"""

from __future__ import annotations

from .logging_utils import get_logger
from .models import Project, Shot

log = get_logger("prompts")

DEFAULT_NEGATIVE = (
    "text, watermark, signature, logo, subtitles, extra fingers, deformed hands, "
    "distorted face, duplicated characters, low quality, blurry, jpeg artifacts, "
    "morphing, flickering"
)

# Kling reads the frame for appearance; long descriptive prompts fight the image.
MOTION_ONLY_NEGATIVE = (
    "camera cut, scene change, new character appearing, text, watermark, "
    "morphing faces, warping limbs, flicker"
)


def build(project: Project, cfg) -> Project:
    """Fill image_prompt / animation_prompt / negative_prompt on every shot."""
    for shot in project.shots:
        shot.image_prompt = _image_prompt(project, shot)
        shot.animation_prompt = _animation_prompt(shot)
        shot.negative_prompt = shot.negative_prompt or DEFAULT_NEGATIVE
        log.debug("%s image: %s", shot.id, shot.image_prompt)
    log.info("built prompts for %d shots", len(project.shots))
    return project


def _cast_block(project: Project, shot: Shot) -> str:
    """The character bible entries for everyone visible in this shot."""
    parts = []
    for cid in shot.characters:
        character = project.character(cid)
        if character:
            parts.append(f"{character.name} ({character.visual_prompt()})")
    return "; ".join(parts)


def _image_prompt(project: Project, shot: Shot) -> str:
    cast = _cast_block(project, shot)
    scene = ", ".join(p for p in (shot.location, shot.time_of_day) if p)
    parts = [
        shot.camera or "medium shot",
        shot.action.rstrip("."),
        f"featuring {cast}" if cast else "",
        f"location: {scene}" if scene else "",
        f"mood: {shot.mood}" if shot.mood else "",
        project.style,
        "single frame, cinematic composition, consistent character design",
    ]
    return ". ".join(p.strip() for p in parts if p and p.strip())


def _animation_prompt(shot: Shot) -> str:
    """Motion description for image-to-video. Deliberately short."""
    motion = shot.action.rstrip(".") or "the scene breathes"
    camera = shot.camera or "static camera"
    parts = [
        motion,
        f"camera: {camera}",
        "natural continuous motion, subtle secondary movement in hair and clothing",
        "the characters keep their exact appearance from the first frame",
    ]
    if shot.dialogue:
        parts.insert(1, "the speaking character's lips and expression move naturally")
    return ". ".join(parts)


def voice_line(project: Project, shot: Shot) -> tuple[str, str] | None:
    """(text, voice_id) for a shot's spoken line, or None when it is silent."""
    if not shot.dialogue.strip():
        return None
    character = project.character(shot.speaker) if shot.speaker else None
    voice = character.voice if character and character.voice else ""
    return shot.dialogue.strip(), voice
