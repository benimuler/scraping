"""Hugging Face Inference API (SDXL by default). Key from HF_API_TOKEN only."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from ..config import require_env
from ..http import request, session
from .base import Provider, ProviderError, ProviderResult
from .registry import register

BASE = "https://api-inference.huggingface.co/models"


@register("image", "huggingface")
class HuggingFaceImageProvider(Provider):
    output_suffix = ".jpg"

    def generate(self, prompt: str, context: dict[str, Any],
                 output_path: Path) -> ProviderResult:
        label = context.get("shot_id", output_path.stem)
        model = self.options.get("model", "stabilityai/stable-diffusion-xl-base-1.0")
        url = f"{BASE}/{model}"
        body: dict[str, Any] = {"inputs": prompt[:1800]}
        if context.get("negative_prompt"):
            body["parameters"] = {"negative_prompt": context["negative_prompt"]}

        self.charge(label, payload={"url": url, **body}, note="HF free inference tier")
        if self.dry_run:
            return self.dry_result(output_path, {"body": body})

        token = require_env("HF_API_TOKEN")
        sess = session()
        resp = self.retry(
            lambda: request(sess, "POST", url, json=body,
                            headers={"Authorization": f"Bearer {token}"},
                            timeout=float(self.options.get("timeout", 300))),
            label=f"huggingface {label}",
        )
        if not resp.headers.get("content-type", "").startswith("image"):
            raise ProviderError(f"huggingface returned no image for {label}: "
                                f"{resp.text[:200]}")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(resp.content)
        return ProviderResult(path=output_path, provider=self.name, kind=self.kind,
                              meta={"model": model})
