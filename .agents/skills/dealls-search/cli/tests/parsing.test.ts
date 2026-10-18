import { describe, expect, test } from "bun:test";
import {
  htmlToText,
  jobUrl,
  mapDetail,
  mapJob,
  normalizeDetailTarget,
  withinDays,
} from "../src/helpers";

// Fixtures mirror the real api.sejutacita.id shapes documented in
// ../url-reference.md, so a change in field names fails here before it reaches
// a live run.

const SEARCH_DOC = {
  id: "6ad0a38d879b500012fa234e",
  slug: "software-development-engineer-in-test-10",
  role: "Software Development Engineer in Test",
  publishedAt: "2026-10-15T09:57:33.396Z",
  city: { id: 157, name: "Jakarta Pusat" },
  country: { id: 102, name: "Indonesia" },
  company: { name: "PT. Inovasi Anak Indonesia - PARKEE", slug: "pt-inovasi-anak-indonesia-parkee" },
};

describe("jobUrl", () => {
  test("builds /loker/<slug>~<companySlug>", () => {
    expect(jobUrl("backend-engineer-7", "jakmallcom")).toBe(
      "https://dealls.com/loker/backend-engineer-7~jakmallcom",
    );
  });

  test("falls back to /loker/<slug> without a company slug", () => {
    expect(jobUrl("backend-engineer-7", null)).toBe("https://dealls.com/loker/backend-engineer-7");
  });
});

describe("mapJob", () => {
  test("maps the contract fields from a search document", () => {
    expect(mapJob(SEARCH_DOC)).toEqual({
      id: "6ad0a38d879b500012fa234e",
      title: "Software Development Engineer in Test",
      company: "PT. Inovasi Anak Indonesia - PARKEE",
      location: "Jakarta Pusat",
      date: "2026-10-15T09:57:33.396Z",
      url: "https://dealls.com/loker/software-development-engineer-in-test-10~pt-inovasi-anak-indonesia-parkee",
    });
  });

  test("uses the country name when the city is absent", () => {
    const job = mapJob({ ...SEARCH_DOC, city: null });
    expect(job.location).toBe("Indonesia");
  });

  test("nulls missing optional fields instead of omitting them", () => {
    const job = mapJob({ id: "x", role: "Role", slug: "s" });
    expect(job.company).toBeNull();
    expect(job.location).toBeNull();
    expect(job.date).toBeNull();
  });
});

describe("mapDetail", () => {
  const RESULT = {
    id: "6ad0a38d879b500012fa234e",
    role: "Software Development Engineer in Test",
    slug: "software-development-engineer-in-test-10",
    publishedAt: "2026-10-15T09:57:33.396Z",
    status: "active",
    closed: false,
    location: { country: { name: "Indonesia" }, city: { name: "Jakarta Pusat" } },
    company: { name: "PT. Inovasi Anak Indonesia - PARKEE", slug: "pt-inovasi-anak-indonesia-parkee" },
    employmentTypes: ["contract"],
    workplaceType: "onSite",
    salaryType: "paid",
    salaryRange: { start: 7_000_000, end: 10_000_000 },
    description: null,
    responsibilities: "<p>Build tests.</p><ul><li>Review specs</li></ul>",
    requirements: "<p>Must know Selenium &amp; Postman.</p>",
    perks: [],
    externalPlatformApplyUrl: null,
  };

  test("maps detail metadata and joins the rich-text sections", () => {
    const job = mapDetail(RESULT);
    expect(job.id).toBe("6ad0a38d879b500012fa234e");
    expect(job.employmentType).toBe("contract");
    expect(job.workplaceType).toBe("onSite");
    expect(job.isActive).toBe(true);
    expect(job.description).toContain("Responsibilities:");
    expect(job.description).toContain("- Review specs");
    expect(job.description).toContain("Requirements:");
    expect(job.description).toContain("Selenium & Postman");
  });

  test("formats the IDR salary range", () => {
    expect(mapDetail(RESULT).salary).toContain("IDR");
  });

  test("marks a closed posting inactive", () => {
    expect(mapDetail({ ...RESULT, closed: true }).isActive).toBe(false);
    expect(mapDetail({ ...RESULT, status: "closed" }).isActive).toBe(false);
  });

  test("falls back to the job URL when no external apply URL exists", () => {
    expect(mapDetail(RESULT).applyUrl).toBe(
      "https://dealls.com/loker/software-development-engineer-in-test-10~pt-inovasi-anak-indonesia-parkee",
    );
  });
});

describe("htmlToText", () => {
  test("preserves paragraphs and bullet lists", () => {
    expect(htmlToText("<p>Hello</p><ul><li>One</li><li>Two</li></ul>")).toBe("Hello\n\n- One\n- Two");
  });

  test("decodes HTML entities", () => {
    expect(htmlToText("<p>A &amp; B &lt;C&gt; &#39;D&#39;</p>")).toBe("A & B <C> 'D'");
  });

  test("returns null for empty or non-string input", () => {
    expect(htmlToText("")).toBeNull();
    expect(htmlToText(null)).toBeNull();
    expect(htmlToText(undefined)).toBeNull();
    expect(htmlToText("<p><br></p>")).toBeNull();
  });
});

describe("normalizeDetailTarget", () => {
  test("accepts a bare 24-char id", () => {
    expect(normalizeDetailTarget("6ad0a38d879b500012fa234e")).toEqual({
      kind: "id",
      value: "6ad0a38d879b500012fa234e",
    });
  });

  test("extracts the primary slug from a /loker/ URL", () => {
    expect(
      normalizeDetailTarget("https://dealls.com/loker/backend-engineer-7~jakmallcom"),
    ).toEqual({ kind: "slug", value: "backend-engineer-7" });
  });

  test("accepts a bare slug", () => {
    expect(normalizeDetailTarget("backend-engineer-7")).toEqual({
      kind: "slug",
      value: "backend-engineer-7",
    });
  });

  test("rejects garbage", () => {
    expect(normalizeDetailTarget("!!!")).toBeNull();
  });
});

describe("withinDays", () => {
  const now = Date.parse("2026-10-17T00:00:00.000Z");

  test("includes a posting inside the window", () => {
    expect(withinDays("2026-10-15T00:00:00.000Z", 7, now)).toBe(true);
  });

  test("excludes a posting outside the window", () => {
    expect(withinDays("2026-09-01T00:00:00.000Z", 7, now)).toBe(false);
  });

  test("treats a missing or unparseable date as outside the window", () => {
    expect(withinDays(null, 7, now)).toBe(false);
    expect(withinDays("not-a-date", 7, now)).toBe(false);
  });
});
