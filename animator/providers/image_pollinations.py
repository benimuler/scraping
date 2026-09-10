"""Pollinations.ai — free, keyless text-to-image. The default first-frame source.

GET https://image.pollinations.ai/prompt/<urlencoded prompt> -> image bytes.
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any
from urllib.parse import quote

from ..http import request, session
from .base import Provider, ProviderResult
from .registry import register

BASE = "https://image.pollinations.ai/prompt/"


@register("image", "pollinations")
class PollinationsImageProvider(Provider):
    output_suffix = ".jpg"

    def generate(self, prompt: str, context: dict[str, Any],
                 output_path: Path) -> ProviderResult:
        label = context.get("shot_id", output_path.stem)
        width = int(self.options.get("width", 1280))
        height = int(self.options.get("height", 720))
        # Seed from the prompt so a re-run of an unchanged shot is reproducible.
        seed = int.from_bytes(hashlib.sha256(prompt.encode()).digest()[:4], "big")
        params = {
            "width": width, "height": height,
            "model": self.options.get("model", "flux"),
            "seed": seed, "nologo": str(bool(self.options.get("nologo", True))).lower(),
        }
        negative = context.get("negative_prompt")
        if negative:
            params["negative"] = negative
        url = BASE + quote(prompt[:1800], safe="")

        self.charge(label, payload={"url": url.split("?")[0][:120] + "...", **params},
                    note="pollinations free tier")
        if self.dry_run:
            return self.dry_result(output_path, {"prompt": prompt, "params": params})

        sess = session()
        timeout = float(self.options.get("timeout", 180))
        resp = self.retry(lambda: request(sess, "GET", url, params=params,
                                          timeout=timeout),
                          label=f"pollinations {label}")
        if not resp.content or not resp.headers.get("content-type", "").startswith("image"):
            from .base import ProviderError
            raise ProviderError(f"pollinations returned no image for {label}")

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(resp.content)
        self.log.info("%s frame saved (%d KB)", label, len(resp.content) // 1024)
        return ProviderResult(path=output_path, provider=self.name, kind=self.kind,
                              meta={"seed": seed, "model": params["model"]})
