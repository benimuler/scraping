"""Console logging plus the credit/cost ledger.

Every billable call must pass through `CreditGuard.charge()`, which (a) logs
exactly what is about to be spent, (b) enforces the per-run ceilings from
config.safety, and (c) is a no-op accounting entry in dry-run mode.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any

RESET = "\033[0m"
COLORS = {
    "DEBUG": "\033[38;5;244m",
    "INFO": "\033[38;5;39m",
    "WARNING": "\033[38;5;214m",
    "ERROR": "\033[38;5;203m",
    "CRITICAL": "\033[1;38;5;203m",
}


class _ColorFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        msg = super().format(record)
        if sys.stderr.isatty():
            color = COLORS.get(record.levelname, "")
            return f"{color}{msg}{RESET}"
        return msg


def setup_logging(verbose: bool = False) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(_ColorFormatter("%(asctime)s %(levelname)-7s %(name)s | %(message)s",
                                         datefmt="%H:%M:%S"))
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


class BudgetExceeded(RuntimeError):
    """Raised instead of making a call that would break a configured ceiling."""


@dataclass
class LedgerEntry:
    kind: str            # image | video | voice | music | llm
    provider: str
    label: str           # e.g. "shot_03"
    credits: float = 0.0
    cost_usd: float = 0.0
    free: bool = True
    dry_run: bool = False
    note: str = ""
    #: "spent" once the call reached the provider; "not-charged" when it never did
    status: str = "spent"


@dataclass
class CreditGuard:
    """Tracks and caps spend for one run."""

    dry_run: bool = False
    max_paid_calls: int = 30
    max_estimated_cost_usd: float = 5.0
    log_payload: bool = True
    confirm_before_paid: bool = False
    entries: list[LedgerEntry] = field(default_factory=list)
    _confirmed: bool = False

    @classmethod
    def from_config(cls, cfg, dry_run: bool) -> "CreditGuard":
        safety = cfg.section("safety")
        return cls(
            dry_run=dry_run,
            max_paid_calls=int(safety.get("max_paid_calls", 30)),
            max_estimated_cost_usd=float(safety.get("max_estimated_cost_usd", 5.0)),
            log_payload=bool(safety.get("log_payload_before_paid_call", True)),
            confirm_before_paid=bool(safety.get("confirm_before_paid", False)),
        )

    # -- accounting --------------------------------------------------------
    @property
    def paid_calls(self) -> int:
        return sum(1 for e in self.entries
                   if not e.free and not e.dry_run and e.status == "spent")

    @property
    def total_cost(self) -> float:
        return sum(e.cost_usd for e in self.entries if not e.dry_run)

    @property
    def total_credits(self) -> float:
        return sum(e.credits for e in self.entries if not e.dry_run)

    def charge(
        self,
        *,
        kind: str,
        provider: str,
        label: str,
        cost_usd: float = 0.0,
        credits: float = 0.0,
        payload: Any = None,
        note: str = "",
    ) -> LedgerEntry:
        """Log + authorise one provider call. Call this immediately before it."""
        log = get_logger("credits")
        free = cost_usd <= 0 and credits <= 0
        prefix = "[DRY-RUN] " if self.dry_run else ""

        if free:
            log.info("%s%s/%s %s — FREE (no credits consumed)", prefix, kind, provider, label)
        else:
            projected_cost = self.total_cost + (0 if self.dry_run else cost_usd)
            projected_calls = self.paid_calls + (0 if self.dry_run else 1)
            log.warning(
                "%sPAID CALL %s/%s %s — est. %.4f USD / %.1f credits "
                "(run total would be %d paid calls, %.4f USD)",
                prefix, kind, provider, label, cost_usd, credits,
                projected_calls, projected_cost,
            )
            if not self.dry_run:
                if projected_calls > self.max_paid_calls:
                    raise BudgetExceeded(
                        f"refusing call: would be paid call #{projected_calls}, "
                        f"safety.max_paid_calls={self.max_paid_calls}"
                    )
                if projected_cost > self.max_estimated_cost_usd:
                    raise BudgetExceeded(
                        f"refusing call: would reach {projected_cost:.4f} USD, "
                        f"safety.max_estimated_cost_usd={self.max_estimated_cost_usd}"
                    )
                self._confirm()

        if payload is not None and (self.log_payload or self.dry_run):
            body = payload if isinstance(payload, str) else json.dumps(
                _redact(payload), ensure_ascii=False, indent=2
            )
            log.info("%srequest payload for %s:\n%s", prefix, label, body)

        entry = LedgerEntry(kind=kind, provider=provider, label=label, credits=credits,
                            cost_usd=cost_usd, free=free, dry_run=self.dry_run, note=note)
        self.entries.append(entry)
        return entry

    def settle(self, entry: LedgerEntry | None, spent: bool) -> None:
        """Correct an entry after the fact.

        `charge` runs *before* the request, so a call that never reached the
        provider (DNS failure, blocked egress, auth rejected before submission)
        would otherwise be counted as money spent. Adapters call this with
        spent=False in that case; anything that did reach the provider stays
        charged, because the credits are already committed there.
        """
        if entry is None or entry.status != "spent" or spent:
            return
        entry.status = "not-charged"
        if entry.cost_usd or entry.credits:
            get_logger("credits").info(
                "%s/%s %s never reached the provider — %.4f USD / %.1f credits "
                "released", entry.kind, entry.provider, entry.label,
                entry.cost_usd, entry.credits)
        entry.cost_usd = 0.0
        entry.credits = 0.0

    def _confirm(self) -> None:
        if not self.confirm_before_paid or self._confirmed:
            return
        if not sys.stdin.isatty():
            self._confirmed = True
            return
        answer = input("About to spend real credits. Continue? [y/N] ").strip().lower()
        if answer not in {"y", "yes"}:
            raise BudgetExceeded("aborted by user before the first paid call")
        self._confirmed = True

    # -- reporting ---------------------------------------------------------
    def summary(self) -> str:
        # In a dry run the columns show what the same run would have cost.
        by_provider: dict[str, dict[str, float]] = {}
        for e in self.entries:
            key = f"{e.kind}/{e.provider}"
            agg = by_provider.setdefault(key, {"calls": 0, "credits": 0.0, "usd": 0.0})
            agg["calls"] += 1
            agg["credits"] += e.credits
            agg["usd"] += e.cost_usd
        lines = ["", "=== credit / cost ledger ==="]
        if self.dry_run:
            lines.append("DRY-RUN: nothing was sent and nothing was billed — the "
                         "figures below are what a real run would cost.")
        for key, agg in sorted(by_provider.items()):
            lines.append(
                f"  {key:<26} {int(agg['calls']):>3} calls  "
                f"{agg['credits']:>8.1f} credits  {agg['usd']:>8.4f} USD"
            )
        credits = sum(e.credits for e in self.entries)
        cost = sum(e.cost_usd for e in self.entries)
        lines.append(
            f"  {'TOTAL':<26} {len(self.entries):>3} calls  "
            f"{credits:>8.1f} credits  {cost:>8.4f} USD"
        )
        return "\n".join(lines)

    def dump(self, path: Path) -> None:
        """Append this run to the on-disk ledger, so spend accumulates across
        resumes and one-off regenerations instead of being overwritten."""
        path.parent.mkdir(parents=True, exist_ok=True)
        previous: list[dict[str, Any]] = []
        if path.exists():
            try:
                previous = json.loads(path.read_text(encoding="utf-8")).get("entries", [])
            except (json.JSONDecodeError, AttributeError):
                previous = []
        payload = {
            "dry_run": self.dry_run,
            "projected_cost_usd": sum(e.cost_usd for e in self.entries),
            "projected_credits": sum(e.credits for e in self.entries),
            "total_cost_usd": self.total_cost,
            "total_credits": self.total_credits,
            "paid_calls": self.paid_calls,
            "entries": previous + [asdict(e) for e in self.entries],
        }
        payload["lifetime_cost_usd"] = sum(
            e.get("cost_usd", 0.0) for e in payload["entries"] if not e.get("dry_run")
        )
        payload["lifetime_credits"] = sum(
            e.get("credits", 0.0) for e in payload["entries"] if not e.get("dry_run")
        )
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


_SECRET_HINTS = ("key", "token", "secret", "authorization", "password")


def _redact(obj: Any) -> Any:
    """Never let a credential reach a log line."""
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if any(h in str(k).lower() for h in _SECRET_HINTS):
                out[k] = "<redacted>"
            elif isinstance(v, str) and len(v) > 2000:
                out[k] = f"<{len(v)} chars elided>"
            else:
                out[k] = _redact(v)
        return out
    if isinstance(obj, list):
        return [_redact(v) for v in obj]
    return obj
