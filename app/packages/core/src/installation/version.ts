declare global {
  const OPENCODE_VERSION: string
  const OPENCODE_CHANNEL: string
  const OPENJOB_VERSION: string
}

export const InstallationVersion = typeof OPENCODE_VERSION === "string" ? OPENCODE_VERSION : "local"
export const InstallationChannel = typeof OPENCODE_CHANNEL === "string" ? OPENCODE_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"

/** User-facing OpenJob release version (injected by the build, e.g. "0.1.8"). */
export const OpenJobVersion =
  (typeof OPENJOB_VERSION === "string" ? OPENJOB_VERSION : undefined) ?? process.env["OPENJOB_VERSION"] ?? "dev"

/** A development build: a source checkout ("dev") or a tree past its tag (`<version>+dev`). */
export function isDevVersion(version: string) {
  return version === "dev" || version.endsWith("+dev")
}

/**
 * Development builds do not run the release update check at all; only released
 * binaries compare their version against the latest release.
 */
export const OpenJobIsDev = isDevVersion(OpenJobVersion)
