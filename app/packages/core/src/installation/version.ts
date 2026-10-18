declare global {
  const OPENCODE_VERSION: string
  const OPENCODE_CHANNEL: string
  const OPENJOB_VERSION: string
}

export const InstallationVersion = typeof OPENCODE_VERSION === "string" ? OPENCODE_VERSION : "local"
export const InstallationChannel = typeof OPENCODE_CHANNEL === "string" ? OPENCODE_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"

/** User-facing OpenJob release version (injected by the build or supplied by the source launcher). */
const BuiltOpenJobVersion = typeof OPENJOB_VERSION === "string" ? OPENJOB_VERSION : undefined
export const OpenJobVersion = BuiltOpenJobVersion ?? process.env["OPENJOB_VERSION"] ?? "dev"

/** Shared display label for the logo and TUI footer. */
export function formatOpenJobVersion(version: string) {
  return version === "dev" ? "dev" : `v${version}`
}

export const OpenJobVersionLabel = formatOpenJobVersion(OpenJobVersion)

/** Only release binaries check for newer releases; source and preview builds do not. */
export const OpenJobIsDev = !BuiltOpenJobVersion || InstallationChannel !== "latest" || isDevVersion(OpenJobVersion)

/** A development build: a source checkout (`dev`) or a tree past its tag (`<version>+dev`). */
export function isDevVersion(version: string) {
  return version === "dev" || version.endsWith("+dev")
}
