"""HTTP helper shared by the network-backed adapters.

Classifies failures into RetryableError (429/5xx/timeouts/connection resets) and
ProviderError (everything else), so `Provider.retry` can back off correctly.
"""

from __future__ import annotations

import os
from typing import Any

import requests

from .providers.base import ProviderError, RetryableError

RETRYABLE_STATUS = {408, 409, 425, 429, 500, 502, 503, 504, 522, 524}


def session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": "animator/0.1 (+pipeline)"})
    # Honour a corporate/agent CA bundle when one is configured.
    bundle = os.environ.get("REQUESTS_CA_BUNDLE") or os.environ.get("SSL_CERT_FILE")
    if bundle and os.path.exists(bundle):
        s.verify = bundle
    return s


def request(sess: requests.Session, method: str, url: str, *, timeout: float = 120,
            **kwargs: Any) -> requests.Response:
    try:
        resp = sess.request(method, url, timeout=timeout, **kwargs)
    except requests.Timeout as exc:
        raise RetryableError(f"timeout after {timeout}s: {url}") from exc
    except requests.ConnectionError as exc:
        raise RetryableError(f"connection error: {exc}") from exc
    except requests.RequestException as exc:
        raise ProviderError(f"request failed: {exc}") from exc

    if resp.status_code in RETRYABLE_STATUS:
        retry_after = resp.headers.get("retry-after")
        hint = f" (retry-after: {retry_after})" if retry_after else ""
        raise RetryableError(f"HTTP {resp.status_code}{hint}: {_snippet(resp)}")
    if resp.status_code >= 400:
        raise ProviderError(f"HTTP {resp.status_code}: {_snippet(resp)}")
    return resp


def _snippet(resp: requests.Response, limit: int = 400) -> str:
    ctype = resp.headers.get("content-type", "")
    if "json" in ctype or "text" in ctype:
        return resp.text[:limit].replace("\n", " ")
    return f"<{len(resp.content)} bytes of {ctype or 'unknown type'}>"
