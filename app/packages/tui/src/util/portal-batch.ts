import type { KVStore } from "../context/kv"

/** Sessions started by the "Add job portal" palette command, in batch order. */
export const PORTAL_SESSIONS_KEY = "openjob.portal_sessions"
/** How many portals one paste may start. */
export const PORTAL_BATCH_MAX = 5
/** How many portal session ids the kv list keeps. */
export const PORTAL_SESSIONS_KEEP = 20

export function readPortalSessions(kv: KVStore): string[] {
  const value = kv.get(PORTAL_SESSIONS_KEY, [])
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []
}

export function rememberPortalSessions(kv: KVStore, ids: string[]) {
  if (!ids.length) return
  kv.set(PORTAL_SESSIONS_KEY, [...readPortalSessions(kv), ...ids].slice(-PORTAL_SESSIONS_KEEP))
}

function splitPortalUrls(input: string): string[] {
  const urls = input
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (/^https?:\/\//i.test(part) ? part : `https://${part}`))
  return [...new Set(urls)]
}

/** Unique, scheme-normalized URLs in the order given, capped at PORTAL_BATCH_MAX. */
export function parsePortalUrls(input: string): string[] {
  return splitPortalUrls(input).slice(0, PORTAL_BATCH_MAX)
}

/** How many unique URLs the input holds before the cap. */
export function portalUrlCount(input: string): number {
  return splitPortalUrls(input).length
}
