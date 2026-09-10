"""Offline stand-in for a voice track.

Renders a short per-character tone whose length tracks the line, so timing and
mixing can be verified with no network.
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

from ..ffmpeg import run
from .base import Provider, ProviderResult
from .registry import register


@register("voice", "mock")
class MockVoiceProvider(Provider):
    output_suffix = ".m4a"

    def generate(self, prompt: str, context: dict[str, Any],
                 output_path: Path) -> ProviderResult:
        label = context.get("shot_id", output_path.stem)
        self.charge(label, payload={"text": prompt}, note="local tone placeholder")
        if self.dry_run:
            return self.dry_result(output_path, {"text": prompt})

        # ~14 characters per second of speech, clamped to something sane.
        seconds = max(0.8, min(12.0, len(prompt) / 14.0))
        seed = context.get("voice") or label
        freq = 180 + hashlib.sha256(str(seed).encode()).digest()[0] % 160

        output_path.parent.mkdir(parents=True, exist_ok=True)
        run(["-f", "lavfi", "-i", f"sine=frequency={freq}:sample_rate=48000",
             "-t", f"{seconds:.3f}", "-af", "tremolo=f=5:d=0.8,volume=-14dB",
             "-c:a", "aac", "-b:a", "128k", str(output_path)])
        return ProviderResult(path=output_path, provider=self.name, kind=self.kind,
                              meta={"seconds": seconds, "frequency": freq})
