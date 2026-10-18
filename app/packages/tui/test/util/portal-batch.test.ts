import { describe, expect, test } from "bun:test"
import {
  PORTAL_BATCH_MAX,
  PORTAL_SESSIONS_KEEP,
  PORTAL_SESSIONS_KEY,
  parsePortalUrls,
  portalUrlCount,
  readPortalSessions,
  rememberPortalSessions,
} from "../../src/util/portal-batch"

function fakeKV(initial?: unknown) {
  const store: Record<string, unknown> = {}
  if (initial !== undefined) store[PORTAL_SESSIONS_KEY] = initial
  return {
    store,
    get: (key: string, defaultValue?: unknown) => store[key] ?? defaultValue,
    set: (key: string, value: unknown) => {
      store[key] = value
    },
  }
}

describe("parsePortalUrls", () => {
  test("adds https:// to a bare host", () => {
    expect(parsePortalUrls("example.com")).toEqual(["https://example.com"])
  })

  test("leaves an explicit http:// alone", () => {
    expect(parsePortalUrls("http://example.com")).toEqual(["http://example.com"])
  })

  test("splits on spaces, commas, and new lines, keeping order", () => {
    expect(parsePortalUrls("a.example, b.example c.example\nd.example")).toEqual([
      "https://a.example",
      "https://b.example",
      "https://c.example",
      "https://d.example",
    ])
  })

  test("drops duplicates regardless of scheme", () => {
    expect(parsePortalUrls("example.com https://example.com www.example.com/")).toEqual([
      "https://example.com",
      "https://www.example.com/",
    ])
  })

  test("caps at PORTAL_BATCH_MAX", () => {
    const six = Array.from({ length: 6 }, (_, index) => `example.com/${index + 1}`).join(" ")
    expect(parsePortalUrls(six)).toHaveLength(PORTAL_BATCH_MAX)
  })

  test("an empty or whitespace-only input holds nothing", () => {
    expect(parsePortalUrls("")).toEqual([])
    expect(parsePortalUrls("  \n\t ")).toEqual([])
  })
})

describe("portalUrlCount", () => {
  test("counts past the cap", () => {
    const six = Array.from({ length: 6 }, (_, index) => `example.com/${index + 1}`).join(" ")
    expect(portalUrlCount(six)).toBe(6)
    expect(parsePortalUrls(six)).toHaveLength(PORTAL_BATCH_MAX)
  })

  test("counts unique urls only", () => {
    expect(portalUrlCount("example.com https://example.com")).toBe(1)
  })
})

describe("portal session list", () => {
  test("reads an empty list from an empty store", () => {
    expect(readPortalSessions(fakeKV())).toEqual([])
  })

  test("ignores a stored value that is not a list of ids", () => {
    expect(readPortalSessions(fakeKV("nope"))).toEqual([])
    expect(readPortalSessions(fakeKV(["a", 3, "b"]))).toEqual(["a", "b"])
  })

  test("appends ids and keeps only the last PORTAL_SESSIONS_KEEP", () => {
    const kv = fakeKV()
    rememberPortalSessions(kv, ["a", "b"])
    rememberPortalSessions(kv, ["c"])
    expect(readPortalSessions(kv)).toEqual(["a", "b", "c"])
    rememberPortalSessions(
      kv,
      Array.from({ length: PORTAL_SESSIONS_KEEP + 5 }, (_, index) => `s${index}`),
    )
    const kept = readPortalSessions(kv)
    expect(kept).toHaveLength(PORTAL_SESSIONS_KEEP)
    expect(kept.at(-1)).toBe(`s${PORTAL_SESSIONS_KEEP + 4}`)
  })

  test("writing nothing leaves the store untouched", () => {
    const kv = fakeKV(["a"])
    rememberPortalSessions(kv, [])
    expect(readPortalSessions(kv)).toEqual(["a"])
  })
})
