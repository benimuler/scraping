"""Command line entry point."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .config import Config, ConfigError, load_env
from .logging_utils import BudgetExceeded, get_logger, setup_logging
from .orchestrator import Pipeline, load_script, status_report
from .providers import available
from .state import STAGES

log = get_logger("cli")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="animator",
        description="Turn a short script into an animated film "
                    "(breakdown -> frames -> video -> voice -> cut).",
    )
    parser.add_argument("-c", "--config", default=None, help="path to config.yaml")
    parser.add_argument("-v", "--verbose", action="store_true")
    parser.add_argument("--env-file", default=None, help="path to a .env file")
    sub = parser.add_subparsers(dest="command", required=True)

    def with_dry_run(p):
        p.add_argument("--dry-run", action="store_true",
                       help="print every request that would be sent, send nothing, "
                            "spend nothing")
        return p

    run = with_dry_run(sub.add_parser("run", help="the whole pipeline"))
    run.add_argument("script", help="path to the script text file")
    run.add_argument("--force-breakdown", action="store_true",
                     help="re-run the LLM breakdown even if it is cached")
    run.add_argument("--only", nargs="*", default=None, metavar="SHOT_ID",
                     help="render only these shots")
    run.add_argument("--force", nargs="*", default=None, metavar="SHOT_ID",
                     help="regenerate these shots even if they already succeeded")
    run.add_argument("--no-assemble", action="store_true")
    run.add_argument("--fail-fast", action="store_true")

    brk = with_dry_run(sub.add_parser("breakdown", help="stages 1-3 only"))
    brk.add_argument("script")
    brk.add_argument("--force-breakdown", action="store_true")

    shots = with_dry_run(sub.add_parser("shots", help="stage 4-5 only (needs a breakdown)"))
    shots.add_argument("--only", nargs="*", default=None, metavar="SHOT_ID")
    shots.add_argument("--force", nargs="*", default=None, metavar="SHOT_ID")
    shots.add_argument("--fail-fast", action="store_true")

    with_dry_run(sub.add_parser("assemble", help="stage 6: cut the film together"))

    regen = with_dry_run(sub.add_parser("regen", help="regenerate one shot"))
    regen.add_argument("shot_id")
    regen.add_argument("--stages", default=",".join(STAGES),
                       help=f"comma separated subset of {','.join(STAGES)}")

    sub.add_parser("status", help="what has been generated so far")
    sub.add_parser("providers", help="list the registered adapters")

    ui = sub.add_parser("ui", help="local Flask review UI")
    ui.add_argument("--host", default="127.0.0.1")
    ui.add_argument("--port", type=int, default=5000)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    setup_logging(args.verbose)
    load_env(args.env_file)

    try:
        cfg = Config.load(args.config)
    except ConfigError as exc:
        log.error("%s", exc)
        return 2

    try:
        return _dispatch(args, cfg)
    except BudgetExceeded as exc:
        log.error("stopped by the credit guard: %s", exc)
        return 3
    except KeyboardInterrupt:
        log.warning("interrupted — progress is saved; re-run to resume")
        return 130
    except (ConfigError, RuntimeError, KeyError, ValueError) as exc:
        log.error("%s", exc)
        return 1


def _dispatch(args, cfg) -> int:
    command = args.command

    if command == "providers":
        for kind in ("image", "video", "voice", "music"):
            selected = cfg.adapter_name(kind)
            names = ", ".join(f"{n}*" if n == selected else n for n in available(kind))
            print(f"{kind:<6} {names}")
        print("\n* = selected in config.yaml")
        return 0

    if command == "status":
        return _status(cfg)

    if command == "ui":
        from .ui.app import create_app
        app = create_app(cfg)
        log.info("review UI on http://%s:%d", args.host, args.port)
        app.run(host=args.host, port=args.port, debug=False)
        return 0

    pipeline = Pipeline(cfg, dry_run=getattr(args, "dry_run", False),
                        fail_fast=getattr(args, "fail_fast", False))
    if pipeline.dry_run:
        log.warning("DRY-RUN: no request will be sent and no credit will be spent")

    if command in ("run", "breakdown"):
        pipeline.prepare(load_script(args.script), force=args.force_breakdown)
        _print_shot_list(pipeline.project)
        if command == "breakdown":
            pipeline.finish()
            return 0

    if command in ("run", "shots"):
        summary = pipeline.run_shots(only=args.only, force=args.force)
        if command == "run" and not args.no_assemble and not summary["failures"]:
            film = pipeline.assemble()
            if film:
                print(f"\nfilm: {film}")
        elif summary["failures"]:
            log.warning("skipping assembly because %d shot(s) failed — fix them "
                        "(animator regen <shot_id>) and re-run",
                        len(summary["failures"]))
        pipeline.finish()
        return 1 if summary["failures"] else 0

    if command == "assemble":
        film = pipeline.assemble()
        if film:
            print(f"\nfilm: {film}")
        pipeline.finish()
        return 0

    if command == "regen":
        stages = tuple(s.strip() for s in args.stages.split(",") if s.strip())
        pipeline.regenerate(args.shot_id, stages)
        pipeline.finish()
        return 0

    return 0


def _print_shot_list(project) -> None:
    if project is None:
        return
    print(f"\n{project.title} — {project.logline}")
    print(f"style: {project.style}\n")
    for shot in project.shots:
        speaker = f" [{shot.speaker}]" if shot.dialogue else ""
        print(f"  {shot.id}  {shot.duration:>4.1f}s  {shot.action[:64]}{speaker}")
    print(f"\n  total {project.total_duration():.1f}s across {len(project.shots)} shots\n")


def _status(cfg) -> int:
    report = status_report(cfg)
    state, project = report["state"], report["project"]
    print(f"out dir: {report['out_dir']}")
    if project is None:
        print("no breakdown yet — run `animator breakdown <script>`")
        return 0
    print(f"project: {project.title} ({len(project.shots)} shots, "
          f"{project.total_duration():.1f}s)")
    header = f"{'shot':<9} {'image':<9} {'video':<9} {'voice':<9}"
    print("\n" + header + "\n" + "-" * len(header))
    for shot in project.shots:
        entry = state.shot(shot.id)
        cells = [f"{entry.get(stage, {}).get('status', 'pending'):<9}" for stage in STAGES]
        print(f"{shot.id:<9} " + " ".join(cells))
    ledger = report["ledger"]
    if ledger:
        print(f"\nspent so far: "
              f"{ledger.get('lifetime_credits', ledger.get('total_credits', 0)):.1f} "
              f"credits / "
              f"{ledger.get('lifetime_cost_usd', ledger.get('total_cost_usd', 0)):.4f} "
              f"USD across {len(ledger.get('entries', []))} recorded calls")
    failed = state.failed_shots()
    if failed:
        print(f"\nfailed shots: {', '.join(failed)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
