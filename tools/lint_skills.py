#!/usr/bin/env python3
"""Lint the repo's skill, command, and settings files.

Run from anywhere: python tools/lint_skills.py

Checks:
- Every SKILL.md (scaffold/openjob/skills/*, .agents/skills/*) has YAML frontmatter that
  parses, with non-empty `name` and `description` keys
- `allowed-tools` entries of the form `Bash(bun run <path> *)` point at files
  that exist (skill paths resolve relative to the repo root and to .agents/)
- Every scaffold/openjob/commands/*.md starts with a `# /<name>` title
- openjob.json is valid JSON with a permission object

Exit code 0 on success, 1 with a failure list otherwise.
"""

import json
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("lint_skills.py requires PyYAML: pip install pyyaml")

ROOT = Path(__file__).resolve().parent.parent
errors: list[str] = []
warnings: list[str] = []

# Fumble patterns: decisions the prompt leaves to the model that belong in a
# tool, or install/pre-flight steps that do not belong in a workflow body.
BANNED = [
    (re.compile(r"pip install", re.I), "install step in a workflow body"),
    (re.compile(r"\bif configured\b", re.I), "conditional availability"),
    (re.compile(r"\btries\b[^.\n]*\bfirst\b", re.I), "tool-internal fallback leaked into the prompt"),
    (re.compile(r"availability check", re.I), "pre-flight availability check"),
    (re.compile(r"if both[^.\n]*missing", re.I), "pre-flight fallback branch"),
    (re.compile(r"iterate until", re.I), "unbounded loop"),
]


def rel(path: Path) -> str:
    return str(path.relative_to(ROOT))


def strip_comments(text: str) -> str:
    return re.sub(r"<!--.*?-->", "", text, flags=re.S)


def check_fumble(paths: list[Path]) -> None:
    """Flag fumble wording (fatal) and duplicated paragraphs (advisory)."""
    seen: dict[str, list[str]] = {}
    for path in paths:
        text = strip_comments(path.read_text(encoding="utf-8"))
        for lineno, line in enumerate(text.splitlines(), 1):
            for pattern, why in BANNED:
                if pattern.search(line):
                    errors.append(f"{rel(path)}:{lineno}: fumble pattern ({why}): {line.strip()[:90]}")
        for para in re.split(r"\n\s*\n", text):
            norm = " ".join(para.split()).lower()
            if len(norm) < 120 or para.lstrip().startswith(("#", "|", "```")):
                continue
            seen.setdefault(norm, []).append(rel(path))
    for norm, files in seen.items():
        uniq = sorted(set(files))
        if len(uniq) >= 3:
            warnings.append(f"duplicated paragraph in {len(uniq)} files: {norm[:60]}... ({', '.join(uniq)})")


def check_done_when(paths: list[Path]) -> None:
    for path in paths:
        text = strip_comments(path.read_text(encoding="utf-8"))
        if not re.search(r"(?im)^\s*done when:", text):
            warnings.append(f"{rel(path)}: no 'Done when:' line")


def check_skill(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        errors.append(f"{rel(path)}: missing YAML frontmatter (file must start with ---)")
        return
    end = text.find("\n---", 4)
    if end == -1:
        errors.append(f"{rel(path)}: unterminated YAML frontmatter")
        return
    try:
        data = yaml.safe_load(text[4:end])
    except yaml.YAMLError as exc:
        errors.append(f"{rel(path)}: frontmatter is not valid YAML: {exc}")
        return
    if not isinstance(data, dict):
        errors.append(f"{rel(path)}: frontmatter did not parse to a mapping")
        return
    for key in ("name", "description"):
        if not data.get(key):
            errors.append(f"{rel(path)}: frontmatter missing required key '{key}'")

    allowed = data.get("allowed-tools", "")
    if isinstance(allowed, str):
        for match in re.finditer(r"bun run ([^\s)]+)", allowed):
            target = match.group(1).rstrip("*")
            if not target or target.endswith("/"):
                continue
            # Targets may contain globs (e.g. .agents/skills/*/cli/src/cli.ts);
            # require at least one existing file to match.
            if "*" in target:
                if not list(ROOT.glob(target)) and not list((ROOT / ".agents").glob(target)):
                    errors.append(f"{rel(path)}: allowed-tools glob matches no files: {target}")
            else:
                candidates = [ROOT / target, ROOT / ".agents" / target]
                if not any(c.is_file() for c in candidates):
                    errors.append(f"{rel(path)}: allowed-tools references a missing file: {target}")


def check_command(path: Path) -> None:
    text = path.read_text(encoding="utf-8").lstrip()
    # OpenJob command files may start with YAML frontmatter (--- ... ---);
    # skip it before checking for the '# /<name>' title.
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            text = text[end + 4 :].lstrip()
    lines = text.splitlines()
    first = lines[0] if lines else ""
    if not first.startswith("# /"):
        errors.append(f"{rel(path)}: command file must start with a '# /<name>' title (found: {first[:50]!r})")


def check_settings() -> None:
    path = ROOT / "openjob.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"openjob.json: {exc}")
        return
    if not isinstance(data, dict):
        errors.append("openjob.json: expected top-level JSON value to be an object")
        return
    permission = data.get("permission", {})
    if not isinstance(permission, dict):
        errors.append("openjob.json: expected permission to be an object")
        return


def main() -> int:
    skills = sorted(ROOT.glob("scaffold/openjob/skills/*/SKILL.md")) + sorted(ROOT.glob(".agents/skills/*/SKILL.md"))
    commands = sorted((ROOT / "scaffold" / "openjob" / "commands").glob("*.md")) + sorted(
        (ROOT / "scaffold" / "host" / "commands").glob("*.md")
    )
    docs = [
        p
        for p in sorted(ROOT.glob("scaffold/openjob/skills/**/*.md")) + sorted(ROOT.glob(".agents/skills/**/*.md"))
        if "/cli/" not in p.as_posix()
    ]
    if not skills:
        errors.append("no SKILL.md files found - glob roots are wrong or the tree moved")
    if not commands:
        errors.append("no command files found under scaffold/openjob/commands/")

    for skill in skills:
        check_skill(skill)
    for command in commands:
        check_command(command)
    check_settings()
    check_fumble(commands + docs)
    check_done_when(commands)

    if warnings:
        print(f"lint_skills: {len(warnings)} warning(s)")
        for warning in warnings:
            print(f"  ~ {warning}")

    if errors:
        print(f"lint_skills: {len(errors)} failure(s)")
        for err in errors:
            print(f"  - {err}")
        return 1
    print(f"lint_skills: OK ({len(skills)} skills, {len(commands)} commands, openjob.json)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
