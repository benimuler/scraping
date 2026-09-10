"""Placeholder music adapter — emits a silent bed of the requested length.

Swap in a real provider later by registering ("music", "<name>") with the same
generate(prompt, context, output_path) signature; nothing else changes.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from ..ffmpeg import silence
from .base import Provider, ProviderResult
from .registry import register


@register("music", "silent")
class SilentMusicProvider(Provider):
    output_suffix = ".m4a"

    def generate(self, prompt: str, context: dict[str, Any],
                 output_path: Path) -> ProviderResult:
        label = context.get("shot_id", output_path.stem)
        seconds = float(context.get("duration", 60) or 60)
        self.charge(label, payload={"prompt": prompt, "duration": seconds},
                    note="silent placeholder track")
        if self.dry_run:
            return self.dry_result(output_path, {"duration": seconds})
        silence(output_path, seconds)
        return ProviderResult(path=output_path, provider=self.name, kind=self.kind,
                              meta={"duration": seconds, "silent": True})
