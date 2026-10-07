#!/usr/bin/env python3
"""Tests for tools/ledger.py (stdlib unittest, no dependencies).

Run from anywhere:
    python3 tools/test_ledger.py
"""

from __future__ import annotations

import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ledger  # noqa: E402


def run(root, *args):
    """Invoke the CLI with --root before the subcommand; return (code, stdout)."""
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        try:
            code = ledger.main(["--root", root, *args])
        except SystemExit as exc:  # argparse + our error paths
            code = exc.code
    return code, buf.getvalue()


class LedgerTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = self._tmp.name

    def tearDown(self):
        self._tmp.cleanup()

    @property
    def path(self):
        return Path(self.root) / ".openjob" / "state" / "applications" / "acme-tpm.json"

    def init(self, company="Acme", role="TPM"):
        return run(self.root, "init", "--company", company, "--role", role)

    def test_slugify(self):
        self.assertEqual(ledger.slugify("Acme Corp"), "acme-corp")
        self.assertEqual(ledger.slugify("Senior TPM / Platform"), "senior-tpm-platform")
        self.assertEqual(ledger.slugify(""), "unknown")

    def test_init_creates_then_is_idempotent(self):
        code, out = self.init()
        self.assertEqual(code, 0)
        self.assertIn("created", out)
        self.assertTrue(self.path.is_file())

        code, out = self.init()
        self.assertEqual(code, 0)
        self.assertIn("exists", out)
        self.assertEqual(ledger.first_pending(ledger.load(self.path)), "input")

    def test_next_advances_in_fixed_order(self):
        self.init()
        self.assertEqual(run(self.root, "next", "--company", "Acme", "--role", "TPM")[1].strip(), "input")
        run(self.root, "done", "--company", "Acme", "--role", "TPM", "--step", "input")
        run(self.root, "done", "--company", "Acme", "--role", "TPM", "--step", "evaluate")
        self.assertEqual(run(self.root, "next", "--company", "Acme", "--role", "TPM")[1].strip(), "draft")

    def test_done_unknown_step_fails(self):
        self.init()
        code, _ = run(self.root, "done", "--company", "Acme", "--role", "TPM", "--step", "nope")
        self.assertNotEqual(code, 0)

    def test_set_and_note(self):
        self.init()
        run(
            self.root,
            "set",
            "--company",
            "Acme",
            "--role",
            "TPM",
            "--artifact",
            "cv=cv/main_acme_tpm.tex",
            "--artifact",
            "cover=cover_letters/cover_acme_tpm.tex",
        )
        run(self.root, "note", "--company", "Acme", "--role", "TPM", "--step", "evaluate", "--text", "gap: SQL")
        run(self.root, "note", "--company", "Acme", "--role", "TPM", "--text", "confirm salary", "--question")
        data = ledger.load(self.path)
        self.assertEqual(data["artifacts"]["cv"], "cv/main_acme_tpm.tex")
        self.assertEqual(data["decisions"][0]["note"], "gap: SQL")
        self.assertEqual(data["open_questions"][0]["text"], "confirm salary")

    def test_resume_after_new_process(self):
        # Simulates a fresh session: state lives in the file, not memory.
        self.init()
        for step in ("input", "evaluate", "draft"):
            run(self.root, "done", "--company", "Acme", "--role", "TPM", "--step", step)
        code, out = run(self.root, "status", "--company", "Acme", "--role", "TPM", "--json")
        self.assertEqual(code, 0)
        self.assertIn("review", out)
        self.assertEqual(ledger.first_pending(ledger.load(self.path)), "review")

    def test_missing_ledger_errors(self):
        code, _ = run(self.root, "status", "--company", "Ghost", "--role", "None")
        self.assertNotEqual(code, 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
