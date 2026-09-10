"""OpenAI Images (DALL·E / gpt-image-1). Paid — key from OPENAI_API_KEY only."""

from __future__ import annotations

import base64
from pathlib import Path
from typing import Any

from ..config import require_env
from ..http import request, session
from .base import Provider, ProviderError, ProviderResult
from .registry import register

URL = "https://api.openai.com/v1/images/generations"


@register("image", "openai")
class OpenAIImageProvider(Provider):
    output_suffix = ".png"

    def generate(self, prompt: str, context: dict[str, Any],
                 output_path: Path) -> ProviderResult:
        label = context.get("shot_id", output_path.stem)
        body = {
            "model": self.options.get("model", "gpt-image-1"),
            "prompt": prompt[:4000],
            "size": self.options.get("size", "1536x1024"),
            "n": 1,
        }
        entry = self.charge(label, payload={"url": URL, **body})
        if self.dry_run:
            return self.dry_result(output_path, {"body": body})

        key = require_env("OPENAI_API_KEY")
        sess = session()
        try:
            resp = self.retry(
                lambda: request(sess, "POST", URL, json=body,
                                headers={"Authorization": f"Bearer {key}"},
                                timeout=float(self.options.get("timeout", 180))),
                label=f"openai {label}",
            )
        except Exception:
            self.settle(entry, spent=False)
            raise
        data = resp.json().get("data") or []
        if not data:
            raise ProviderError(f"openai returned no image for {label}")
        blob = data[0].get("b64_json")
        content = base64.b64decode(blob) if blob else request(
            sess, "GET", data[0]["url"], timeout=120).content

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(content)
        return ProviderResult(path=output_path, provider=self.name, kind=self.kind,
                              cost_usd=self.cost_per_call, meta={"model": body["model"]})
