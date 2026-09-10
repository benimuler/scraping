"""Local image-to-video — a slow ken-burns move over the still, via ffmpeg.

Same interface and same context keys as the Kling adapter, so the entire
pipeline can be exercised end to end without spending a credit.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from ..ffmpeg import run
from .base import Provider, ProviderError, ProviderResult
from .registry import register


@register("video", "mock")
class MockVideoProvider(Provider):
    output_suffix = ".mp4"

    def generate(self, prompt: str, context: dict[str, Any],
                 output_path: Path) -> ProviderResult:
        label = context.get("shot_id", output_path.stem)
        duration = float(context.get("duration", 5) or 5)
        image_path = context.get("image_path")

        self.charge(label, payload={"prompt": prompt, "image": str(image_path),
                                    "duration": duration},
                    note="local ffmpeg ken-burns render")
        if self.dry_run:
            return self.dry_result(output_path, {"prompt": prompt, "duration": duration})
        if not image_path or not Path(image_path).exists():
            raise ProviderError(f"{label}: mock video needs a first frame")

        fps = int(context.get("fps", 24))
        width, height = context.get("resolution", (1280, 720))
        frames = max(2, int(duration * fps))
        # zoompan wants an oversized source to pan around inside.
        zoom = ("scale=iw*2:ih*2,"
                f"zoompan=z='min(zoom+0.0009,1.18)':d={frames}"
                f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
                f":s={width}x{height}:fps={fps}")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        run(["-loop", "1", "-i", str(image_path), "-vf", zoom,
             "-t", f"{duration:.3f}", "-c:v", "libx264", "-pix_fmt", "yuv420p",
             "-r", str(fps), str(output_path)])

        return ProviderResult(path=output_path, provider=self.name, kind=self.kind,
                              meta={"duration": duration, "renderer": "ffmpeg zoompan"})
