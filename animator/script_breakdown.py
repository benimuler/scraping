"""Stage 1 — turn a short prose/screenplay script into scenes and shots."""

from __future__ import annotations

import re
from typing import Any

from .llm import LLMError
from .logging_utils import get_logger
from .models import Project, Shot

log = get_logger("breakdown")

SYSTEM = """\
You are a storyboard supervisor. You break a short script into a shot list for \
an animated film. You answer with JSON only — no prose, no markdown fence.

Rules:
- Produce between {min_shots} and {max_shots} shots, in story order.
- Each shot lasts {min_sec}-{max_sec} seconds; the whole film should land near \
{target_sec} seconds.
- Every shot is a single continuous camera setup. No cuts inside a shot.
- `dialogue` is what is spoken aloud during the shot (one or two short lines, or \
"" for a silent shot). `speaker` is the id of who says it, or "narrator".
- `action` describes visible action only — no internal thoughts, no cuts.
- `camera` names the setup (e.g. "wide establishing, slow push in").
- Character ids are lowercase snake_case and stable across shots.
- Keep prompts and descriptions in {language}.
"""

USER = """\
Break this script into a shot list.

<script>
{script}
</script>

Return JSON with exactly this shape:
{{
  "title": "short film title",
  "logline": "one sentence",
  "style": "global art direction applied to every frame (medium, palette, lighting, lens)",
  "characters": [
    {{"id": "snake_case", "name": "Display Name", "role": "their role in the story",
      "personality": "two or three traits"}}
  ],
  "scenes": [
    {{"id": "scene_1", "location": "where", "time_of_day": "when", "summary": "what happens"}}
  ],
  "shots": [
    {{"scene": "scene_1", "location": "where", "time_of_day": "when",
      "characters": ["character_id"], "action": "what we see",
      "dialogue": "spoken line or empty string", "speaker": "character_id or narrator",
      "camera": "camera setup", "mood": "emotional tone", "duration": 5}}
  ]
}}
"""


def breakdown(script_text: str, cfg, client) -> Project:
    """Stage 1. Uses Claude when available, the offline heuristic otherwise."""
    sc = cfg.section("script")
    if client is None:
        data = _offline_breakdown(script_text, sc)
    else:
        system = SYSTEM.format(
            min_shots=sc.get("min_shots", 8), max_shots=sc.get("max_shots", 12),
            min_sec=sc.get("min_shot_seconds", 3), max_sec=sc.get("max_shot_seconds", 6),
            target_sec=sc.get("target_total_seconds", 60),
            language=sc.get("language", "en"),
        )
        data = client.json(system=system, user=USER.format(script=script_text.strip()),
                           label="script_breakdown")
        if not isinstance(data, dict) or not data.get("shots"):
            raise LLMError("breakdown returned no shots")

    project = _to_project(data, sc)
    log.info("breakdown: %d shots, %d characters, %.1fs total",
             len(project.shots), len(project.characters), project.total_duration())
    return project


def _to_project(data: dict[str, Any], sc: dict[str, Any]) -> Project:
    from .models import Character

    lo = float(sc.get("min_shot_seconds", 3))
    hi = float(sc.get("max_shot_seconds", 6))
    max_shots = int(sc.get("max_shots", 12))

    project = Project(
        title=data.get("title", "untitled"),
        logline=data.get("logline", ""),
        style=data.get("style", ""),
        characters=[Character.from_dict(c) for c in data.get("characters", [])],
    )
    for i, raw in enumerate(data.get("shots", [])[:max_shots], start=1):
        shot = Shot.from_dict(raw)
        shot.id = f"shot_{i:02d}"
        shot.index = i
        shot.duration = min(hi, max(lo, float(raw.get("duration") or 5)))
        shot.characters = [str(c) for c in (raw.get("characters") or [])]
        project.shots.append(shot)
    return project


# ---------------------------------------------------------------------------
# Offline fallback: deterministic, no network. Good enough to exercise the
# whole pipeline (and to keep dry-runs working without an API key).
# ---------------------------------------------------------------------------

_SPEAKER_RE = re.compile(r"^\s*([A-Z][A-Za-z' \-]{1,28})\s*[:：]\s*(.+)$")
_SCREENPLAY_RE = re.compile(r"^\s*([A-Z][A-Z' \-]{2,28})\s*$")
_SLUG_RE = re.compile(r"^\s*(INT\.|EXT\.|INT/EXT\.)\s*(.+)$", re.IGNORECASE)


def _slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.strip().lower()).strip("_") or "character"


def _offline_breakdown(script_text: str, sc: dict[str, Any]) -> dict[str, Any]:
    log.warning("using the offline breakdown (no Claude call)")
    lines = [ln.rstrip() for ln in script_text.splitlines()]

    characters: dict[str, dict[str, str]] = {}
    beats: list[dict[str, str]] = []
    location, time_of_day = "", ""
    pending_speaker = ""

    def add_char(name: str) -> str:
        cid = _slug(name)
        characters.setdefault(cid, {"id": cid, "name": name.strip().title(),
                                    "role": "", "personality": ""})
        return cid

    title_line = next((ln.strip() for ln in lines if ln.strip()), "")
    for raw in lines:
        line = raw.strip()
        if not line:
            pending_speaker = ""
            continue
        if line == title_line and not beats:
            continue  # the title, not a character cue
        slug = _SLUG_RE.match(line)
        if slug:
            rest = slug.group(2)
            if " - " in rest:
                location, _, time_of_day = rest.partition(" - ")
            else:
                location = rest
            location, time_of_day = location.strip().title(), time_of_day.strip().title()
            continue
        m = _SPEAKER_RE.match(line)
        if m and len(m.group(1).split()) <= 3:
            cid = add_char(m.group(1))
            beats.append({"action": "", "dialogue": m.group(2).strip(), "speaker": cid,
                          "location": location, "time_of_day": time_of_day})
            continue
        if _SCREENPLAY_RE.match(line):
            pending_speaker = add_char(line)
            continue
        if line.startswith("(") and line.endswith(")"):
            continue  # parenthetical direction
        if pending_speaker:
            beats.append({"action": "", "dialogue": line, "speaker": pending_speaker,
                          "location": location, "time_of_day": time_of_day})
            pending_speaker = ""
            continue
        for sentence in re.split(r"(?<=[.!?])\s+", line):
            if sentence.strip():
                beats.append({"action": sentence.strip(), "dialogue": "", "speaker": "",
                              "location": location, "time_of_day": time_of_day})

    if not beats:
        beats = [{"action": script_text.strip()[:200] or "an empty stage",
                  "dialogue": "", "speaker": "", "location": "", "time_of_day": ""}]

    # A bare ALL-CAPS line can be a cue or just emphasis; keep only the names
    # that actually ended up speaking or acting.
    used = {b["speaker"] for b in beats if b["speaker"]}
    characters = {cid: c for cid, c in characters.items() if cid in used}

    min_shots = int(sc.get("min_shots", 8))
    max_shots = int(sc.get("max_shots", 12))
    target = max(min_shots, min(max_shots, len(beats)))
    groups = _chunk(beats, target)

    total = float(sc.get("target_total_seconds", 60))
    lo, hi = float(sc.get("min_shot_seconds", 3)), float(sc.get("max_shot_seconds", 6))
    per_shot = min(hi, max(lo, round(total / max(1, len(groups)))))

    shots = []
    for i, group in enumerate(groups, start=1):
        action = " ".join(b["action"] for b in group if b["action"]).strip()
        spoken = [b for b in group if b["dialogue"]]
        dialogue = " ".join(b["dialogue"] for b in spoken)[:180]
        speaker = spoken[0]["speaker"] if spoken else ""
        present = [b["speaker"] for b in group if b["speaker"]]
        loc = next((b["location"] for b in group if b["location"]), "")
        tod = next((b["time_of_day"] for b in group if b["time_of_day"]), "")
        shots.append({
            "scene": f"scene_{max(1, (i + 2) // 3)}",
            "location": loc, "time_of_day": tod,
            "characters": sorted(set(present)),
            "action": action or (f"{characters[speaker]['name']} speaks"
                                 if speaker in characters else "the scene continues"),
            "dialogue": dialogue,
            "speaker": speaker or ("narrator" if dialogue else ""),
            "camera": _camera_for(i, len(groups)),
            "mood": "",
            "duration": per_shot,
        })

    return {
        "title": _guess_title(script_text),
        "logline": beats[0]["action"] or beats[0]["dialogue"],
        "style": "modern 2D animation, clean line art, warm cinematic lighting, "
                 "soft depth of field, film grain",
        "characters": list(characters.values()),
        "scenes": [],
        "shots": shots,
    }


def _camera_for(i: int, n: int) -> str:
    if i == 1:
        return "wide establishing shot, slow push in"
    if i == n:
        return "slow pull back to wide, hold"
    return ["medium shot, slight handheld drift",
            "close-up, shallow focus",
            "over-the-shoulder two shot",
            "low angle medium, slow pan"][i % 4]


def _chunk(items: list, n: int) -> list[list]:
    n = max(1, min(n, len(items)))
    size, extra = divmod(len(items), n)
    out, pos = [], 0
    for i in range(n):
        take = size + (1 if i < extra else 0)
        out.append(items[pos:pos + take])
        pos += take
    return out


def _guess_title(text: str) -> str:
    for line in text.splitlines():
        line = line.strip().strip("#").strip()
        if line:
            return line[:60]
    return "untitled"
