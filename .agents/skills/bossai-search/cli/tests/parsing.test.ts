import { describe, test, expect } from "bun:test";
import {
  parseSearchResponse,
  parseJobDetail,
  normalizeDate,
  htmlToText,
  normalizeText,
  formatLocation,
  jobUrl,
  type SearchResponse,
} from "../src/helpers";

const searchFixture = {
  code: 0,
  message: "Success",
  data: {
    page: 1,
    total_pages: 30,
    total_num: 433,
    jobs: [
      {
        id: 435434,
        job_title: "Software Developer",
        company_name: "PT Softorb Technology Indonesia",
        job_location: "Jakarta Selatan",
        job_region: "Jakarta",
        job_country: "Indonesia",
        job_url: "/job/software-engineer-jakarta-selatan-435434",
        job_type: "Full-time",
        work_arrangement: "On-site",
        xp_lvl: "1-3 Yrs Exp",
        salary_range_value: "Negotiable",
        published_at: "2026-01-30 11:31:53",
        published_at_date: "20260130",
        expired_at: "2026-10-27 11:31:53",
        status_key: "active",
      },
      {
        id: 499275,
        job_title: "Software Engineer",
        company_name: "WHR Global Consulting",
        job_location: "",
        job_region: "",
        job_country: "Philippines",
        job_url: "/job/lead-software-engineer-remote-499275",
        job_type: "Part-time",
        work_arrangement: "Remote",
        published_at_date: "20260511",
        expired_at: "2026-11-07 17:34:11",
        status_key: "active",
      },
    ],
  },
};

describe("parseSearchResponse", () => {
  test("maps the six contract fields plus extras", () => {
    const { count, page, results } = parseSearchResponse(searchFixture);
    expect(count).toBe(433);
    expect(page).toBe(1);
    expect(results).toHaveLength(2);
    const [first] = results;
    expect(first.id).toBe("435434");
    expect(first.title).toBe("Software Developer");
    expect(first.company).toBe("PT Softorb Technology Indonesia");
    expect(first.location).toBe("Jakarta Selatan, Jakarta");
    expect(first.date).toBe("2026-01-30");
    expect(first.url).toBe(
      "https://boss.id/id/job/software-engineer-jakarta-selatan-435434",
    );
    expect(first.employmentType).toBe("Full-time");
    expect(first.deadline).toBe("2026-10-27");
    expect(first.isActive).toBe(true);
  });

  test("uses 'Remote' for remote jobs with no city", () => {
    const { results } = parseSearchResponse(searchFixture);
    expect(results[1].location).toBe("Remote");
  });

  test("emits null (never omitted) for missing fields", () => {
    const { results } = parseSearchResponse({
      data: { total_num: 1, jobs: [{ id: 1, job_title: "Bare Job" }] },
    });
    expect(results[0]).toMatchObject({
      company: null,
      location: null,
      date: null,
      url: null,
    });
  });

  test("skips entries with no id or no title", () => {
    const { results } = parseSearchResponse({
      data: { jobs: [{ job_title: "no id" }, { id: 2 }, { id: 3, job_title: "" }] },
    });
    expect(results).toHaveLength(0);
  });

  test("handles a malformed payload without throwing", () => {
    const parsed = parseSearchResponse(null) as SearchResponse;
    expect(parsed.results).toHaveLength(0);
    expect(parsed.count).toBe(0);
  });
});

describe("normalizeDate", () => {
  test("handles the API's three date shapes", () => {
    expect(normalizeDate("20260130")).toBe("2026-01-30");
    expect(normalizeDate("2026-01-30 11:31:53")).toBe("2026-01-30");
    expect(normalizeDate("30 Jan 2026")).toBe("2026-01-30");
  });

  test("returns null for empty input", () => {
    expect(normalizeDate("")).toBeNull();
    expect(normalizeDate(null)).toBeNull();
  });
});

describe("formatLocation", () => {
  test("joins city + region, dropping a duplicate region", () => {
    expect(formatLocation({ job_location: "Bandung", job_region: "West Java" })).toBe(
      "Bandung, West Java",
    );
    expect(formatLocation({ job_location: "Jakarta", job_region: "Jakarta" })).toBe("Jakarta");
    expect(formatLocation({ job_region: "Bali" })).toBe("Bali");
    expect(formatLocation({})).toBeNull();
  });
});

describe("jobUrl", () => {
  test("builds a canonical boss.id URL", () => {
    expect(jobUrl("/job/software-engineer-jakarta-selatan-435434")).toBe(
      "https://boss.id/id/job/software-engineer-jakarta-selatan-435434",
    );
    expect(jobUrl("https://example.com/x")).toBe("https://example.com/x");
    expect(jobUrl(null)).toBeNull();
  });
});

describe("htmlToText / normalizeText", () => {
  test("strips tags, decodes entities, preserves breaks", () => {
    const html = "<p>Membuat &amp; meninjau <strong>P&amp;ID</strong></p><ul><li>Min. S1</li></ul>";
    const text = htmlToText(html);
    expect(text).toContain("Membuat & meninjau P&ID");
    expect(text).toContain("- Min. S1");
    expect(text).not.toContain("<");
  });

  test("normalizes a plain description blob", () => {
    expect(normalizeText("Line one\r\n\r\n\r\nLine two  \n")).toBe("Line one\n\nLine two");
    expect(normalizeText("")).toBeNull();
  });
});

describe("parseJobDetail", () => {
  const detailFixture = {
    id: 435434,
    job_title: "Software Developer",
    job_url: "/job/software-engineer-jakarta-selatan-435434",
    published_at: "30 Jan 2026",
    expired_at: "2026-10-27 11:31:53",
    salary_range_value: "Negotiable",
    job_type_value: "Full-time",
    status_key: "active",
    external_apply_url: null,
    job_description: "Plain description",
    job_description_html: "<p>Build &amp; review <em>P&amp;ID</em> documents.</p>",
    job_requirements_html: "<ul><li>Min. S1</li></ul>",
    skills: [{ name: "TypeScript" }, "SQL"],
    work_arrangement: { id: 1, name: "On-site" },
    xp_lvl: { id: 2, value: "1-3 Yrs Exp" },
    location: { id: 447, value: "Jakarta Selatan", region: "Jakarta" },
    company: { id: 164436, name: "PT Softorb Technology Indonesia" },
  };

  test("extracts the detail fields", () => {
    const job = parseJobDetail(detailFixture, "435434");
    expect(job.id).toBe("435434");
    expect(job.title).toBe("Software Developer");
    expect(job.company).toBe("PT Softorb Technology Indonesia");
    expect(job.location).toBe("Jakarta Selatan, Jakarta");
    expect(job.date).toBe("2026-01-30");
    expect(job.deadline).toBe("2026-10-27");
    expect(job.employmentType).toBe("Full-time");
    expect(job.workArrangement).toBe("On-site");
    expect(job.experience).toBe("1-3 Yrs Exp");
    expect(job.description).toContain("Build & review");
    expect(job.description).toContain("P&ID");
    expect(job.requirements).toContain("Min. S1");
    expect(job.skills).toEqual(["TypeScript", "SQL"]);
    expect(job.applyUrl).toBe(job.url);
    expect(job.isActive).toBe(true);
  });

  test("falls back to the plain description when HTML is empty", () => {
    const job = parseJobDetail(
      { id: 1, job_title: "T", job_description: "Only plain", job_description_html: "" },
      "1",
    );
    expect(job.description).toBe("Only plain");
  });
});
