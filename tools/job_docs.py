#!/usr/bin/env python3
"""Project the job-search state into readable workspace documents.

/scrape and /rank keep machine state in job_scraper/seen_jobs.json, and /apply
and /outcome record applications in job_search_tracker.csv. Neither is readable
as a document, and a rank shortlist that only ever existed in the session
disappears with the session. This tool projects that state into
documents/postings/:

  job-list.md
      running summary: ranked shortlist, closing soon, new postings,
      vetoed/expired, and the application pipeline
  jobs/<Company> - <Title>.md
      one note per job: metadata, strengths/gaps, the posting text snapshot,
      and a Notes block

Three subcommands:

  sync          regenerate job-list.md and the notes from state; optionally
                ingest posting text snapshots from a scratch directory
  find          resolve a job (by URL or company+role) to its note
  set-posting   store a freshly fetched posting text in a job's note

Notes are generated. Everything between the `posting:start/end` and
`notes:start/end` markers is preserved across syncs, so hand-written notes and
captured posting text survive regeneration. A file without the `generated: true`
marker is never overwritten unless --force is passed.

Nothing here fetches a posting or judges a fit. Scraping and scoring stay with
the model; this only renders the state it already produced.

Usage:
  python3 tools/job_docs.py sync [--postings DIR] [--dry-run] [--force]
  python3 tools/job_docs.py find --url URL
  python3 tools/job_docs.py find --company COMPANY --role ROLE
  python3 tools/job_docs.py set-posting --key KEY --file FILE [--source SOURCE]

All subcommands print JSON on stdout. Exit 0 on success, 1 on a usage or state
error (for example `set-posting` with a key that is not in seen_jobs.json).
`sync` and `find` tolerate a workspace that has never scraped (no
seen_jobs.json) and report an empty result instead of failing, so `/apply` still
works for a posting that was never scraped.
"""

import argparse
import csv
import json
import os
import re
import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path

ROOT = Path.cwd()
STATE = ROOT / "job_scraper" / "seen_jobs.json"
TRACKER = ROOT / "job_search_tracker.csv"
DOCS = ROOT / "documents" / "postings"
NOTES = DOCS / "jobs"
LIST = DOCS / "job-list.md"

URGENT_DAYS = 7
GENERATED_MARKER = "generated: true"


def norm(text) -> str:
    return re.sub(r"[^a-z0-9]", "", str(text or "").lower())


def safe_name(text, max_len=110) -> str:
    text = re.sub(r"[\x00-\x1f]", "", str(text))
    for ch in '\\/:*?"<>|#^':
        text = text.replace(ch, "-")
    text = re.sub(r"\s+", " ", text).strip(" .-")
    return text[:max_len].rstrip(" .-") or "untitled"


def yaml_str(value) -> str:
    return json.dumps(str(value), ensure_ascii=False)


def parse_iso(value) -> date | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", value):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def load_state(required: bool = True) -> tuple[dict, dict]:
    if not STATE.is_file():
        if required:
            sys.exit(f"{STATE} not found - run /scrape first")
        return {}, {}
    try:
        doc = json.loads(STATE.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        sys.exit(f"{STATE} is not valid JSON: {exc}")
    seen = doc.get("seen") if isinstance(doc, dict) and "seen" in doc else doc
    if not isinstance(seen, dict):
        sys.exit(f"{STATE}: expected an object of job entries")
    return doc, {k: v for k, v in seen.items() if isinstance(v, dict)}


def load_tracker() -> list[dict]:
    if not TRACKER.is_file():
        return []
    with TRACKER.open(encoding="utf-8", newline="") as fh:
        rows = list(csv.DictReader(fh))
    return [r for r in rows if any(str(v or "").strip() for v in r.values())]


def entry_sort_key(entry) -> int:
    score = 0
    if entry.get("status") not in (None, "skipped", "expired"):
        score += 2
    if entry.get("rank_score") is not None:
        score += 1
    return score


def collect_jobs(seen: dict, tracker_rows: list[dict]) -> list[dict]:
    """Jobs worth a note: ranked, high/medium fit, or already in the tracker.

    Duplicate company+role pairs across portals are merged into the richest
    entry so the workspace keeps one note per real job."""
    tracked = {}
    for row in tracker_rows:
        tracked[(norm(row.get("company")), norm(row.get("role")))] = row

    merged: dict[tuple[str, str], dict] = {}
    for key, entry in seen.items():
        pair = (norm(entry.get("company")), norm(entry.get("title")))
        tracked_row = tracked.get(pair)
        if not (entry.get("fit") in ("high", "medium") or entry.get("rank_score") is not None or tracked_row):
            continue
        candidate = dict(entry)
        candidate["_key"] = key
        candidate["_keys"] = [key]
        candidate["_tracked"] = tracked_row
        current = merged.get(pair)
        if current is None:
            merged[pair] = candidate
            continue
        better, worse = (candidate, current) if entry_sort_key(candidate) > entry_sort_key(current) else (current, candidate)
        for field in (
            "strengths",
            "gaps",
            "rank_score",
            "rank_verdict",
            "rank_date",
            "deadline",
            "posted_date",
            "language_note",
            "location_verdict",
            "language_gate",
        ):
            if better.get(field) in (None, [], "") and worse.get(field) not in (None, [], ""):
                better[field] = worse[field]
        if not better.get("_tracked"):
            better["_tracked"] = worse.get("_tracked")
        better["_keys"] = better["_keys"] + [k for k in worse["_keys"] if k not in better["_keys"]]
        merged[pair] = better

    return sorted(merged.values(), key=lambda j: (str(j.get("company") or "").lower(), str(j.get("title") or "").lower()))


def note_names(jobs: list[dict]) -> dict[str, str]:
    """Deterministic note filename per job key. Jobs are already sorted, so a
    collision always resolves the same way across sync/find/set-posting."""
    used: set[str] = set()
    names: dict[str, str] = {}
    for job in jobs:
        base = safe_name(f"{job.get('company') or 'Unknown company'} - {job.get('title') or 'Untitled role'}")
        name = f"{base}.md"
        n = 2
        while name.lower() in used:
            name = f"{base} ({n}).md"
            n += 1
        used.add(name.lower())
        for key in job["_keys"]:
            names[key] = name
    return names


def note_status(job: dict) -> str:
    tracked = job.get("_tracked")
    if tracked and str(tracked.get("status") or "").strip():
        return str(tracked["status"]).strip()
    return str(job.get("status") or "unknown")


def extract_section(text: str, name: str) -> str:
    pattern = re.compile(rf"<!-- {re.escape(name)}:start -->(.*?)<!-- {re.escape(name)}:end -->", re.DOTALL)
    found = pattern.search(text or "")
    return found.group(1).strip("\n") if found else ""


def load_postings(directory: Path | None) -> dict[str, str]:
    """Read posting snapshots written by the scoring agents. Each file starts
    with `<!-- key: <key> -->` followed by the verbatim posting text."""
    if directory is None:
        return {}
    if not directory.is_dir():
        sys.exit(f"--postings directory not found: {directory}")
    snapshots: dict[str, str] = {}
    for path in sorted(directory.glob("*.txt")):
        text = path.read_text(encoding="utf-8", errors="replace")
        marker = re.match(r"^\s*<!--\s*key:\s*(.+?)\s*-->\s*\n", text)
        if not marker:
            print(f"skip (no key marker): {path}", file=sys.stderr)
            continue
        snapshots[marker.group(1)] = text[marker.end():].strip("\n")
    return snapshots


def build_note(job: dict, posting: str, notes: str) -> str:
    title = job.get("title") or "Untitled role"
    company = job.get("company") or "Unknown company"
    url = job.get("url") or ""
    status = note_status(job)
    fit = job.get("fit") or ""
    score = job.get("rank_score")
    verdict = job.get("rank_verdict")
    posted = job.get("posted_date")
    deadline = job.get("deadline")
    portal = job.get("portal") or ""

    tags = ["job"]
    if fit:
        tags.append(f"fit/{fit}")
    if status:
        tags.append("status/" + status.replace(" ", "-"))

    fm = [
        "---",
        GENERATED_MARKER,
        "type: job",
        f"company: {yaml_str(company)}",
        f"role: {yaml_str(title)}",
        f"url: {yaml_str(url)}",
        f"portal: {yaml_str(portal)}" if portal else "portal:",
        f"fit: {yaml_str(fit)}" if fit else "fit:",
        f"status: {yaml_str(status)}",
        f"score: {score}" if score is not None else "score:",
        f"verdict: {yaml_str(verdict)}" if verdict else "verdict:",
        f"posted: {yaml_str(posted)}" if posted else "posted:",
        f"deadline: {yaml_str(deadline)}" if deadline else "deadline:",
        f"first_seen: {yaml_str(job.get('first_seen'))}" if job.get("first_seen") else "first_seen:",
        f"rank_date: {yaml_str(job.get('rank_date'))}" if job.get("rank_date") else "rank_date:",
        f"location_verdict: {yaml_str(job.get('location_verdict'))}" if job.get("location_verdict") else "location_verdict:",
        f"language_gate: {yaml_str(job.get('language_gate'))}" if job.get("language_gate") else "language_gate:",
        f"language_note: {yaml_str(job.get('language_note'))}" if job.get("language_note") else "language_note:",
        "tags:",
    ]
    fm += [f"  - {t}" for t in tags]
    fm += ["---", ""]

    facts = [f"**Status:** {status}"]
    if score is not None:
        facts.append(f"**Triage score:** {score} ({verdict})")
    if fit:
        facts.append(f"**Scrape fit:** {fit.capitalize()}")
    facts.append(f"**Posted:** {posted or 'not stated'}")
    facts.append(f"**Deadline:** {deadline or 'not stated'}")
    facts.append(f"**First seen:** {job.get('first_seen') or 'unknown'}")

    body = [f"# {company} - {title}", "", " | ".join(facts), ""]
    if url:
        body.append(f"**Posting:** [{portal or 'link'}]({url})")
    body += ["", "Links: `documents/postings/job-list.md`", ""]

    strengths = job.get("strengths") or []
    gaps = job.get("gaps") or []
    if strengths:
        body += ["## Why it fits", ""] + [f"- {s}" for s in strengths] + [""]
    if gaps:
        body += ["## Gaps / watch-outs", ""] + [f"- {g}" for g in gaps] + [""]
    if job.get("language_note"):
        body += [f"> Language note: {job['language_note']}", ""]

    body += [
        "## Posting",
        "",
        "<!-- posting:start -->",
        posting or "_No posting text captured yet._",
        "<!-- posting:end -->",
        "",
        "## Notes",
        "",
        "<!-- notes:start -->",
        notes or "- ",
        "<!-- notes:end -->",
        "",
    ]
    return "\n".join(fm + body)


def link_to_note(filename: str) -> str:
    return f"[note](<jobs/{filename}>)"


def cell(value) -> str:
    return str(value or "").replace("|", "\\|").replace("\n", " ")


def build_list(jobs: list[dict], tracker_rows: list[dict], names: dict[str, str], today: date) -> str:
    ranked = [j for j in jobs if j.get("rank_score") is not None]
    vetoed = [j for j in ranked if j.get("location_verdict") == "FAIL" or j.get("language_gate") == "FAIL"]
    veto_keys = {j["_key"] for j in vetoed}
    shortlist = [j for j in ranked if j["_key"] not in veto_keys]
    shortlist.sort(key=lambda j: (j.get("rank_score") or 0), reverse=True)
    new = [j for j in jobs if j.get("status") == "new" and j.get("rank_score") is None]
    expired = [j for j in jobs if j.get("status") == "expired"]
    closing = []
    for job in shortlist:
        deadline = parse_iso(job.get("deadline"))
        if deadline and today <= deadline <= today + timedelta(days=URGENT_DAYS):
            closing.append(job)
    closing.sort(key=lambda j: j.get("deadline") or "")

    lines = [
        "---",
        GENERATED_MARKER,
        "type: job-list",
        f"updated: {today.isoformat()}",
        "---",
        "",
        "# Job List",
        "",
        "Auto-generated by OpenJob from `job_scraper/seen_jobs.json` and `job_search_tracker.csv`.",
        "Refresh with `python3 tools/job_docs.py sync`; `/scrape`, `/rank`, `/apply`, and `/outcome` run it automatically.",
        "One note per job lives in `documents/postings/jobs/`.",
        "",
        "## Snapshot",
        "",
        "| Metric | Value |",
        "|---|---|",
        f"| Jobs with notes | {len(jobs)} |",
        f"| Ranked | {len(ranked)} |",
        f"| New (not ranked) | {len(new)} |",
        f"| Closing within {URGENT_DAYS} days | {len(closing)} |",
        f"| Expired | {len(expired)} |",
        f"| Applications on file | {len(tracker_rows)} |",
        f"| Last generated | {today.isoformat()} |",
        "",
    ]

    def row(index, job) -> str:
        name = names.get(job["_key"], "")
        score = job.get("rank_score")
        deadline = job.get("deadline") or ""
        url = job.get("url") or ""
        status = note_status(job)
        cells = [
            str(index),
            str(score) if score is not None else "",
            cell(job.get("rank_verdict")),
            cell(job.get("title")),
            cell(job.get("company")),
            cell(deadline),
            cell(status),
            link_to_note(name) if name else "",
            f"[link]({url})" if url else "",
        ]
        return "| " + " | ".join(cells) + " |"

    def table(rows: list[dict]) -> list[str]:
        out = ["| # | Score | Verdict | Title | Company | Deadline | Status | Note | URL |", "|---|---|---|---|---|---|---|---|---|"]
        out += [row(i, job) for i, job in enumerate(rows, 1)]
        return out

    lines += ["## Ranked shortlist", ""]
    lines += table(shortlist) if shortlist else ["_Nothing ranked yet - run `/rank`._"]
    lines += [""]

    if closing:
        lines += ["## Closing soon", ""]
        lines += table(closing)
        lines += [""]

    lines += ["## New (not ranked yet)", ""]
    lines += table(new) if new else ["_No unranked postings._"]
    lines += [""]

    if vetoed:
        lines += ["## Vetoed (location / language deal-breaker)", ""]
        lines += table(vetoed)
        lines += [""]

    if expired:
        lines += ["## Expired", ""]
        lines += table(expired)
        lines += [""]

    lines += ["## Applications", ""]
    if tracker_rows:
        lines += [
            "| Date | Company | Role | Status | Note |",
            "|---|---|---|---|---|",
        ]
        for tracker_row in tracker_rows:
            pair = (norm(tracker_row.get("company")), norm(tracker_row.get("role")))
            match = next((j for j in jobs if (norm(j.get("company")), norm(j.get("title"))) == pair), None)
            name = names.get(match["_key"], "") if match else ""
            lines.append(
                "| "
                + " | ".join(
                    [
                        cell(tracker_row.get("date")),
                        cell(tracker_row.get("company")),
                        cell(tracker_row.get("role")),
                        cell(tracker_row.get("status")),
                        link_to_note(name) if name else "",
                    ]
                )
                + " |"
            )
    else:
        lines.append("_No applications recorded yet._")
    lines += [""]
    return "\n".join(lines)


def is_generated(path: Path) -> bool:
    if not path.is_file():
        return True
    return GENERATED_MARKER in path.read_text(encoding="utf-8", errors="replace")[:400]


def write_file(path: Path, content: str, force: bool, dry_run: bool, result: dict) -> None:
    existing = path.read_text(encoding="utf-8", errors="replace") if path.is_file() else None
    if existing == content:
        result["unchanged"] += 1
        return
    if existing is not None and not force and not is_generated(path):
        result["skipped"].append(str(path.relative_to(ROOT)))
        return
    if dry_run:
        result["would_write"].append(str(path.relative_to(ROOT)))
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=f".{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(content)
        os.replace(tmp, path)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise
    result["written"].append(str(path.relative_to(ROOT)))


def cmd_sync(args) -> int:
    _, seen = load_state(required=False)
    if not seen:
        reason = f"{STATE} not found" if not STATE.is_file() else "no job entries yet"
        print(json.dumps({"notes": 0, "reason": f"{reason} - nothing to document"}, indent=2))
        return 0
    tracker_rows = load_tracker()
    jobs = collect_jobs(seen, tracker_rows)
    names = note_names(jobs)
    snapshots = load_postings(args.postings)
    today = args.today

    result = {"written": [], "would_write": [], "unchanged": 0, "skipped": []}
    for job in jobs:
        filename = names[job["_key"]]
        path = NOTES / filename
        existing = path.read_text(encoding="utf-8", errors="replace") if path.is_file() else ""
        preserved_posting = extract_section(existing, "posting")
        preserved_notes = extract_section(existing, "notes")
        fresh = next((snapshots[k] for k in job["_keys"] if snapshots.get(k)), None)
        posting = fresh or preserved_posting
        write_file(path, build_note(job, posting, preserved_notes), args.force, args.dry_run, result)

    write_file(LIST, build_list(jobs, tracker_rows, names, today), args.force, args.dry_run, result)

    print(
        json.dumps(
            {
                "notes": len(jobs),
                "snapshots_ingested": len(snapshots),
                "written": result["written"],
                "would_write": result["would_write"],
                "unchanged": result["unchanged"],
                "skipped": result["skipped"],
                "list": str(LIST.relative_to(ROOT)),
                "dry_run": args.dry_run,
            },
            indent=2,
            ensure_ascii=False,
        )
    )
    return 0


def resolve_job(seen: dict, url: str | None, company: str | None, role: str | None) -> tuple[str, dict] | None:
    if url:
        wanted = url.strip().rstrip("/")
        for key, entry in seen.items():
            if str(entry.get("url") or "").strip().rstrip("/") == wanted:
                return key, entry
    if company and role:
        pair = (norm(company), norm(role))
        for key, entry in seen.items():
            if (norm(entry.get("company")), norm(entry.get("title"))) == pair:
                return key, entry
    return None


def cmd_find(args) -> int:
    _, seen = load_state(required=False)
    found = resolve_job(seen, args.url, args.company, args.role)
    if not found:
        print(json.dumps({"found": False}, indent=2))
        return 0
    key, _ = found
    jobs = collect_jobs(seen, load_tracker())
    names = note_names(jobs)
    filename = names.get(key)
    if not filename:
        print(json.dumps({"found": True, "key": key, "note": None, "reason": "job has no note (low fit, unranked)"}, indent=2))
        return 0
    path = NOTES / filename
    posting = extract_section(path.read_text(encoding="utf-8", errors="replace"), "posting") if path.is_file() else ""
    print(
        json.dumps(
            {
                "found": True,
                "key": key,
                "note": str(path.relative_to(ROOT)),
                "has_posting": bool(posting and posting != "_No posting text captured yet._"),
            },
            indent=2,
            ensure_ascii=False,
        )
    )
    return 0


def cmd_set_posting(args) -> int:
    _, seen = load_state()
    entry = seen.get(args.key)
    if entry is None:
        sys.exit(f"no such key in {STATE}: {args.key}")
    try:
        posting = Path(args.file).read_text(encoding="utf-8", errors="replace").strip("\n")
    except OSError as exc:
        sys.exit(f"cannot read posting file {args.file}: {exc}")

    jobs = collect_jobs(seen, load_tracker())
    names = note_names(jobs)
    filename = names.get(args.key)
    if not filename:
        sys.exit(f"job {args.key} is not in the document set (low fit and unranked)")
    path = NOTES / filename
    if not path.is_file():
        sys.exit(f"note not found: {path} - run /scrape or /rank first")
    existing = path.read_text(encoding="utf-8", errors="replace")
    if "<!-- posting:start -->" not in existing or "<!-- posting:end -->" not in existing:
        sys.exit(f"note has no posting section: {path}")
    header = f"<!-- source: {args.source} | captured: {args.today.isoformat()} -->\n" if args.source else ""
    updated = re.sub(
        r"<!-- posting:start -->.*?<!-- posting:end -->",
        lambda _: f"<!-- posting:start -->\n{header}{posting}\n<!-- posting:end -->",
        existing,
        count=1,
        flags=re.DOTALL,
    )
    result = {"written": [], "would_write": [], "unchanged": 0, "skipped": []}
    write_file(path, updated, False, False, result)
    if result["skipped"]:
        sys.exit(f"refusing to overwrite a note without the generated marker: {path} (run sync --force to regenerate it)")
    print(json.dumps({"key": args.key, "note": str(path.relative_to(ROOT)), "chars": len(posting)}, indent=2))
    return 0


def main() -> int:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--today", type=date.fromisoformat, default=date.today())

    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = ap.add_subparsers(dest="command", required=True)

    sync = sub.add_parser("sync", parents=[common], help="regenerate job-list.md and the notes")
    sync.add_argument("--postings", type=Path, help="scratch directory with posting text snapshots")
    sync.add_argument("--dry-run", action="store_true")
    sync.add_argument("--force", action="store_true", help="also overwrite files not marked generated")
    sync.set_defaults(func=cmd_sync)

    find = sub.add_parser("find", parents=[common], help="resolve a job to its note")
    find.add_argument("--url")
    find.add_argument("--company")
    find.add_argument("--role")
    find.set_defaults(func=cmd_find)

    setp = sub.add_parser("set-posting", parents=[common], help="store a fetched posting text in a note")
    setp.add_argument("--key", required=True)
    setp.add_argument("--file", required=True)
    setp.add_argument("--source", help="where the text came from, e.g. apply-fetch or rank-fetch")
    setp.set_defaults(func=cmd_set_posting)

    args = ap.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
