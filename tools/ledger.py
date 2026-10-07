#!/usr/bin/env python3
"""Application ledger - durable resume state for the /apply family of workflows.

State lives at ``<workspace>/.openjob/state/applications/<slug>.json``, one file
per company+role. The ledger is the single source of truth for "where am I", so
a workflow resumes across context compaction or a fresh session instead of
re-deriving steps that already ran.

Run from the workspace root (``users/<name>/``) or pass ``--root``. Stdlib only.

Step order (fixed, matches /apply):
    input -> evaluate -> draft -> review -> revise -> compile -> ats -> record
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

STEP_ORDER = ["input", "evaluate", "draft", "review", "revise", "compile", "ats", "record"]


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (value or "").strip().lower()).strip("-") or "unknown"


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def ledger_dir(root: str) -> Path:
    return Path(root).expanduser() / ".openjob" / "state" / "applications"


def ledger_path(root: str, slug: str) -> Path:
    return ledger_dir(root) / f"{slug}.json"


def load(path: Path) -> dict | None:
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"ledger: cannot read {path}: {exc}") from None


def save(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data["updated"] = now()
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".tmp-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        os.replace(tmp, path)
    except OSError as exc:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise SystemExit(f"ledger: cannot write {path}: {exc}") from None


def new_ledger(company: str, role: str, url: str, steps: list[str]) -> dict:
    return {
        "job": {"company": company, "role": role, "source_url": url or ""},
        "created": now(),
        "updated": now(),
        "steps": {name: {"status": "pending"} for name in steps},
        "artifacts": {},
        "decisions": [],
        "open_questions": [],
    }


def first_pending(data: dict) -> str:
    for name, info in data["steps"].items():
        if info.get("status") != "done":
            return name
    return "none"


def resolve_slug(args) -> str:
    if getattr(args, "slug", None):
        return args.slug
    if not args.company or not args.role:
        raise SystemExit("ledger: provide --company and --role (or --slug)")
    return f"{slugify(args.company)}-{slugify(args.role)}"


def require(data: dict | None, path: Path) -> dict:
    if data is None:
        raise SystemExit(f"ledger: no ledger at {path} - run `ledger.py init` first")
    return data


def cmd_init(args) -> int:
    slug = resolve_slug(args)
    path = ledger_path(args.root, slug)
    steps = [s.strip() for s in args.steps.split(",") if s.strip()] or list(STEP_ORDER)
    data = load(path)
    created = data is None
    if created:
        data = new_ledger(args.company or "", args.role or "", args.url or "", steps)
        save(path, data)
    print(f"ledger: {'created' if created else 'exists'} {slug} (next: {first_pending(data)})")
    print(f"path: {path}")
    return 0


def cmd_status(args) -> int:
    slug = resolve_slug(args)
    path = ledger_path(args.root, slug)
    data = require(load(path), path)
    if args.json:
        print(json.dumps(data, indent=2, ensure_ascii=False))
        return 0
    print(f"ledger: {slug}")
    print(f"job: {data['job'].get('company')} - {data['job'].get('role')}")
    print(f"next: {first_pending(data)}")
    for name, info in data["steps"].items():
        print(f"  {name:9} {info.get('status', 'pending')}")
    if data.get("artifacts"):
        print("artifacts:")
        for key, value in data["artifacts"].items():
            print(f"  {key}: {value}")
    return 0


def cmd_next(args) -> int:
    slug = resolve_slug(args)
    path = ledger_path(args.root, slug)
    data = require(load(path), path)
    print(first_pending(data))
    return 0


def cmd_done(args) -> int:
    slug = resolve_slug(args)
    path = ledger_path(args.root, slug)
    data = require(load(path), path)
    if args.step not in data["steps"]:
        raise SystemExit(f"ledger: unknown step '{args.step}' (valid: {', '.join(data['steps'])})")
    data["steps"][args.step] = {"status": "done", "at": now()}
    save(path, data)
    print(f"ledger: {slug} step '{args.step}' done (next: {first_pending(data)})")
    return 0


def cmd_skip(args) -> int:
    slug = resolve_slug(args)
    path = ledger_path(args.root, slug)
    data = require(load(path), path)
    if args.step not in data["steps"]:
        raise SystemExit(f"ledger: unknown step '{args.step}' (valid: {', '.join(data['steps'])})")
    data["steps"][args.step] = {"status": "skipped", "at": now()}
    save(path, data)
    print(f"ledger: {slug} step '{args.step}' skipped (next: {first_pending(data)})")
    return 0


def cmd_set(args) -> int:
    slug = resolve_slug(args)
    path = ledger_path(args.root, slug)
    data = require(load(path), path)
    for item in args.artifact:
        if "=" not in item:
            raise SystemExit(f"ledger: --artifact must be key=value, got {item!r}")
        key, value = item.split("=", 1)
        data["artifacts"][key.strip()] = value.strip()
    save(path, data)
    print(f"ledger: {slug} artifacts updated")
    return 0


def cmd_note(args) -> int:
    slug = resolve_slug(args)
    path = ledger_path(args.root, slug)
    data = require(load(path), path)
    entry = {"step": args.step or "", "note": args.text, "at": now()}
    if args.question:
        data["open_questions"].append({"text": args.text, "at": now()})
    else:
        data["decisions"].append(entry)
    save(path, data)
    print(f"ledger: {slug} noted")
    return 0


def cmd_list(args) -> int:
    directory = ledger_dir(args.root)
    if not directory.is_dir():
        print("ledger: no applications yet")
        return 0
    for path in sorted(directory.glob("*.json")):
        data = load(path)
        if not data:
            continue
        job = data.get("job", {})
        print(f"{path.stem:40} next={first_pending(data):9} {job.get('company', '')} - {job.get('role', '')}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Application ledger (resume state for /apply).")
    parser.add_argument("--root", default=".", help="workspace root (default: cwd)")
    sub = parser.add_subparsers(dest="command", required=True)

    def common(p):
        p.add_argument("--company")
        p.add_argument("--role")
        p.add_argument("--slug")

    p = sub.add_parser("init", help="create the ledger if missing (idempotent)")
    common(p)
    p.add_argument("--url", default="")
    p.add_argument("--steps", default="", help="comma-separated override of the step order")
    p.set_defaults(func=cmd_init)

    p = sub.add_parser("status", help="show the ledger")
    common(p)
    p.add_argument("--json", action="store_true")
    p.set_defaults(func=cmd_status)

    p = sub.add_parser("next", help="print the first pending step")
    common(p)
    p.set_defaults(func=cmd_next)

    p = sub.add_parser("done", help="mark a step done")
    common(p)
    p.add_argument("--step", required=True)
    p.set_defaults(func=cmd_done)

    p = sub.add_parser("skip", help="mark a step skipped")
    common(p)
    p.add_argument("--step", required=True)
    p.set_defaults(func=cmd_skip)

    p = sub.add_parser("set", help="record artifact paths")
    common(p)
    p.add_argument("--artifact", action="append", default=[], metavar="KEY=PATH")
    p.set_defaults(func=cmd_set)

    p = sub.add_parser("note", help="record a decision or an open question")
    common(p)
    p.add_argument("--step", default="")
    p.add_argument("--text", required=True)
    p.add_argument("--question", action="store_true")
    p.set_defaults(func=cmd_note)

    p = sub.add_parser("list", help="list all applications")
    p.set_defaults(func=cmd_list)

    return parser


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
