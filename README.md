# animator — script → animated short

Turns a one-minute script into a finished animated film: Claude breaks the text
into a shot list, an image provider draws the first frame of every shot, Kling
animates each frame into video, edge-tts speaks the dialogue, and ffmpeg cuts it
all together.

```
script.txt
   │
   ├─ 1. breakdown ──────── Claude → 8-12 shots × 3-6s (scene, cast, action, dialogue)
   ├─ 2. character bible ── Claude → one fixed visual description per character
   ├─ 3. prompts ────────── per shot: a frame prompt + a motion prompt
   │
   ├─ 4. providers ──────── image → video (Kling) → voice (edge-tts) → music
   ├─ 5. orchestrator ───── shot by shot, resumable, credit-capped
   ├─ 6. assembly ───────── ffmpeg → film.mp4
   └─ 7. UI ─────────────── local Flask page to watch and re-roll single shots
```

---

## Install

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

ffmpeg is required and is not a Python package:

```bash
# macOS
brew install ffmpeg
# Debian / Ubuntu
sudo apt install ffmpeg
```

## Keys

Everything secret lives in `.env`, which is gitignored. `.env.example` lists the
recognised names. **Keys are read from the environment only** — never from
`config.yaml`, never from source, and they are redacted out of every log line.

```ini
KLING_API_KEY=...          # required for the Kling video adapter
ANTHROPIC_API_KEY=...      # optional: the LLM breakdown; falls back offline
OPENAI_API_KEY=...         # optional: only for the openai image adapter
GEMINI_API_KEY=...         # optional: only for the gemini ("nano banana") adapter
HF_API_TOKEN=...           # optional: only for the huggingface adapter
```

Without `ANTHROPIC_API_KEY` the pipeline still runs: it falls back to a
deterministic offline breakdown (parses the script, groups it into shots, makes
a stable character bible). Set `llm.fallback_offline: false` to hard-fail
instead.

### Which Kling credential do I have?

Kling's own console (`klingai.com`) issues an **AccessKey / SecretKey pair** and
expects a short-lived HS256 JWT. Resellers and gateways usually issue a **single
opaque key** used as a plain bearer token. The adapter handles both:

| what you have | `.env` | `video.kling.auth_mode` |
|---|---|---|
| access key + secret key | `KLING_ACCESS_KEY=` / `KLING_SECRET_KEY=` | `auto` (signs a JWT) |
| one opaque key | `KLING_API_KEY=` | `auto` (sends it as a bearer token) |
| a pair on one line | `KLING_API_KEY=ak:sk` | `auto` (splits, signs a JWT) |

`auto` picks by what is present; set `jwt` or `bearer` explicitly to override.
If the API answers 401, that choice is the first thing to check.

---

## Run it

**Always dry-run first.** A dry run prints the exact request every adapter would
send, totals what it would cost, and sends nothing:

```bash
python run.py run scripts/sample_script.txt --dry-run
```

```
PAID CALL video/kling shot_01 — est. 0.0980 USD / 10.0 credits (run total would be 1 paid calls, 0.0980 USD)
...
=== credit / cost ledger ===
DRY-RUN: nothing was sent and nothing was billed — the figures below are what a real run would cost.
  image/pollinations          12 calls       0.0 credits    0.0000 USD
  video/kling                 12 calls     120.0 credits    1.1760 USD
  voice/edge_tts               8 calls       0.0 credits    0.0000 USD
  TOTAL                       32 calls     120.0 credits    1.1760 USD
```

A dry run writes to `state.dryrun.json`, never to the real resume point, so it
can never trick a later run into skipping shots.

Then, for real:

```bash
python run.py run scripts/sample_script.txt
python run.py ui                    # http://127.0.0.1:5000
```

To rehearse the whole thing with no network and no credits at all, use the
offline twin config — every adapter is a local stand-in and it still produces a
real `film.mp4`:

```bash
python run.py -c config.mock.yaml run scripts/sample_script.txt
```

### Commands

| command | what it does |
|---|---|
| `run <script>` | the whole pipeline |
| `breakdown <script>` | stages 1-3 only; writes `project.json` |
| `shots` | stages 4-5 for an existing breakdown |
| `assemble` | stage 6: cut the film |
| `regen <shot_id> [--stages image,video,voice]` | redo one shot |
| `status` | per-shot table of what exists and what it cost |
| `providers` | list registered adapters and which are selected |
| `ui` | the review page |

Useful flags: `--dry-run`, `--only shot_03 shot_04`, `--force shot_03`,
`--force-breakdown`, `--no-assemble`, `--fail-fast`, `-c other-config.yaml`, `-v`.

### Output layout

```
out/<project.name>/
  project.json     shot list + character bible + every prompt
  state.json       the resume point
  ledger.json      every call ever made for this project, and what it cost
  images/          first frame per shot
  video/           animated clip per shot
  voice/           dialogue per shot
  segments/        normalised per-shot segments
  film.mp4         the film
```

---

## Not wasting credits

This is the part the design actually optimises for.

1. **Dry-run mode** prints every request and totals the cost without sending.
2. **A pre-flight log line before every billable call**, naming the provider,
   the shot, the estimated cost and credits, and the running total. Free calls
   say so explicitly.
3. **Hard ceilings** in `config.yaml` — `safety.max_paid_calls` and
   `safety.max_estimated_cost_usd`. The orchestrator refuses the call that would
   cross either one and exits; it does not simply warn.
   `safety.confirm_before_paid: true` adds an interactive prompt before the
   first paid call of a run.
4. **Resume** (below): a shot that already succeeded is never re-billed.
5. **Charges are released when a call never reached the provider** (blocked
   egress, DNS failure, auth rejected before submission), so the ledger reflects
   what was actually committed. Once Kling has accepted a task the charge
   stands, because the credits are gone regardless of what the poll does.
6. **Keys are redacted** from every logged payload.

### Resume

Every stage of every shot records its status, its output path, and a hash of the
prompt that produced it. On the next run a stage is skipped only when all three
still agree, so:

- a crash, a rate limit, or a Ctrl-C costs you nothing on the retry — just re-run
  the same command;
- editing a prompt in `project.json` regenerates exactly that shot and nothing
  else;
- deleting an output file regenerates exactly that file.

```bash
python run.py run scripts/sample_script.txt   # died at shot 4
python run.py run scripts/sample_script.txt   # resumes at shot 4, shots 1-3 free
```

`regen <shot_id>` forces one shot to be redone; the UI's per-shot buttons call
the same code path.

---

## Adding a new provider

Every adapter — image, video, voice, music — implements the same method:

```python
generate(prompt: str, context: dict, output_path: Path) -> ProviderResult
```

`context` carries whatever the stage knows (`shot_id`, `image_path`, `duration`,
`voice`, `negative_prompt`, `fps`, `resolution`); an adapter reads the keys it
understands and ignores the rest. So a new provider is one file plus one line of
config.

```python
# animator/providers/video_myprovider.py
from pathlib import Path
from typing import Any

from ..config import require_env
from ..http import request, session
from .base import Provider, ProviderError, ProviderResult
from .registry import register


@register("video", "myprovider")
class MyVideoProvider(Provider):
    output_suffix = ".mp4"

    def generate(self, prompt: str, context: dict[str, Any],
                 output_path: Path) -> ProviderResult:
        label = context.get("shot_id", output_path.stem)
        body = {"prompt": prompt, "image": str(context["image_path"])}

        # 1. always log + authorise the spend before sending
        entry = self.charge(label, payload=body)
        # 2. always honour dry-run
        if self.dry_run:
            return self.dry_result(output_path, {"body": body})

        key = require_env("MYPROVIDER_API_KEY")   # environment only, never config
        try:
            # 3. self.retry gives you 2s/4s/8s/16s backoff on RetryableError,
            #    which animator.http raises for 429/5xx/timeouts
            resp = self.retry(
                lambda: request(session(), "POST", "https://api.example.com/v1/video",
                                json=body, headers={"Authorization": f"Bearer {key}"}),
                label=f"myprovider {label}",
            )
        except Exception:
            self.settle(entry, spent=False)       # never reached them → not billed
            raise

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(resp.content)
        return ProviderResult(path=output_path, provider=self.name, kind=self.kind,
                              credits=self.credits_per_call, cost_usd=self.cost_per_call)
```

Then:

1. add it to the import list in `animator/providers/registry.py::_load_all`;
2. add a `video.myprovider:` block to `config.yaml` (whatever options you read,
   plus `cost_per_call` / `credits_per_call` so the guard can price it);
3. point `providers.video` at `myprovider`.

Nothing else in the pipeline changes. `python run.py providers` lists what is
registered and which one is selected.

### Adapters that ship

| kind | name | notes |
|---|---|---|
| image | `pollinations` | **default** — free, no key |
| image | `openai` | gpt-image-1 / DALL·E, paid |
| image | `gemini` | `gemini-2.5-flash-image` ("nano banana"), paid |
| image | `huggingface` | SDXL on the free inference tier |
| image | `mock` | local placeholder frames, no network |
| video | `kling` | **default** — image-to-video, async submit + poll |
| video | `mock` | local ffmpeg ken-burns, no credits |
| voice | `edge_tts` | **default** — free, local |
| voice | `mock` | local tones, no network |
| music | `silent` | placeholder; swap in a real scorer later |

---

## Configuration

`config.yaml` is the only knob file. The blocks that matter most:

```yaml
providers:            # which adapter each stage uses
  image: "pollinations"
  video: "kling"
  voice: "edge_tts"
  music: "silent"

video:
  kling:
    base_url: "https://api-singapore.klingai.com"   # api.klingai.com for the CN console
    model_name: "kling-v1-6"
    mode: "std"          # pro costs roughly double
    duration: 5          # 10s clips cost roughly double
    poll_interval: 10    # seconds between task-status polls
    poll_timeout: 900    # give up on a task after this long
    max_retries: 4       # with 2s/4s/8s/16s backoff
    credits_per_call: 10 # what one std/5s clip costs you — used in the pre-flight log
    cost_per_call: 0.098

safety:
  max_paid_calls: 30
  max_estimated_cost_usd: 5.0
  confirm_before_paid: false
```

Check `credits_per_call` and `cost_per_call` against your own plan — they only
drive the logging and the ceilings, not the billing.

---

## Tests

```bash
pip install pytest && python -m pytest tests -q
```

They cover the credit guard's ceilings and redaction, the resume rules, prompt
construction, and the Kling adapter's auth selection, envelope handling, polling
and retry behaviour (with a faked transport — the tests never hit the network).

## Troubleshooting

| symptom | cause |
|---|---|
| `KLING_API_KEY is not set` | `.env` missing or not loaded; pass `--env-file` |
| Kling 401 | wrong `auth_mode` for your credential — see the table above |
| `kling task ... still pending after 900s` | raise `poll_timeout`; check the console before resubmitting, the credits may already be committed |
| `ffmpeg not found on PATH` | install ffmpeg |
| every shot regenerates | `project.json` prompts changed, or the output files were deleted |
| `Tunnel connection failed: 403` | outbound egress to the provider is blocked by a proxy or firewall |
