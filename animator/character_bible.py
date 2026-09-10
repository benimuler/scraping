"""Stage 2 — the Character Bible.

One consistent visual description per character, reloaded as context into every
prompt that character appears in. This repetition is the only thing keeping a
character recognisable across independently generated shots.
"""

from __future__ import annotations

import hashlib
from typing import Any

from .logging_utils import get_logger
from .models import Character, Project

log = get_logger("bible")

SYSTEM = """\
You are a character designer for an animated short. For every character you \
write a fixed visual description that will be pasted verbatim into every image \
prompt they appear in, so it must be concrete, specific and repeatable: exact \
hair colour and cut, exact clothing items and colours, build, age, and one or \
two unmistakable identifying features.

Never write anything that varies shot to shot (no poses, no emotions, no camera \
directions, no backgrounds). Answer with JSON only.
"""

USER = """\
Film: {title}
Logline: {logline}
Art direction: {style}

Characters to design:
{roster}

Return JSON:
{{
  "characters": [
    {{"id": "must match the id given above",
      "name": "Display Name",
      "role": "role in the story",
      "age": "e.g. 'woman in her early 30s'",
      "body": "build and height",
      "face": "face shape, skin tone, eyes, notable features",
      "hair": "exact colour, length, style",
      "outfit": "exact garments and colours, head to toe",
      "palette": "2-4 signature colours",
      "distinguishing_features": "the one thing that makes them instantly recognisable",
      "personality": "two or three traits",
      "voice_direction": "how they speak: pace, pitch, attitude"}}
  ]
}}
"""

# Deterministic offline pools — stable per character id, so a re-run produces
# the same bible and therefore the same-looking character.
_HAIR = ["short jet-black hair", "shoulder-length auburn hair", "tight silver curls",
         "a sandy blond undercut", "long dark braided hair", "cropped ginger hair"]
_OUTFIT = ["a faded olive field jacket over a grey tee, dark jeans, scuffed boots",
           "a mustard knitted cardigan, white shirt, brown corduroy trousers",
           "a navy mechanic's coverall with rolled sleeves and a red neckerchief",
           "a long charcoal raincoat over a teal jumper and black trousers",
           "a cream linen shirt, tan waistcoat, and worn leather satchel",
           "a burgundy hoodie, patched denim jacket, and canvas sneakers"]
_FACE = ["a round warm-brown face with wide dark eyes and a small scar over one brow",
         "a long pale face with sharp cheekbones and calm grey eyes",
         "a freckled olive-skinned face with a broad nose and laugh lines",
         "a square deep-brown face with a close-trimmed beard and steady eyes"]
_BODY = ["short and stocky", "tall and lanky", "average build, slightly hunched",
         "compact and wiry"]
_PALETTE = ["olive green, rust, bone white", "mustard, cream, walnut brown",
            "navy, oxblood, brass", "teal, charcoal, warm grey"]
_VOICES = ["en-US-AriaNeural", "en-US-GuyNeural", "en-GB-SoniaNeural",
           "en-US-JennyNeural", "en-AU-WilliamNeural", "en-GB-RyanNeural"]


def build(project: Project, cfg, client) -> list[Character]:
    """Fill in (or invent) a full visual description for every character."""
    if not project.characters:
        log.warning("no characters found in the breakdown")
        return []

    if client is not None:
        roster = "\n".join(
            f"- id={c.id}, name={c.name}, role={c.role or 'unspecified'}, "
            f"personality={c.personality or 'unspecified'}"
            for c in project.characters
        )
        data: Any = client.json(
            system=SYSTEM,
            user=USER.format(title=project.title, logline=project.logline,
                             style=project.style, roster=roster),
            label="character_bible",
        )
        by_id = {c["id"]: c for c in data.get("characters", []) if isinstance(c, dict)}
        for character in project.characters:
            merged = {**{k: v for k, v in vars(character).items() if v},
                      **{k: v for k, v in by_id.get(character.id, {}).items() if v}}
            _apply(character, merged)
    else:
        log.warning("using the offline character bible (no Claude call)")
        for character in project.characters:
            _apply(character, _offline_character(character))

    voice_cfg = cfg.adapter_options("voice")
    for character in project.characters:
        if not character.voice:
            character.voice = _pick(_VOICES, character.id) if character.id != "narrator" \
                else str(voice_cfg.get("narrator_voice", "en-US-GuyNeural"))
        log.info("bible | %-14s %s", character.id, character.visual_prompt()[:96])
    return project.characters


def _apply(character: Character, data: dict[str, Any]) -> None:
    for key, value in data.items():
        if key in Character.__dataclass_fields__ and value:
            setattr(character, key, value)


def _pick(pool: list[str], seed: str) -> str:
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    return pool[digest[0] % len(pool)]


def _offline_character(character: Character) -> dict[str, str]:
    cid = character.id
    return {
        "age": "an adult in their thirties",
        "body": _pick(_BODY, cid + "b"),
        "face": _pick(_FACE, cid + "f"),
        "hair": _pick(_HAIR, cid + "h"),
        "outfit": _pick(_OUTFIT, cid + "o"),
        "palette": _pick(_PALETTE, cid + "p"),
        "distinguishing_features": character.distinguishing_features
        or f"always carries the same worn object associated with {character.name}",
        "personality": character.personality or "grounded, watchful",
        "voice_direction": "even pace, warm, understated",
    }
