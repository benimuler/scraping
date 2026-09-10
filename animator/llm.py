"""Claude wrapper used by the script-breakdown and character-bible steps.

Only these two steps need an LLM; everything downstream is deterministic.
An offline fallback keeps the pipeline usable (and testable) without a key.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

from .logging_utils import get_logger

log = get_logger("llm")


class LLMError(RuntimeError):
    pass


def _extract_json(text: str) -> Any:
    """Pull the first JSON object/array out of a model response."""
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start = min((i for i in (text.find("{"), text.find("[")) if i != -1), default=-1)
    if start == -1:
        raise LLMError(f"no JSON found in model response:\n{text[:500]}")
    for end in range(len(text), start, -1):
        chunk = text[start:end]
        if chunk[-1] not in "}]":
            continue
        try:
            return json.loads(chunk)
        except json.JSONDecodeError:
            continue
    raise LLMError(f"could not parse JSON from model response:\n{text[:500]}")


class ClaudeClient:
    """Thin wrapper over the Anthropic Messages API.

    The SDK already retries 429/5xx/connection errors, so we only add the
    JSON-extraction layer and the credit ledger hook on top.
    """

    def __init__(self, cfg, guard=None):
        self.model = str(cfg.get("llm.model", "claude-opus-5"))
        self.max_tokens = int(cfg.get("llm.max_tokens", 8000))
        self.guard = guard
        try:
            import anthropic
        except ImportError as exc:  # pragma: no cover
            raise LLMError("the `anthropic` package is not installed") from exc
        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise LLMError(
                "ANTHROPIC_API_KEY is not set — add it to .env to use the "
                "Claude-powered script breakdown"
            )
        self._anthropic = anthropic
        self.client = anthropic.Anthropic(max_retries=4)

    def json(self, *, system: str, user: str, label: str) -> Any:
        if self.guard is not None:
            self.guard.charge(
                kind="llm", provider=f"claude:{self.model}", label=label,
                cost_usd=0.0, credits=0.0,
                note="token-metered; billed on your Anthropic account",
                payload={"model": self.model, "system": system[:400], "user": user[:800]},
            )
            if self.guard.dry_run:
                raise LLMError("dry-run: refusing to call the Claude API")

        log.info("calling %s for %s", self.model, label)
        # Streaming keeps a large max_tokens from hitting the HTTP timeout.
        with self.client.messages.stream(
            model=self.model,
            max_tokens=self.max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        ) as stream:
            message = stream.get_final_message()

        if message.stop_reason == "refusal":
            raise LLMError(f"model declined the request: {message.stop_details}")
        text = "".join(b.text for b in message.content if b.type == "text")
        if not text.strip():
            raise LLMError("model returned no text content")
        return _extract_json(text)


def build_client(cfg, guard=None) -> ClaudeClient | None:
    """Return a Claude client, or None when the offline fallback should run."""
    provider = str(cfg.get("llm.provider", "claude")).lower()
    if guard is not None and guard.dry_run:
        log.warning("[DRY-RUN] skipping the %s call — using the offline breakdown "
                    "so the rest of the pipeline can still be inspected",
                    cfg.get("llm.model", "claude"))
        return None
    if provider == "offline":
        log.info("llm.provider=offline — using the deterministic breakdown")
        return None
    try:
        return ClaudeClient(cfg, guard=guard)
    except LLMError as exc:
        if cfg.get("llm.fallback_offline", True):
            log.warning("%s — falling back to the offline breakdown", exc)
            return None
        raise
