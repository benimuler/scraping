"""Local placeholder frames — no network, no cost.

Useful for verifying the whole pipeline (orchestration, resume, assembly, UI)
without touching a paid or rate-limited service.
"""

from __future__ import annotations

import hashlib
import textwrap
from pathlib import Path
from typing import Any

from .base import Provider, ProviderResult
from .registry import register


@register("image", "mock")
class MockImageProvider(Provider):
    output_suffix = ".png"

    def generate(self, prompt: str, context: dict[str, Any],
                 output_path: Path) -> ProviderResult:
        label = context.get("shot_id", output_path.stem)
        self.charge(label, payload={"prompt": prompt}, note="local placeholder frame")
        if self.dry_run:
            return self.dry_result(output_path, {"prompt": prompt})

        from PIL import Image, ImageDraw

        width = int(self.options.get("width", 1280))
        height = int(self.options.get("height", 720))
        digest = hashlib.sha256(prompt.encode("utf-8")).digest()
        top = (digest[0] // 2 + 40, digest[1] // 2 + 40, digest[2] // 2 + 40)
        bottom = (digest[3] // 3 + 15, digest[4] // 3 + 15, digest[5] // 3 + 15)

        image = Image.new("RGB", (width, height), top)
        draw = ImageDraw.Draw(image)
        for y in range(height):  # vertical gradient so motion is visible later
            t = y / max(1, height - 1)
            draw.line([(0, y), (width, y)],
                      fill=tuple(int(a + (b - a) * t) for a, b in zip(top, bottom)))
        draw.rectangle([40, 40, width - 40, height - 40], outline=(255, 255, 255), width=3)
        draw.text((70, 70), label.upper(), fill=(255, 255, 255))
        wrapped = textwrap.fill(prompt, width=max(20, width // 12))
        draw.text((70, 110), wrapped[:1200], fill=(238, 238, 238))

        output_path.parent.mkdir(parents=True, exist_ok=True)
        image.save(output_path, "PNG")
        return ProviderResult(path=output_path, provider=self.name, kind=self.kind,
                              meta={"width": width, "height": height})
