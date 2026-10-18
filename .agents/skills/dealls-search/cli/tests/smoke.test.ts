import { describe, expect, test } from "bun:test";
import { parseJSON, runCLI } from "./helpers";

// Live smoke test — this hits api.sejutacita.id for real. It is the guard
// add-portal.md requires: a portal skill must never be registered on parser
// assumptions alone. If the API is unreachable, this fails loudly rather than
// silently passing.

interface SearchResult {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  date: string | null;
  url: string;
}

describe("dealls search (live)", () => {
  test('search "data analyst" returns populated results', async () => {
    const result = await runCLI(["search", "-q", "data analyst", "--limit", "5", "--format", "json"]);
    expect(result.exitCode).toBe(0);

    const payload = parseJSON<{ meta: { count: number; page: number }; results: SearchResult[] }>(result);
    expect(payload.meta.count).toBeGreaterThanOrEqual(1);
    expect(payload.results.length).toBeGreaterThanOrEqual(1);

    for (const job of payload.results) {
      expect(job.id).toBeTruthy();
      expect(job.title).toBeTruthy();
      expect(job.url).toContain("dealls.com/loker/");
    }
  });
});

describe("dealls detail (live)", () => {
  test("detail returns a readable description for a real posting", async () => {
    const search = parseJSON<{ results: SearchResult[] }>(
      await runCLI(["search", "-q", "data analyst", "--limit", "1", "--format", "json"]),
    );
    const id = search.results[0]?.id;
    expect(id).toBeTruthy();

    const result = await runCLI(["detail", id as string, "--format", "json"]);
    expect(result.exitCode).toBe(0);

    const job = parseJSON<{ title: string; url: string; description: string | null }>(result);
    expect(job.title).toBeTruthy();
    expect(job.url).toContain("dealls.com/loker/");
    expect(job.description).toBeTruthy();
  });
});
