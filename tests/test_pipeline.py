"""Unit tests for the parts that protect credits: the guard, the resume state,
prompt construction, and the Kling adapter's request/poll handling."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from animator.config import Config
from animator.logging_utils import BudgetExceeded, CreditGuard
from animator.models import Character, Project, Shot
from animator.providers import build
from animator.providers.base import ProviderError, RetryableError
from animator.script_breakdown import _offline_breakdown
from animator.state import RunState, prompt_hash
from animator import prompts as prompt_stage

SCRIPT = """\
THE TEST

INT. KITCHEN - DAY

Ada stirs a pot. Bram drops a spoon.

ADA: You are hopeless.

BRAM: I am consistent.
"""


# -- credit guard ------------------------------------------------------------

def test_guard_blocks_when_call_ceiling_reached():
    guard = CreditGuard(max_paid_calls=2, max_estimated_cost_usd=100)
    for i in range(2):
        guard.charge(kind="video", provider="kling", label=f"s{i}", cost_usd=0.1, credits=10)
    with pytest.raises(BudgetExceeded):
        guard.charge(kind="video", provider="kling", label="s2", cost_usd=0.1, credits=10)
    assert guard.paid_calls == 2


def test_guard_blocks_when_cost_ceiling_reached():
    guard = CreditGuard(max_paid_calls=100, max_estimated_cost_usd=0.25)
    guard.charge(kind="video", provider="kling", label="a", cost_usd=0.2)
    with pytest.raises(BudgetExceeded):
        guard.charge(kind="video", provider="kling", label="b", cost_usd=0.2)


def test_dry_run_never_spends_and_still_projects_cost():
    guard = CreditGuard(dry_run=True, max_paid_calls=1, max_estimated_cost_usd=0.01)
    for i in range(5):
        guard.charge(kind="video", provider="kling", label=f"s{i}", cost_usd=1.0, credits=10)
    assert guard.paid_calls == 0
    assert guard.total_cost == 0.0
    assert "what a real run would cost" in guard.summary()


def test_secrets_are_redacted_from_logged_payloads(caplog):
    guard = CreditGuard()
    with caplog.at_level("INFO"):
        guard.charge(kind="video", provider="kling", label="s",
                     payload={"api_key": "super-secret", "prompt": "a cat"})
    assert "super-secret" not in caplog.text
    assert "<redacted>" in caplog.text


# -- resume state ------------------------------------------------------------

def test_stage_is_reused_only_when_hash_and_file_match(tmp_path):
    state = RunState(tmp_path / "state.json")
    artifact = tmp_path / "shot_01.mp4"
    artifact.write_bytes(b"x")
    phash = prompt_hash("kling", "prompt")

    state.mark_done("shot_01", "video", phash, artifact, "kling")
    assert state.is_satisfied("shot_01", "video", phash)

    assert not state.is_satisfied("shot_01", "video", prompt_hash("kling", "other"))

    artifact.unlink()
    assert not state.is_satisfied("shot_01", "video", phash)


def test_state_survives_reload(tmp_path):
    path = tmp_path / "state.json"
    state = RunState(path)
    state.mark_done("shot_01", "image", "h", tmp_path / "a.png", "mock")
    reloaded = RunState.load_or_new(path)
    assert reloaded.stage("shot_01", "image")["status"] == "done"


def test_reset_clears_a_shot(tmp_path):
    state = RunState(tmp_path / "state.json")
    state.mark_done("shot_01", "video", "h", None, "kling", skipped=True)
    state.reset("shot_01", ("video",))
    assert state.stage("shot_01", "video")["status"] == "pending"


def test_corrupt_state_file_starts_fresh(tmp_path):
    path = tmp_path / "state.json"
    path.write_text("{not json")
    assert RunState.load_or_new(path).data["shots"] == {}


# -- breakdown + prompts -----------------------------------------------------

def test_offline_breakdown_shape():
    data = _offline_breakdown(SCRIPT, {"min_shots": 8, "max_shots": 12,
                                       "min_shot_seconds": 3, "max_shot_seconds": 6,
                                       "target_total_seconds": 60})
    ids = {c["id"] for c in data["characters"]}
    assert ids == {"ada", "bram"}          # the title is not a character
    assert 1 <= len(data["shots"]) <= 12
    assert any(s["dialogue"] for s in data["shots"])


def test_image_prompt_carries_the_character_bible():
    project = Project(title="t", style="ink wash")
    project.characters = [Character(id="ada", name="Ada", hair="short red hair",
                                    outfit="green apron")]
    project.shots = [Shot(id="shot_01", index=1, characters=["ada"],
                          action="Ada stirs a pot", camera="close-up")]
    prompt_stage.build(project, Config({"project": {}}))
    prompt = project.shots[0].image_prompt
    assert "short red hair" in prompt and "green apron" in prompt
    assert "ink wash" in prompt
    # motion prompt must not repeat the design; Kling reads it off the frame
    assert "green apron" not in project.shots[0].animation_prompt


def test_voice_line_is_none_for_a_silent_shot():
    project = Project(title="t")
    assert prompt_stage.voice_line(project, Shot(id="s", index=1, dialogue="")) is None


# -- kling adapter -----------------------------------------------------------

def _kling(dry_run=False, **opts):
    options = {"base_url": "https://example.invalid", "credits_per_call": 10,
               "cost_per_call": 0.1, "poll_interval": 0, "max_retries": 2,
               "backoff_base": 0.01, **opts}
    return build("video", "kling", options, CreditGuard(dry_run=dry_run), dry_run)


def test_kling_dry_run_sends_nothing(tmp_path):
    provider = _kling(dry_run=True)
    result = provider.generate("motion", {"shot_id": "shot_01", "duration": 5},
                               tmp_path / "s.mp4")
    assert result.dry_run and result.path is None
    assert not (tmp_path / "s.mp4").exists()


def test_kling_reads_the_key_from_the_environment_only(monkeypatch):
    monkeypatch.delenv("KLING_API_KEY", raising=False)
    monkeypatch.delenv("KLING_ACCESS_KEY", raising=False)
    monkeypatch.delenv("KLING_SECRET_KEY", raising=False)
    with pytest.raises(ProviderError, match="KLING_API_KEY"):
        _kling()._auth_header()

    monkeypatch.setenv("KLING_API_KEY", "opaque-key")
    assert _kling()._auth_header() == {"Authorization": "Bearer opaque-key"}


def test_kling_uses_jwt_when_an_access_secret_pair_is_present(monkeypatch):
    monkeypatch.setenv("KLING_API_KEY", "ak-123:sk-456")
    header = _kling()._auth_header()["Authorization"]
    assert header.startswith("Bearer ey")     # a signed JWT, not the raw key
    assert "sk-456" not in header


def test_kling_ten_second_pro_clip_costs_four_times_as_much(tmp_path):
    provider = _kling(dry_run=True, mode="pro")
    result = provider.generate("motion", {"shot_id": "s", "duration": 10},
                               tmp_path / "s.mp4")
    assert result.meta["credits"] == 40 and abs(result.meta["cost_usd"] - 0.4) < 1e-9


def test_kling_envelope_maps_rate_limits_to_retryable():
    from animator.providers.video_kling import _payload
    assert _payload({"code": 0, "data": {"task_id": "t1"}}) == {"task_id": "t1"}
    with pytest.raises(RetryableError):
        _payload({"code": 1302, "message": "too fast"})
    with pytest.raises(ProviderError):
        _payload({"code": 1101, "message": "bad request"})


def test_kling_polls_until_the_task_succeeds(monkeypatch, tmp_path):
    monkeypatch.setenv("KLING_API_KEY", "opaque-key")
    provider = _kling()
    statuses = iter(["submitted", "processing", "succeed"])

    class FakeResponse:
        def __init__(self, payload=None, content=b""):
            self._payload, self.content = payload, content
            self.headers = {"content-type": "application/json"}
            self.status_code = 200

        def json(self):
            return self._payload

    def fake_request(sess, method, url, **kwargs):
        if method == "POST":
            return FakeResponse({"code": 0, "data": {"task_id": "task-1"}})
        if url.endswith("task-1"):
            status = next(statuses)
            data = {"task_status": status}
            if status == "succeed":
                data["task_result"] = {"videos": [{"url": "https://cdn/v.mp4"}]}
            return FakeResponse({"code": 0, "data": data})
        return FakeResponse(content=b"MP4DATA")

    monkeypatch.setattr("animator.providers.video_kling.request", fake_request)
    frame = tmp_path / "frame.png"
    frame.write_bytes(b"\x89PNG")
    out = tmp_path / "shot_01.mp4"

    result = provider.generate("motion", {"shot_id": "shot_01", "image_path": frame,
                                          "duration": 5}, out)
    assert out.read_bytes() == b"MP4DATA"
    assert result.meta["task_id"] == "task-1"
    assert result.credits == 10


def test_kling_raises_when_the_task_fails(monkeypatch, tmp_path):
    monkeypatch.setenv("KLING_API_KEY", "opaque-key")
    provider = _kling()

    class FakeResponse:
        headers = {"content-type": "application/json"}
        status_code = 200

        def __init__(self, payload):
            self._payload = payload

        def json(self):
            return self._payload

    def fake_request(sess, method, url, **kwargs):
        if method == "POST":
            return FakeResponse({"code": 0, "data": {"task_id": "task-2"}})
        return FakeResponse({"code": 0, "data": {"task_status": "failed",
                                                 "task_status_msg": "nsfw"}})

    monkeypatch.setattr("animator.providers.video_kling.request", fake_request)
    frame = tmp_path / "frame.png"
    frame.write_bytes(b"\x89PNG")
    with pytest.raises(ProviderError, match="nsfw"):
        provider.generate("motion", {"shot_id": "shot_01", "image_path": frame,
                                     "duration": 5}, tmp_path / "o.mp4")


def test_retry_backs_off_then_gives_up():
    provider = _kling()
    calls = []

    def always_fails():
        calls.append(1)
        raise RetryableError("429")

    with pytest.raises(ProviderError):
        provider.retry(always_fails, attempts=3, base=0.001, label="t")
    assert len(calls) == 3


# -- adapter interface -------------------------------------------------------

def test_every_adapter_shares_the_same_signature():
    import inspect
    from animator.providers import available

    for kind in ("image", "video", "voice", "music"):
        for name in available(kind):
            provider = build(kind, name, {}, CreditGuard(dry_run=True), True)
            params = list(inspect.signature(provider.generate).parameters)
            assert params == ["prompt", "context", "output_path"], f"{kind}/{name}"
            assert provider.output_suffix.startswith(".")


def test_charge_is_released_when_the_call_never_reaches_kling(monkeypatch, tmp_path):
    """A blocked or unreachable endpoint must not be counted as spent credits."""
    monkeypatch.setenv("KLING_API_KEY", "opaque-key")
    guard = CreditGuard(max_paid_calls=10, max_estimated_cost_usd=10)
    provider = build("video", "kling",
                     {"base_url": "https://example.invalid", "credits_per_call": 10,
                      "cost_per_call": 0.1, "max_retries": 2, "backoff_base": 0.001},
                     guard, False)

    def blocked(*a, **k):
        raise RetryableError("Tunnel connection failed: 403 Forbidden")

    monkeypatch.setattr("animator.providers.video_kling.request", blocked)
    frame = tmp_path / "frame.png"
    frame.write_bytes(b"\x89PNG")
    with pytest.raises(ProviderError):
        provider.generate("motion", {"shot_id": "s", "image_path": frame,
                                     "duration": 5}, tmp_path / "o.mp4")
    assert guard.total_cost == 0.0 and guard.total_credits == 0.0
    assert guard.paid_calls == 0
    assert guard.entries[0].status == "not-charged"
