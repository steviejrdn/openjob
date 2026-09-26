# Security Policy

## Reporting a vulnerability

OpenJob is a fork of OpenCode with a bundled job-search workspace. Review changes to the workflow yourself, and report issues to the original projects if you believe they affect them broadly.

## Threat model, honestly stated

This is an agentic workflow: an LLM with file access reads untrusted web content (job postings) alongside your personal data (CV, profile, application history). That combination is the main risk surface, and it cannot be fully eliminated - only narrowed. What the framework does about it:

- **Untrusted-input rules**: `/apply` and `/rank` treat posting text as data, never instructions - agents are told not to follow directions embedded in postings and not to fetch URLs found inside posting text (the user-supplied posting URL is the one exception). Reviewer research starts from the company identity the user confirmed, never from links in the posting body.
- **Permission allowlist**: `openjob.json` pre-approves only the specific commands the workflow needs, and everything else prompts. Note the allowlist governs Bash commands - the model's native webfetch/websearch tools are outside its reach, which is exactly why the instruction-level rules above exist.
- **Personal data boundaries**: your populated profile, tracker, salary data, and application archive are gitignored; documents never leave the machine by design - nothing uploads document content anywhere.

Instruction-level defenses raise the bar; they are not a sandbox. If you run this workflow against job boards you do not trust at all, review what the agent fetched and wrote before sending anything out.

## Scope notes

- Portal CLI skills make live requests only when you run them.
- Third-party skills you copy in are **not** covered by this policy - review the code first.
