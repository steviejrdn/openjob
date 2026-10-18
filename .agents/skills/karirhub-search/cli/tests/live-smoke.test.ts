import { describe, test, expect } from "bun:test";
import { runCLI, parseJSON } from "./helpers";

interface SearchOutput {
  meta: { count: number; page: number };
  results: Array<{
    id: string;
    title: string;
    company: string | null;
    location: string | null;
    date: string | null;
    url: string;
  }>;
}

// Live smoke tests — these hit the real Karirhub endpoints. Kept to a handful of
// requests (two searches, one detail) so iterating never becomes a crawl.
describe("karirhub live smoke test", () => {
  test("search for the test query returns populated results", async () => {
    const result = await runCLI(["search", "-q", "marketing", "--limit", "5"]);
    expect(result.exitCode).toBe(0);

    const out = parseJSON<SearchOutput>(result);
    expect(out.results.length).toBeGreaterThanOrEqual(1);
    for (const r of out.results) {
      expect(r.id).toBeTruthy();
      expect(r.title).toBeTruthy();
      expect(r.url).toContain("karirhub.kemnaker.go.id");
    }
    const [first] = out.results;
    expect(first.company).toBeTruthy();
    expect(first.location).toBeTruthy();
  });

  test("detail returns a readable description for a real posting", async () => {
    const search = await runCLI(["search", "-q", "marketing", "--limit", "1"]);
    const id = parseJSON<SearchOutput>(search).results[0].id;

    const result = await runCLI(["detail", id, "--format", "plain"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(50);
    expect(result.stdout).not.toContain("<p>");
    expect(result.stdout).not.toContain("&amp;");
  });
});
