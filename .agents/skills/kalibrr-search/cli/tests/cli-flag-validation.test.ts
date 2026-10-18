import { describe, test, expect } from "bun:test";
import { runCLI } from "./helpers";

function parsedStderr(stderr: string): { error?: string; code?: string } {
  try {
    return JSON.parse(stderr);
  } catch {
    return {};
  }
}

describe("Kalibrr CLI flag validation", () => {
  test("a bogus flag exits 1 with UNKNOWN_FLAG instead of being silently discarded", async () => {
    const result = await runCLI(["search", "-q", "data analyst", "--bogus-flag", "xyz"]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    const err = parsedStderr(result.stderr);
    expect(err.code).toBe("UNKNOWN_FLAG");
    expect(err.error).toContain("--bogus-flag");
  });

  test("detail without an id exits 1 with NO_ID", async () => {
    const result = await runCLI(["detail"]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(parsedStderr(result.stderr).code).toBe("NO_ID");
  });

  for (const name of ["jobage", "page", "limit"]) {
    test(`--${name} non-numeric exits 1 with BAD_ARG`, async () => {
      const result = await runCLI(["search", "-q", "test", `--${name}`, "foo"]);
      expect(result.exitCode).toBe(1);
      const err = parsedStderr(result.stderr);
      expect(err.code).toBe("BAD_ARG");
      expect(err.error).toMatch(new RegExp(name));
    });

    test(`--${name} 0 exits 1 with BAD_ARG`, async () => {
      const result = await runCLI(["search", "-q", "test", `--${name}`, "0"]);
      expect(result.exitCode).toBe(1);
      expect(parsedStderr(result.stderr).code).toBe("BAD_ARG");
    });
  }

  test("--remote with an unsupported value exits 1 with BAD_ARG", async () => {
    const result = await runCLI(["search", "-q", "test", "--remote", "onsite"]);
    expect(result.exitCode).toBe(1);
    const err = parsedStderr(result.stderr);
    expect(err.code).toBe("BAD_ARG");
    expect(err.error).toMatch(/remote/);
  });

  test("no command prints help and exits 1", async () => {
    const result = await runCLI([]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("kalibrr-cli");
  });
});
