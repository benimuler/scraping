"""Data model for a film: characters, shots, and the assembled project."""

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any


@dataclass
class Character:
    """One entry of the Character Bible.

    `visual_prompt()` is injected verbatim into every prompt the character
    appears in — that repetition is what keeps them looking the same shot to
    shot.
    """

    id: str
    name: str
    role: str = ""
    age: str = ""
    body: str = ""
    face: str = ""
    hair: str = ""
    outfit: str = ""
    palette: str = ""
    distinguishing_features: str = ""
    personality: str = ""
    voice: str = ""            # provider voice id, e.g. an edge-tts voice name
    voice_direction: str = ""

    def visual_prompt(self) -> str:
        parts = [
            f"{self.name}",
            self.age,
            self.body,
            self.face,
            self.hair,
            self.outfit,
            self.distinguishing_features,
            self.palette,
        ]
        return ", ".join(p.strip() for p in parts if p and p.strip())

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Character":
        known = {f for f in cls.__dataclass_fields__}
        return cls(**{k: v for k, v in data.items() if k in known})


@dataclass
class Shot:
    """A single 3-6s beat of the film."""

    id: str = ""                  # "shot_01"
    index: int = 0
    scene: str = ""
    location: str = ""
    time_of_day: str = ""
    characters: list[str] = field(default_factory=list)   # character ids
    action: str = ""
    dialogue: str = ""
    speaker: str = ""             # character id, or "narrator"
    camera: str = ""
    mood: str = ""
    duration: float = 5.0
    image_prompt: str = ""
    animation_prompt: str = ""
    negative_prompt: str = ""

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Shot":
        known = {f for f in cls.__dataclass_fields__}
        return cls(**{k: v for k, v in data.items() if k in known})


@dataclass
class Project:
    """Everything the orchestrator needs to render a film."""

    title: str
    logline: str = ""
    style: str = ""               # global art direction, injected in every prompt
    characters: list[Character] = field(default_factory=list)
    shots: list[Shot] = field(default_factory=list)

    def character(self, cid: str) -> Character | None:
        for c in self.characters:
            if c.id == cid or c.name.lower() == str(cid).lower():
                return c
        return None

    def total_duration(self) -> float:
        return sum(s.duration for s in self.shots)

    def to_dict(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "logline": self.logline,
            "style": self.style,
            "characters": [asdict(c) for c in self.characters],
            "shots": [asdict(s) for s in self.shots],
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Project":
        return cls(
            title=data.get("title", "untitled"),
            logline=data.get("logline", ""),
            style=data.get("style", ""),
            characters=[Character.from_dict(c) for c in data.get("characters", [])],
            shots=[Shot.from_dict(s) for s in data.get("shots", [])],
        )

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.to_dict(), indent=2, ensure_ascii=False),
                        encoding="utf-8")

    @classmethod
    def load(cls, path: Path) -> "Project":
        return cls.from_dict(json.loads(Path(path).read_text(encoding="utf-8")))
