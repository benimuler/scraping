"""The one interface every adapter implements.

    provider.generate(prompt: str, context: dict, output_path: Path) -> ProviderResult

Same signature for images, video, voice and music, so swapping a provider is a
one-line change in config.yaml and nothing else. `context` carries whatever the
stage knows (shot, character bible, reference image, duration, ...); an adapter
reads the keys it understands and ignores the rest.
"""

from __future__ import annotations

import abc
import random
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ..logging_utils import get_logger


class ProviderError(RuntimeError):
    """Unrecoverable provider failure (after retries)."""


class RetryableError(ProviderError):
    """Transient failure: rate limit, timeout, 5xx."""


@dataclass
class ProviderResult:
    path: Path | None
    provider: str
    kind: str
    dry_run: bool = False
    credits: float = 0.0
    cost_usd: float = 0.0
    meta: dict[str, Any] = field(default_factory=dict)


class Provider(abc.ABC):
    kind: str = "generic"
    name: str = "base"
    #: file extension this adapter writes; the orchestrator names outputs with it
    output_suffix: str = ".bin"

    def __init__(self, options: dict[str, Any], guard, dry_run: bool = False):
        self.options = options or {}
        self.guard = guard
        self.dry_run = dry_run
        self.log = get_logger(f"{self.kind}:{self.name}")

    # -- the interface -----------------------------------------------------
    @abc.abstractmethod
    def generate(self, prompt: str, context: dict[str, Any],
                 output_path: Path) -> ProviderResult:
        """Produce one artifact at output_path."""

    # -- shared helpers ----------------------------------------------------
    @property
    def cost_per_call(self) -> float:
        return float(self.options.get("cost_per_call", 0.0))

    @property
    def credits_per_call(self) -> float:
        return float(self.options.get("credits_per_call", 0.0))

    def charge(self, label: str, payload: Any = None, note: str = ""):
        """Log + authorise the spend for one call. Always call before sending."""
        return self.guard.charge(
            kind=self.kind, provider=self.name, label=label,
            cost_usd=self.cost_per_call, credits=self.credits_per_call,
            payload=payload, note=note,
        )

    def settle(self, entry, spent: bool) -> None:
        """Release a charge for a call that never reached the provider."""
        if self.guard is not None:
            self.guard.settle(entry, spent)

    def dry_result(self, output_path: Path, meta: dict[str, Any] | None = None
                   ) -> ProviderResult:
        return ProviderResult(path=None, provider=self.name, kind=self.kind,
                              dry_run=True, meta=meta or {})

    def retry(self, fn, *, attempts: int | None = None, base: float | None = None,
              label: str = ""):
        """Exponential backoff (2s, 4s, 8s, 16s) with jitter, for RetryableError."""
        attempts = int(attempts if attempts is not None
                       else self.options.get("max_retries", 4))
        base = float(base if base is not None else self.options.get("backoff_base", 2.0))
        last: Exception | None = None
        for attempt in range(1, attempts + 1):
            try:
                return fn()
            except RetryableError as exc:
                last = exc
                if attempt == attempts:
                    break
                delay = base ** attempt + random.uniform(0, 0.5)
                self.log.warning("%s attempt %d/%d failed (%s) — retrying in %.1fs",
                                 label or self.name, attempt, attempts, exc, delay)
                time.sleep(delay)
        raise ProviderError(f"{label or self.name}: giving up after {attempts} attempts "
                            f"({last})") from last
