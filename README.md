<p align="center">
  <img src="openjob-logo.svg" alt="OpenJob" width="420">
</p>

# OpenJob

*The job search that runs on your machine.*

OpenJob is a command-line AI agent built for job searching. It is a fork of
[OpenCode](https://github.com/anomalyco/opencode) wrapped around the
[AI Job Search](https://github.com/MadsLorentzen/ai-job-search) workflow: a
terminal user interface (TUI) that evaluates postings against your profile,
tailors your CV and cover letters (LaTeX), and prepares you for interviews —
no code involved.

## Why OpenJob?

Generic coding agents can write a cover letter; they do not know your profile,
your tracker, or your deal-breakers. OpenJob ships the job-search workspace as a
first-class citizen: commands, skills, portal CLIs, and a candidate profile that
every command grounds its claims against. Run `/setup` once, then `/scrape`,
`/rank`, `/apply`, and `/interview` on repeat.

## Features

- Terminal user interface (TUI) job-search shell with an OpenJob home screen
- Host launcher home screen: the prompt only exists inside a user workspace —
  the host opens as a user picker (`↑↓` navigate, `Enter` select, `ctrl+p`
  commands) to switch user or add a new one
- Bundled workspace: commands, skills, agents, portal CLIs, and Python tools
- Multi-agent pipeline: fit evaluation, drafting, and an independent reviewer
- LaTeX CV (moderncv/banking) and cover letter (`cover.cls`) templates
- Job portal search CLIs (Jobbank, Jobdanmark, Jobindex, Jobnet, LinkedIn, Freehire)
- Scrape and rank results projected into `documents/postings/` — a job list plus
  one Markdown note per posting, so the shortlist survives the session
- Resumable `/apply`: an application ledger records step progress per
  company+role and a fresh session resumes at the first pending step
- Application tracking, outcomes, interview prep packs, and HTML reports
- Candidate profile persisted in `AGENTS.md`
- Runtime isolation; single self-contained binary (no Bun/Node required)
- Narrow command surface: a user workspace keeps `/new`, `/sessions`, and the
  workflow commands; models, themes, users, and **Add job portal** live in the
  `ctrl+p` palette (the host launcher has no slash commands)

## Commands

| Command | Purpose |
|---|---|
| `/setup` | Build the candidate profile from your CV and documents |
| `/scrape` | Search job portals for new postings |
| `/rank` | Score and shortlist postings |
| `/apply` | Evaluate fit, then draft and verify CV + cover letter |
| `/outcome` | Record what happened with an application |
| `/interview` | Prepare a stage-specific interview prep pack |
| `/expand` | Broaden search queries and target roles |
| `/upskill` | Turn role gaps into a learning plan |
| `/html-report` | Turn the tracker into a shareable report |
| `/add-template` | Register a custom CV/cover template |
| Add job portal *(host mode)* | Generate a new portal search CLI |
| `/reset` | Clear personal data from the workspace |

## Prerequisites

- A 64-bit Linux, macOS, or Windows machine (Windows via PowerShell, or WSL/Git Bash)
- **Python 3.10+** for the `/rank`, `/apply`, and `/scrape` helper tools (standard library only)
- Optional ATS check for `/apply`: uses `pypdf` if installed, otherwise Poppler `pdftotext` - the tool self-detects, so neither is required
- Optional: a LaTeX distribution with `lualatex` and `xelatex` to compile CVs and cover letters

## Installation

OpenJob ships as a single self-contained binary. No Bun, Node, or package manager
is required.

### Linux, macOS, and WSL/Git Bash

```bash
curl -fsSL https://raw.githubusercontent.com/steviejrdn/openjob/main/scripts/install | bash
```

### Windows (PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -Command "curl.exe -fsSL https://raw.githubusercontent.com/steviejrdn/openjob/main/scripts/install.ps1 -o $env:TEMP\install-openjob.ps1; & $env:TEMP\install-openjob.ps1"
```

### Install a specific version

```bash
OPENJOB_VERSION=0.1.0 bash <(curl -fsSL https://raw.githubusercontent.com/steviejrdn/openjob/main/scripts/install)
```

The installer places the binary on your `PATH` and installs the workspace host
at **`~/OpenJob`** (auth, sessions, and cache stay in `~/.local/share/openjob`).

### Updating

OpenJob never self-updates. When a newer release exists, the TUI shows a toast
(`OpenJob vX available — run: openjob update`) and updating is one command:

```bash
openjob update          # download the latest release and refresh the host
openjob update --check  # only compare the current and latest version
openjob update 0.1.1    # pin a specific version
```

`openjob update` re-runs the official installer (SHA-256 verified), refreshes
the host workspace (`.agents`, `tools`, `fonts`, `scaffold`) and refreshes the
framework copy of every existing user (`users/<name>/.openjob`) while leaving
personal files (profile, CV, documents, tracker) untouched. Each refresh keeps
a backup at `users/<name>/.openjob.bak-<version>`; pass `--no-framework` to
skip it. Set `OPENJOB_DISABLE_UPDATE_CHECK=1` to silence the startup check.

## Usage

```bash
openjob                  # start the job-search TUI
openjob -p "prompt"      # start with a prompt
openjob --continue       # continue the last session
openjob --session <id>   # continue a specific session
```

Inside the TUI, start with `/setup`. The full workflow guide lives in
[WORKSPACE.md](WORKSPACE.md).

### Starting a workspace

The repository (or the installer's workspace template) is an OpenJob **host**:
it carries the shared framework (`scaffold/`, `.agents/`, `tools/`, `fonts/`)
and no personal data. Start OpenJob and create your user from the TUI:

```bash
git clone https://github.com/steviejrdn/openjob ~/openjob
cd ~/openjob
openjob
# inside the TUI:
#   ↑↓/Enter → Add user… → your name   (creates users/<name>/)
#   /setup → build your profile
```

The host home screen is a launcher rather than a prompt: it shows the version
and an inline user picker. Until the first user exists the picker offers only
**Add user…**, and the agent is the built-in Build agent — it switches to the
OpenJob agent once you are inside a user workspace.

With the installed binary you do not need to `cd` anywhere: running `openjob`
from any directory — including inside a user workspace — opens the installed
host at **`~/OpenJob`**, so the launcher always shows the same list. Pick a
user there to switch workspaces. Your documents live in
`~/OpenJob/users/<name>/documents/` — open it any time from the `ctrl+p`
palette → **Open workspace folder**.

From an installed release, run `openjob` from anywhere (it opens `~/OpenJob`)
and create a user the same way.

Personal data lives in `users/<name>/`, which is gitignored and never leaves
your machine.

### Multiple users

Each user gets a `users/<name>/` directory with their own profile, CV,
documents, tracker, scrape state, and a copy of the framework (`.openjob/`
commands, skills, agents), so `/setup` personalizes only that user's files.
`tools/`, `.agents/` (portal CLIs) and `fonts/` are shared from the host
through symlinks; portal skills added via Add job portal are visible to every
user.

- The host launcher's picker lists users, switches to another one (the TUI
  relaunches in that user's directory), and creates a new user. Inside a user
  workspace, `ctrl+p` → **Switch user** does the same.
- `openjob users/<name>` starts directly in that user's workspace.
- A bare `openjob` always opens the host root (`~/OpenJob`), never the active
  user automatically; `users/.active` only marks the last user for the
  launcher.

Per-user data is gitignored, so the repository stays safe to publish.

## How it works

- `openjob` routes work to specialized subagents: `job-application-assistant`
  drafts, the `reviewer` subagent critiques with a fresh context.
- Portal CLIs in `.agents/skills/*/cli/` are orchestrated by `/scrape`; each
  `SKILL.md` documents its flags and its `enabled:` toggle.
- Python tools in `tools/` move state through files (`seen_jobs.json`,
  `job_search_tracker.csv`) instead of through the conversation, and project
  the scrape/rank results into readable Markdown under `documents/postings/`
  (`tools/job_docs.py`).
- `/apply` records its step progress in an application ledger
  (`.openjob/state/applications/<slug>.json`), so a compacted or fresh
  session resumes at the first pending step instead of redoing work.
- Findings persist in `AGENTS.md`, the tracker, and
  `documents/applications/<company>_<role>/`.

## Contributing

OpenJob is a fork of OpenCode. The fork lives in `app/`; this repo wraps it with
the job-search workspace and a launcher. See [app/UPSTREAM.md](app/UPSTREAM.md)
for the fork base and the list of patched files.

The repo root holds the shared framework: `.agents/` (portal CLIs), `tools/`,
`fonts/` (shared Lato fonts, SIL OFL) and `scaffold/` (template sources copied
into new user workspaces: `openjob/` framework, `salary_lookup.py`, CV/cover
letter templates, documents skeleton). Per-user data and framework copies live
in `users/<name>/` and are gitignored.

Requirements: [Bun](https://bun.sh) 1.4.2 (vendored automatically) and Python 3.10+.

```bash
# Install dependencies
cd app
bun install

# Run the dev TUI
./scripts/openjob            # from the repo root
# or directly from app/packages/opencode:
bun run src/index.ts

# Typecheck (all packages)
cd app && bun turbo typecheck
```

### Release

Releases are published automatically by GitHub Actions. Push a `vX.Y.Z` tag and
the workflow cross-compiles all supported platforms, bundles the workspace
template (`openjob-workspace.tar.gz`), and uploads the assets together with a
`SHASUMS256.txt`.

## Attribution

OpenJob is a fork of [OpenCode](https://github.com/anomalyco/opencode) (MIT).
The job-search workflow is a port of
[AI Job Search](https://github.com/MadsLorentzen/ai-job-search) (MIT).
See [LICENSE](LICENSE).

OpenJob is not affiliated with, or endorsed by, OpenCode/Anomaly or the AI Job
Search project.

## License

MIT
