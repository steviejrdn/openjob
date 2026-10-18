import { describe, test, expect } from "bun:test";
import {
  decodeHtmlEntities,
  htmlToText,
  normalizeId,
  parseDetail,
  parseHit,
  slugify,
  toIso,
} from "../src/helpers";

// Network-free unit tests for the parsing helpers. The live path is covered by
// live-smoke.test.ts; these lock down shape/edge-case behaviour of the parsers
// using response fragments captured from the real endpoints.

describe("htmlToText", () => {
  test("decodes entities, bullets list items and preserves paragraphs", () => {
    const html =
      "<ol><li>Membersihkan &amp; mengolah raw material.</li><li>Sehat jasmani</li></ol><p>Kirim ke <b>HRD</b></p>";
    const text = htmlToText(html);
    expect(text).toContain("- Membersihkan & mengolah raw material.");
    expect(text).toContain("- Sehat jasmani");
    expect(text).toContain("Kirim ke HRD");
    expect(text).not.toContain("<");
  });

  test("returns null for empty or non-string input", () => {
    expect(htmlToText(null)).toBeNull();
    expect(htmlToText("")).toBeNull();
    expect(htmlToText("   ")).toBeNull();
  });
});

describe("decodeHtmlEntities", () => {
  test("handles named, decimal and hex references", () => {
    expect(decodeHtmlEntities("A &amp; B &#39;x&#x27;")).toBe("A & B 'x'");
  });
});

describe("toIso", () => {
  test("converts unix seconds and passes ISO strings through", () => {
    expect(toIso(1792203032)).toBe("2026-10-17T02:10:32.000Z");
    expect(toIso("2026-09-19")).toBe("2026-09-19T00:00:00.000Z");
    expect(toIso(null)).toBeNull();
  });
});

describe("slugify / normalizeId", () => {
  test("slugs titles and extracts UUIDs from bare ids or URLs", () => {
    expect(slugify("Sales Marketing Manager")).toBe("sales-marketing-manager");
    const uuid = "63f1eed6-b93b-4967-8bc4-28cd69899ef0";
    expect(normalizeId(uuid)).toBe(uuid);
    expect(
      normalizeId(`https://karirhub.kemnaker.go.id/lowongan-dalam-negeri/lowongan/operator-produksi-${uuid}`),
    ).toBe(uuid);
    expect(normalizeId("not-a-real-id")).toBeNull();
  });
});

describe("parseHit", () => {
  test("normalizes an Algolia search hit into the card shape", () => {
    const card = parseHit({
      id: "01a147a0-0784-7142-ba4f-dfa7678733a9",
      title: "Sales Marketing Manager",
      company_name: "GRAND MASTER",
      city_name: "Kota Surabaya",
      published_at: 1792203032,
      job_type_name: "Part time",
      platform_type: "external",
      platform_link: "https://toploker.com/x",
    });
    expect(card.id).toBe("01a147a0-0784-7142-ba4f-dfa7678733a9");
    expect(card.company).toBe("GRAND MASTER");
    expect(card.location).toBe("Kota Surabaya");
    expect(card.date).toBe("2026-10-17T02:10:32.000Z");
    expect(card.jobType).toBe("Part time");
    expect(card.url).toContain("/lowongan-dalam-negeri/lowongan/sales-marketing-manager-");
  });

  test("keeps missing fields null rather than omitting them", () => {
    const card = parseHit({ id: "abc", title: "T" });
    expect(card.company).toBeNull();
    expect(card.location).toBeNull();
    expect(card.date).toBeNull();
  });
});

describe("parseDetail", () => {
  test("extracts description, qualification, employer, region and salary", () => {
    const job = parseDetail({
      id: "63f1eed6-b93b-4967-8bc4-28cd69899ef0",
      title: "OPERATOR PRODUKSI",
      published_at: "2026-09-19",
      expires_at: "2026-12-19",
      description: "<ol><li>Membersihkan raw material</li></ol>",
      qualification: "<p>Sehat jasmani</p>",
      show_salary: true,
      min_salary_currency: "IDR",
      min_salary_amount: 5938885,
      max_salary_currency: "IDR",
      max_salary_amount: 6000000,
      total_applicants: 14861,
      employer: { name: "PT. Pahala Bahari Nusantara", employerable: { industry: { name: "Food & Beverage" } } },
      region: { name: "Pasirsari, Cikarang Selatan, Kab. Bekasi, Jawa Barat" },
      job_type: { name: "Full time" },
      job_function: { name: "Manufaktur dan Produksi" },
    });
    expect(job.company).toBe("PT. Pahala Bahari Nusantara");
    expect(job.location).toContain("Bekasi");
    expect(job.description).toContain("- Membersihkan raw material");
    expect(job.qualification).toBe("Sehat jasmani");
    expect(job.employmentType).toBe("Full time");
    expect(job.jobFunction).toBe("Manufaktur dan Produksi");
    expect(job.industry).toBe("Food & Beverage");
    expect(job.salary).toContain("5.938.885");
    expect(job.applicants).toBe(14861);
  });

  test("hides salary when show_salary is false", () => {
    const job = parseDetail({ id: "x", title: "T", show_salary: false, min_salary_amount: 100, max_salary_amount: 200 });
    expect(job.salary).toBeNull();
  });
});
