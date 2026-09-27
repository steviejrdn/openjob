import { describe, expect, test } from "bun:test"
import { resolveUpdateAvailability } from "../../src/installation/openjob-update"
import { isDevVersion } from "../../src/installation/version"

describe("openjob update availability", () => {
  test("only a newer release is announced", () => {
    expect(resolveUpdateAvailability("0.1.9", "0.1.8")).toBe(true)
    expect(resolveUpdateAvailability("0.1.9", "0.1.9")).toBe(false)
    expect(resolveUpdateAvailability("0.1.8", "0.1.9")).toBe(false)
  })

  test("missing or invalid latest never announces", () => {
    expect(resolveUpdateAvailability(undefined, "0.1.8")).toBe(false)
    expect(resolveUpdateAvailability("not-a-version", "0.1.8")).toBe(false)
    expect(resolveUpdateAvailability("latest", "0.1.8")).toBe(false)
  })
})

describe("dev version detection", () => {
  test("source checkouts and trees past their tag are dev", () => {
    expect(isDevVersion("dev")).toBe(true)
    expect(isDevVersion("0.1.9+dev")).toBe(true)
  })

  test("release versions are not dev", () => {
    expect(isDevVersion("0.1.9")).toBe(false)
    expect(isDevVersion("0.1.8")).toBe(false)
  })
})
