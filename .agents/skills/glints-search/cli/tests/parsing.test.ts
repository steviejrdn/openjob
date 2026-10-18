import { describe, test, expect } from "bun:test";
import {
  locationText,
  mapJob,
  normalizeDetailTarget,
  richTextToPlain,
  withinDays,
} from "../src/helpers";

// Network-free unit tests for the parsing helpers. The live path is covered by
// smoke.test.ts; these lock down the shape/edge-case behaviour of the parsers.

describe("locationText", () => {
  test("joins district with its level-3 city parent", () => {
    expect(
      locationText({
        formattedName: "Setiabudi",
        level: 4,
        parents: [
          { formattedName: "Jakarta Selatan", level: 3 },
          { formattedName: "DKI Jakarta", level: 2 },
          { formattedName: "Indonesia", level: 1 },
        ],
      }),
    ).toBe("Setiabudi, Jakarta Selatan");
  });

  test("falls back to the bare name and null", () => {
    expect(locationText({ formattedName: "Remote", parents: [] })).toBe("Remote");
    expect(locationText(null)).toBeNull();
  });
});

describe("richTextToPlain", () => {
  test("flattens Draft.js blocks, bullets and html entities", () => {
    const doc = JSON.stringify({
      blocks: [
        { text: "Qualifications:", type: "unstyled" },
        { text: "3+ years &amp; SQL", type: "unordered-list-item" },
        { text: "Apply now", type: "unordered-list-item" },
      ],
    });
    const text = richTextToPlain(doc);
    expect(text).toContain("Qualifications:");
    expect(text).toContain("- 3+ years & SQL");
    expect(text).toContain("- Apply now");
  });

  test("returns null for empty or invalid input", () => {
    expect(richTextToPlain(null)).toBeNull();
    expect(richTextToPlain("not json")).toBeNull();
    expect(richTextToPlain(JSON.stringify({ blocks: [{ text: "" }] }))).toBeNull();
  });
});

describe("normalizeDetailTarget", () => {
  test("accepts a bare uuid or a Glints job URL", () => {
    const uuid = "e4cc66ac-3bfa-4fdf-b61f-c8406298b8a5";
    expect(normalizeDetailTarget(uuid)).toBe(uuid);
    expect(
      normalizeDetailTarget(`https://glints.com/id/opportunities/jobs/data-analyst/${uuid}?x=1`),
    ).toBe(uuid);
  });

  test("rejects input without a uuid", () => {
    expect(normalizeDetailTarget("not-a-real-id")).toBeNull();
  });
});

describe("mapJob", () => {
  test("normalizes a GraphQL job into the card shape", () => {
    const card = mapJob({
      id: "abc-123",
      title: "Data Analyst",
      createdAt: "2026-09-21T02:25:35.486Z",
      company: { name: "PT Example", brandName: null },
      location: { formattedName: "Setiabudi", level: 4, parents: [] },
    });
    expect(card.id).toBe("abc-123");
    expect(card.title).toBe("Data Analyst");
    expect(card.company).toBe("PT Example");
    expect(card.date).toBe("2026-09-21T02:25:35.486Z");
    expect(card.url).toContain("glints.com/id/opportunities/jobs/abc-123");
  });
});

describe("withinDays", () => {
  const now = Date.parse("2026-10-17T00:00:00Z");
  test("bounds the posting age window", () => {
    expect(withinDays("2026-10-15T00:00:00Z", 7, now)).toBe(true);
    expect(withinDays("2026-09-01T00:00:00Z", 7, now)).toBe(false);
    expect(withinDays(null, 7, now)).toBe(false);
  });
});
