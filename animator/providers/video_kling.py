"""Kling image-to-video adapter.

Kling is asynchronous: submit a task, get a task_id back, poll until it reaches
a terminal state, then download the rendered clip.

The API key is read from the environment only (populated from .env). It is never
written to config.yaml, never logged, and never committed.
"""

from __future__ import annotations

import base64
import os
import time
from pathlib import Path
from typing import Any

from ..http import request, session
from .base import Provider, ProviderError, ProviderResult, RetryableError
from .registry import register

SUBMIT_PATH = "/v1/videos/image2video"
TERMINAL_OK = {"succeed", "success", "succeeded", "completed"}
TERMINAL_BAD = {"failed", "fail", "error", "canceled", "cancelled"}
# Kling returns these in the JSON body with HTTP 200; they mean "slow down".
RETRYABLE_BODY_CODES = {1302, 1303, 1304, 5000, 5001}


@register("video", "kling")
class KlingVideoProvider(Provider):
    """image-to-video via Kling.

    context keys used:
        shot_id           label for logs / state
        image_path        first frame (required)
        duration          seconds; snapped to the 5/10 Kling accepts
        negative_prompt   optional
    """

    output_suffix = ".mp4"

    def __init__(self, options, guard, dry_run: bool = False):
        super().__init__(options, guard, dry_run)
        self.base_url = str(self.options.get("base_url",
                                             "https://api-singapore.klingai.com")).rstrip("/")
        self.session = session()

    # -- auth --------------------------------------------------------------
    def _auth_header(self) -> dict[str, str]:
        """Never accepts a key from config — environment only."""
        mode = str(self.options.get("auth_mode", "auto")).lower()
        access_key = os.environ.get("KLING_ACCESS_KEY", "")
        secret_key = os.environ.get("KLING_SECRET_KEY", "")
        api_key = os.environ.get("KLING_API_KEY", "")

        if not access_key and ":" in api_key:
            access_key, _, secret_key = api_key.partition(":")

        if mode == "auto":
            mode = "jwt" if (access_key and secret_key) else "bearer"

        if mode == "jwt":
            if not (access_key and secret_key):
                raise ProviderError(
                    "video.auth_mode=jwt needs KLING_ACCESS_KEY and KLING_SECRET_KEY "
                    'in .env (or KLING_API_KEY="<access_key>:<secret_key>")'
                )
            return {"Authorization": f"Bearer {_sign_jwt(access_key, secret_key)}"}

        if not api_key:
            raise ProviderError(
                "KLING_API_KEY is not set. Put it in .env — never in config.yaml "
                "or in source."
            )
        return {"Authorization": f"Bearer {api_key}"}

    # -- the interface -----------------------------------------------------
    def generate(self, prompt: str, context: dict[str, Any],
                 output_path: Path) -> ProviderResult:
        label = context.get("shot_id", output_path.stem)
        image_path = context.get("image_path")
        if not image_path and not self.dry_run:
            raise ProviderError(f"{label}: kling needs a first frame (image_path)")

        duration = 10 if float(context.get("duration", 5) or 5) > 7 else 5
        body: dict[str, Any] = {
            "model_name": self.options.get("model_name", "kling-v1-6"),
            "mode": self.options.get("mode", "std"),
            "duration": str(duration),
            "prompt": prompt[:2500],
            "cfg_scale": float(self.options.get("cfg_scale", 0.5)),
            "external_task_id": str(label),
        }
        if context.get("negative_prompt"):
            body["negative_prompt"] = str(context["negative_prompt"])[:2500]

        # 10s clips and pro mode cost roughly double; reflect that in the log.
        multiplier = (2 if duration == 10 else 1) * (2 if body["mode"] == "pro" else 1)
        credits = self.credits_per_call * multiplier
        cost = self.cost_per_call * multiplier

        preview = dict(body, image=f"<{Path(image_path).name if image_path else 'none'}>")
        entry = self.guard.charge(
            kind=self.kind, provider=self.name, label=label,
            cost_usd=cost, credits=credits, payload={"url": self.base_url + SUBMIT_PATH,
                                                     **preview},
            note=f"{body['mode']} / {duration}s",
        )
        if self.dry_run:
            self.log.info("%s dry-run: would submit %s, then poll every %ss "
                          "(timeout %ss)", label, SUBMIT_PATH,
                          self.options.get("poll_interval", 10),
                          self.options.get("poll_timeout", 900))
            return self.dry_result(output_path, {"body": preview,
                                                 "credits": credits, "cost_usd": cost})

        try:
            body["image"] = _encode_image(Path(image_path))
            # Past this point Kling has accepted the task and the credits are
            # committed, even if the poll or the download later fails.
            task_id = self.retry(lambda: self._submit(body),
                                 label=f"kling submit {label}")
        except Exception:
            self.settle(entry, spent=False)
            raise
        self.log.info("%s submitted, task_id=%s — %.1f credits committed",
                      label, task_id, credits)

        video_url = self._poll(task_id, label)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        resp = self.retry(lambda: request(self.session, "GET", video_url, timeout=300),
                          label=f"kling download {label}")
        output_path.write_bytes(resp.content)
        self.log.info("%s video saved (%d KB) — %.1f credits, %.4f USD spent",
                      label, len(resp.content) // 1024, credits, cost)

        return ProviderResult(path=output_path, provider=self.name, kind=self.kind,
                              credits=credits, cost_usd=cost,
                              meta={"task_id": task_id, "duration": duration,
                                    "mode": body["mode"],
                                    "model_name": body["model_name"]})

    # -- transport ---------------------------------------------------------
    def _submit(self, body: dict[str, Any]) -> str:
        resp = request(self.session, "POST", self.base_url + SUBMIT_PATH, json=body,
                       headers={**self._auth_header(),
                                "Content-Type": "application/json"},
                       timeout=float(self.options.get("timeout", 120)))
        data = _payload(resp.json())
        task_id = data.get("task_id") or data.get("taskId")
        if not task_id:
            raise ProviderError(f"kling accepted the request but returned no task_id: "
                                f"{resp.text[:300]}")
        return str(task_id)

    def _poll(self, task_id: str, label: str) -> str:
        interval = float(self.options.get("poll_interval", 10))
        timeout = float(self.options.get("poll_timeout", 900))
        url = f"{self.base_url}{SUBMIT_PATH}/{task_id}"
        deadline = time.monotonic() + timeout
        last_status = ""

        while time.monotonic() < deadline:
            data = self.retry(lambda: _payload(request(
                self.session, "GET", url, headers=self._auth_header(),
                timeout=float(self.options.get("timeout", 120))).json()),
                label=f"kling poll {label}")
            status = str(data.get("task_status", "")).lower()
            if status != last_status:
                self.log.info("%s task %s: %s", label, task_id, status or "unknown")
                last_status = status

            if status in TERMINAL_OK:
                videos = (data.get("task_result") or {}).get("videos") or []
                if not videos or not videos[0].get("url"):
                    raise ProviderError(f"{label}: task succeeded but carried no video URL")
                return str(videos[0]["url"])
            if status in TERMINAL_BAD:
                raise ProviderError(
                    f"{label}: kling task {task_id} {status} — "
                    f"{data.get('task_status_msg') or 'no reason given'}"
                )
            time.sleep(interval)

        raise ProviderError(f"{label}: kling task {task_id} still {last_status or 'pending'} "
                            f"after {timeout}s (credits may already be committed — "
                            f"check the Kling console before resubmitting)")


def _payload(body: dict[str, Any]) -> dict[str, Any]:
    """Unwrap Kling's {code, message, data} envelope, mapping soft errors."""
    if not isinstance(body, dict):
        raise ProviderError(f"unexpected response: {body!r}")
    code = body.get("code")
    if code not in (None, 0, "0"):
        message = body.get("message") or body.get("msg") or ""
        if int(code) in RETRYABLE_BODY_CODES:
            raise RetryableError(f"kling code {code}: {message}")
        raise ProviderError(f"kling code {code}: {message}")
    data = body.get("data")
    return data if isinstance(data, dict) else body


def _encode_image(path: Path) -> str:
    if not path.exists():
        raise ProviderError(f"first frame not found: {path}")
    return base64.b64encode(path.read_bytes()).decode("ascii")


def _sign_jwt(access_key: str, secret_key: str) -> str:
    """Official klingai.com auth: short-lived HS256 token, issuer = access key."""
    try:
        import jwt
    except ImportError as exc:  # pragma: no cover
        raise ProviderError("PyJWT is required for video.auth_mode=jwt") from exc
    now = int(time.time())
    return jwt.encode(
        {"iss": access_key, "exp": now + 1800, "nbf": now - 5},
        secret_key,
        algorithm="HS256",
        headers={"alg": "HS256", "typ": "JWT"},
    )
