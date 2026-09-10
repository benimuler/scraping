"""edge-tts — free, local, no API key. Default voice provider."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

from .base import Provider, ProviderError, ProviderResult
from .registry import register


@register("voice", "edge_tts")
class EdgeTTSVoiceProvider(Provider):
    """context keys: shot_id, voice (an edge-tts voice name), rate, volume."""

    output_suffix = ".mp3"

    def generate(self, prompt: str, context: dict[str, Any],
                 output_path: Path) -> ProviderResult:
        label = context.get("shot_id", output_path.stem)
        voice = (context.get("voice")
                 or self.options.get("default_voice", "en-US-AriaNeural"))
        rate = context.get("rate") or self.options.get("rate", "+0%")
        volume = context.get("volume") or self.options.get("volume", "+0%")

        self.charge(label, payload={"text": prompt, "voice": voice, "rate": rate},
                    note="edge-tts is free and runs locally")
        if self.dry_run:
            return self.dry_result(output_path, {"text": prompt, "voice": voice})

        try:
            import edge_tts
        except ImportError as exc:
            raise ProviderError("edge-tts is not installed (pip install edge-tts)") from exc

        output_path.parent.mkdir(parents=True, exist_ok=True)

        def _speak():
            async def _run():
                communicate = edge_tts.Communicate(prompt, voice, rate=rate, volume=volume)
                await communicate.save(str(output_path))
            try:
                asyncio.run(_run())
            except Exception as exc:  # network hiccup, throttling, voice not found
                from .base import RetryableError
                raise RetryableError(f"edge-tts failed: {exc}") from exc
            if not output_path.exists() or output_path.stat().st_size == 0:
                from .base import RetryableError
                raise RetryableError("edge-tts produced an empty file")

        self.retry(_speak, attempts=int(self.options.get("max_retries", 3)),
                   label=f"edge-tts {label}")
        self.log.info("%s voice line saved (%d KB)", label,
                      output_path.stat().st_size // 1024)
        return ProviderResult(path=output_path, provider=self.name, kind=self.kind,
                              meta={"voice": voice})
