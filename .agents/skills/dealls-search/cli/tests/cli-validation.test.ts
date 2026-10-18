import { describe, expect, test } from "bun:test";
import { runCLI } from "./helpers";

// Every case here fails before any network request (flag guard, required-flag
// check, or numeric validation), so the suite is network-free. add-portal.md's
// contract: a bogus flag or missing required arg exits 1 with a JSON error on
// stderr and nothing on stdout — a silently discarded flag would change what
// the search returns with no error.

function expectError(result: { exitCode: number; stdout: string; stderr: string }, code: string) {
  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe("");
  expect(JSON.parse(result.stderr).code).toBe(code);
}

describe("dealls CLI flag validation", () => {
  test("search with neither --query nor --location exits 1", async () => {
    expectError(await runCLI(["search"]), "MISSING_REQUIRED");
  });

  test("a bogus flag exits 1 instead of being silently discarded", async () => {
    const result = await runCLI(["search", "--query", "test", "--bogus-flag", "xyz"]);
    expectError(result, "UNKNOWN_FLAG");
    expect(result.stderr).toContain("--bogus-flag");
  });

  test("--limit 0 is rejected", async () => {
    expectError(await runCLI(["search", "--query", "test", "--limit", "0"]), "BAD_ARG");
  });

  test("--jobage 0 is rejected", async () => {
    expectError(await runCLI(["search", "--query", "test", "--jobage", "0"]), "BAD_ARG");
  });

  test("--format xml is rejected", async () => {
    expectError(await runCLI(["search", "--query", "test", "--format", "xml"]), "BAD_ARG");
  });

  test("a bad --workplace value is rejected", async () => {
    expectError(await runCLI(["search", "--query", "test", "--workplace", "beach"]), "BAD_ARG");
  });

  test("detail without an id exits 1", async () => {
    expectError(await runCLI(["detail"]), "NO_ID");
  });

  test("-h prints help and exits 0", async () => {
    const result = await runCLI(["search", "-h"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("USAGE");
    expect(result.stderr).toBe("");
  });
});
