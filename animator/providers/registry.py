"""Adapter lookup. Register a new provider here and it becomes selectable by
name in config.yaml — nothing else in the pipeline changes."""

from __future__ import annotations

from typing import Any, Callable

from .base import Provider

_REGISTRY: dict[tuple[str, str], Callable[..., Provider]] = {}


def register(kind: str, name: str):
    def decorator(cls):
        _REGISTRY[(kind, name)] = cls
        cls.kind, cls.name = kind, name
        return cls
    return decorator


def available(kind: str) -> list[str]:
    _load_all()
    return sorted(n for (k, n) in _REGISTRY if k == kind)


def build(kind: str, name: str, options: dict[str, Any], guard,
          dry_run: bool = False) -> Provider:
    _load_all()
    try:
        cls = _REGISTRY[(kind, name)]
    except KeyError:
        raise KeyError(
            f"unknown {kind} provider {name!r}; available: {', '.join(available(kind))}"
        ) from None
    return cls(options, guard, dry_run)


def _load_all() -> None:
    from . import (  # noqa: F401  (import side effect registers the adapters)
        image_pollinations, image_openai, image_gemini, image_huggingface, image_mock,
        video_kling, video_mock,
        voice_edge_tts, voice_mock,
        music_silent,
    )


def build_all(cfg, guard, dry_run: bool = False) -> dict[str, Provider]:
    """Instantiate the four adapters named in config.providers.*"""
    providers = {}
    for kind in ("image", "video", "voice", "music"):
        name = cfg.adapter_name(kind)
        providers[kind] = build(kind, name, cfg.adapter_options(kind, name), guard, dry_run)
    return providers
