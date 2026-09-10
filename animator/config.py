"""Configuration loading: config.yaml + .env.

Secrets only ever come from the environment (populated from .env by
python-dotenv). Nothing in config.yaml may contain a key.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml

try:  # optional at import time so `--help` works without deps installed
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover
    load_dotenv = None


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG = PROJECT_ROOT / "config.yaml"


class ConfigError(RuntimeError):
    pass


def load_env(env_file: str | Path | None = None) -> None:
    """Load .env into os.environ (existing env vars win)."""
    if load_dotenv is None:
        return
    path = Path(env_file) if env_file else PROJECT_ROOT / ".env"
    if path.exists():
        load_dotenv(path, override=False)


def require_env(name: str) -> str:
    """Fetch a secret from the environment, never from config/source."""
    value = os.environ.get(name)
    if not value:
        raise ConfigError(
            f"Missing {name}. Add it to .env (see .env.example) — "
            "keys must never be written into source or config.yaml."
        )
    return value


class Config:
    """Thin dotted-path accessor over the parsed YAML."""

    def __init__(self, data: dict[str, Any], path: Path | None = None):
        self.data = data
        self.path = path

    @classmethod
    def load(cls, path: str | Path | None = None) -> "Config":
        cfg_path = Path(path) if path else DEFAULT_CONFIG
        if not cfg_path.exists():
            raise ConfigError(f"config file not found: {cfg_path}")
        with cfg_path.open("r", encoding="utf-8") as fh:
            data = yaml.safe_load(fh) or {}
        return cls(data, cfg_path)

    def get(self, dotted: str, default: Any = None) -> Any:
        node: Any = self.data
        for part in dotted.split("."):
            if not isinstance(node, dict) or part not in node:
                return default
            node = node[part]
        return node

    def section(self, dotted: str) -> dict[str, Any]:
        value = self.get(dotted, {})
        return value if isinstance(value, dict) else {}

    # -- adapter selection -------------------------------------------------
    def adapter_name(self, kind: str) -> str:
        name = self.get(f"providers.{kind}")
        if not name:
            raise ConfigError(f"providers.{kind} is not set in {self.path}")
        return str(name)

    def adapter_options(self, kind: str, name: str | None = None) -> dict[str, Any]:
        name = name or self.adapter_name(kind)
        return dict(self.section(f"{kind}.{name}"))

    def out_dir(self) -> Path:
        return (PROJECT_ROOT / str(self.get("project.out_dir", "out"))).resolve()

    def resolution(self) -> tuple[int, int]:
        raw = str(self.get("project.resolution", "1280x720"))
        w, _, h = raw.partition("x")
        return int(w), int(h)
