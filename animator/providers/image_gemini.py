"""Google Gemini image generation ("Nano Banana"). Key from GEMINI_API_KEY only."""

from __future__ import annotations

import base64
from pathlib import Path
from typing import Any

from ..config import require_env
from ..http import request, session
from .base import Provider, ProviderError, ProviderResult
from .registry import register

BASE = "https://generativelanguage.googleapis.com/v1beta/models"


@register("image", "gemini")
class GeminiImageProvider(Provider):
    output_suffix = ".png"

    def generate(self, prompt: str, context: dict[str, Any],
                 output_path: Path) -> ProviderResult:
        label = context.get("shot_id", output_path.stem)
        model = self.options.get("model", "gemini-2.5-flash-image")
        url = f"{BASE}/{model}:generateContent"
        body = {"contents": [{"parts": [{"text": prompt[:4000]}]}]}

        entry = self.charge(label, payload={"url": url, **body})
        if self.dry_run:
            return self.dry_result(output_path, {"body": body})

        key = require_env("GEMINI_API_KEY")
        sess = session()
        try:
            resp = self.retry(
                lambda: request(sess, "POST", url, json=body,
                                headers={"x-goog-api-key": key},
                                timeout=float(self.options.get("timeout", 180))),
                label=f"gemini {label}",
            )
        except Exception:
            self.settle(entry, spent=False)
            raise
        content = None
        for candidate in resp.json().get("candidates", []):
            for part in candidate.get("content", {}).get("parts", []):
                blob = (part.get("inline_data") or part.get("inlineData") or {}).get("data")
                if blob:
                    content = base64.b64decode(blob)
                    break
        if content is None:
            raise ProviderError(f"gemini returned no image data for {label}")

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(content)
        return ProviderResult(path=output_path, provider=self.name, kind=self.kind,
                              cost_usd=self.cost_per_call, meta={"model": model})
