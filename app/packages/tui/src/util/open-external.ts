import { realUserEnv } from "@opencode-ai/core/installation/real-env"

export { realUserEnv }

/** Opens a file or directory with the platform's default handler. */
export function openExternal(target: string) {
  const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open"
  return Bun.spawn([opener, target], { env: realUserEnv(), stdio: ["ignore", "ignore", "ignore"] })
}
