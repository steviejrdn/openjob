import { describe, test, expect } from "bun:test";
import {
  parseSearchResponse,
  parseDetailHtml,
  formatLocation,
  htmlToText,
  jobUrl,
  shortDate,
  extractNextData,
  type SearchResponse,
} from "../src/helpers";

const searchFixture = {
  count: 517,
  search_text: "data analyst",
  jobs: [
    {
      id: 274263,
      name: "Instrumen Engineering",
      company_name: "PT Patria Menara Abadi",
      slug: "instrumen-engineering",
      tenure: "Full time",
      function: "Oil and Gas Industry",
      is_work_from_home: false,
      activation_date: "2026-10-16T07:55:03.701618+00:00",
      application_end_date: "2026-11-07T17:00:00+00:00",
      company: { code: "pt-patria-menara-abadi", name: "PT Patria Menara Abadi" },
      google_location: {
        address_components: { city: "South Jakarta", region: "DKI Jakarta", country: "Indonesia" },
      },
    },
    {
      id: 273965,
      name: "Paid Marketing Executive",
      company_name: "Mamikos",
      slug: "paid-marketing-executive-3",
      is_work_from_home: true,
      activation_date: "2026-10-15T00:00:00+00:00",
      company: { code: "pt-git-gow-ayo", name: "Mamikos" },
      google_location: { address_components: { city: "Jakarta" } },
    },
  ],
};

describe("parseSearchResponse", () => {
  test("maps the six contract fields", () => {
    const { count, results } = parseSearchResponse(searchFixture);
    expect(count).toBe(517);
    expect(results).toHaveLength(2);
    const [first] = results;
    expect(first.id).toBe("274263");
    expect(first.title).toBe("Instrumen Engineering");
    expect(first.company).toBe("PT Patria Menara Abadi");
    expect(first.location).toBe("South Jakarta, DKI Jakarta");
    expect(first.date).toBe("2026-10-16");
    expect(first.url).toBe(
      "https://www.kalibrr.id/id-ID/c/pt-patria-menara-abadi/jobs/274263/instrumen-engineering",
    );
  });

  test("emits null (never omitted) for missing company/location/date", () => {
    const { results } = parseSearchResponse({
      count: 1,
      jobs: [{ id: 1, name: "Bare Job" }],
    });
    expect(results[0]).toMatchObject({
      company: null,
      location: null,
      date: null,
      deadline: null,
    });
  });

  test("skips entries with no id or no title", () => {
    const { results } = parseSearchResponse({
      jobs: [{ name: "no id" }, { id: 2 }, { id: 3, name: "" }],
    });
    expect(results).toHaveLength(0);
  });

  test("handles a malformed payload without throwing", () => {
    const parsed = parseSearchResponse(null) as SearchResponse;
    expect(parsed.results).toHaveLength(0);
    expect(parsed.count).toBe(0);
  });
});

describe("formatLocation", () => {
  test("prefers city + region, falls back to country", () => {
    expect(
      formatLocation({ address_components: { city: "Bandung", region: "West Java" } }),
    ).toBe("Bandung, West Java");
    expect(
      formatLocation({ address_components: { country: "Indonesia" } }),
    ).toBe("Indonesia");
    expect(formatLocation(null)).toBeNull();
  });

  test("accepts the detail page's camelCase shape", () => {
    expect(
      formatLocation({ addressComponents: { city: "South Jakarta", region: "DKI Jakarta" } }),
    ).toBe("South Jakarta, DKI Jakarta");
  });
});

describe("htmlToText", () => {
  test("strips tags, decodes entities, preserves breaks", () => {
    const html = "<ul><li>Membuat &amp; meninjau dokumen</li><li>Review P&amp;ID</li></ul>";
    const text = htmlToText(html);
    expect(text).toContain("Membuat & meninjau dokumen");
    expect(text).toContain("Review P&ID");
    expect(text).not.toContain("<");
  });

  test("decodes numeric and hex entities", () => {
    expect(htmlToText("<p>Caf&#233; &#x2013; Lead</p>")).toBe("Café – Lead");
  });

  test("returns null for empty input", () => {
    expect(htmlToText("")).toBeNull();
    expect(htmlToText(null)).toBeNull();
  });
});

describe("jobUrl", () => {
  test("builds a canonical URL and falls back when code is missing", () => {
    expect(jobUrl("9", "acme", "engineer")).toBe(
      "https://www.kalibrr.id/id-ID/c/acme/jobs/9/engineer",
    );
    expect(jobUrl("9", null, null)).toBe("https://www.kalibrr.id/id-ID/c/x/jobs/9");
  });
});

describe("shortDate", () => {
  test("keeps the calendar day only", () => {
    expect(shortDate("2026-10-16T07:55:03+00:00")).toBe("2026-10-16");
    expect(shortDate(null)).toBeNull();
  });
});

const detailFixture = `
<html><body>
<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
  props: {
    pageProps: {
      isExpired: false,
      job: {
        id: 274263,
        name: "Instrumen Engineering",
        slug: "instrumen-engineering",
        active: true,
        tenure: "Full time",
        function: "Oil and Gas Industry",
        activationDate: "2026-10-16T07:55:03+00:00",
        applicationEndDate: "2026-11-07T17:00:00+00:00",
        applyRedirectUrl: null,
        description: "<p>Build &amp; review <em>P&amp;ID</em> documents.</p>",
        qualifications: "<ul><li>Min. S1</li></ul>",
        company: { code: "pt-patria-menara-abadi", name: "PT Patria Menara Abadi" },
        googleLocation: { addressComponents: { city: "South Jakarta", region: "DKI Jakarta" } },
      },
    },
  },
})}</script>
</body></html>`;

describe("parseDetailHtml", () => {
  test("extracts detail fields from __NEXT_DATA__", () => {
    const job = parseDetailHtml(detailFixture, "274263");
    expect(job.id).toBe("274263");
    expect(job.title).toBe("Instrumen Engineering");
    expect(job.company).toBe("PT Patria Menara Abadi");
    expect(job.location).toBe("South Jakarta, DKI Jakarta");
    expect(job.employmentType).toBe("Full time");
    expect(job.deadline).toBe("2026-11-07");
    expect(job.description).toContain("Build & review");
    expect(job.description).toContain("P&ID");
    expect(job.qualifications).toContain("Min. S1");
    expect(job.isActive).toBe(true);
  });

  test("marks an expired posting inactive", () => {
    const expired = detailFixture.replace('"isExpired":false', '"isExpired":true');
    expect(parseDetailHtml(expired, "274263").isActive).toBe(false);
  });

  test("throws a clear error when __NEXT_DATA__ is absent", () => {
    expect(() => parseDetailHtml("<html></html>", "1")).toThrow(/__NEXT_DATA__/);
  });
});

describe("extractNextData", () => {
  test("returns null on missing or invalid JSON", () => {
    expect(extractNextData("<html></html>")).toBeNull();
    expect(
      extractNextData('<script id="__NEXT_DATA__" type="application/json">{oops</script>'),
    ).toBeNull();
  });
});
