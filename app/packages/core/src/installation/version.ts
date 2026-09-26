declare global {
  const OPENCODE_VERSION: string
  const OPENCODE_CHANNEL: string
  const OPENJOB_VERSION: string
}

export const InstallationVersion = typeof OPENCODE_VERSION === "string" ? OPENCODE_VERSION : "local"
export const InstallationChannel = typeof OPENCODE_CHANNEL === "string" ? OPENCODE_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"

/** User-facing OpenJob release version (injected by the build, e.g. "0.1.0"). */
export const OpenJobVersion = typeof OPENJOB_VERSION === "string" ? OPENJOB_VERSION : "dev"
