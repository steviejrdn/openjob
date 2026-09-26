import { Config } from "effect"
import os from "os"
import path from "path"

const trustedTest = process.env["OPENJOB_TRUSTED_TEST_PID"] === String(process.pid)

function consumeRuntimeDirArgument() {
  const args = process.argv
  const index = args.findIndex((arg) => arg === "--runtime-dir" || arg.startsWith("--runtime-dir="))
  if (index === -1) return

  const argument = args[index]
  const value = argument === "--runtime-dir" ? args[index + 1] : argument.slice("--runtime-dir=".length)
  if (!value || (argument === "--runtime-dir" && value.startsWith("-"))) return

  process.env.OPENJOB_RUNTIME_DIR = value
  args.splice(index, argument === "--runtime-dir" ? 2 : 1)
}

// These variables are OpenCode's process-global escape hatches. They are not
// part of OpenJob's contract and, in particular, several of them can redirect
// reads or writes outside the OpenJob runtime. Remove every inherited
// OPENCODE_* value before any module that consumes process.env is initialized.
// The PID-bound exception is only for the test preload. A child process cannot
// inherit the exception accidentally because its PID is different.
if (!trustedTest) {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("OPENCODE_")) delete process.env[key]
  }
}

// The CLI entrypoint builds yargs after importing its command modules. Consume
// this global option during module initialization so the existing command
// architecture can support it without letting yargs route it to a command.
consumeRuntimeDirArgument()

const runtime = path.resolve(
  process.env["OPENJOB_RUNTIME_DIR"] ?? path.join(os.homedir(), ".local", "share", "openjob"),
)
process.env["OPENJOB_RUNTIME_DIR"] = runtime
process.env["HOME"] = path.join(runtime, "home")
process.env["XDG_CONFIG_HOME"] = path.join(runtime, "config")
process.env["XDG_DATA_HOME"] = path.join(runtime, "data")
process.env["XDG_STATE_HOME"] = path.join(runtime, "state")
process.env["XDG_CACHE_HOME"] = path.join(runtime, "cache")

export function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

const copy = process.env["OPENCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]
const fff = process.env["OPENCODE_DISABLE_FFF"]

function enabledByExperimental(key: string) {
  return process.env[key] === undefined ? truthy("OPENCODE_EXPERIMENTAL") : truthy(key)
}

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
  OTEL_EXPORTER_OTLP_HEADERS: process.env["OTEL_EXPORTER_OTLP_HEADERS"],

  OPENCODE_AUTO_HEAP_SNAPSHOT: truthy("OPENCODE_AUTO_HEAP_SNAPSHOT"),
  OPENCODE_GIT_BASH_PATH: process.env["OPENCODE_GIT_BASH_PATH"],
  OPENCODE_CONFIG: process.env["OPENCODE_CONFIG"],
  OPENCODE_CONFIG_CONTENT: process.env["OPENCODE_CONFIG_CONTENT"],
  OPENCODE_DISABLE_AUTOUPDATE: trustedTest ? truthy("OPENCODE_DISABLE_AUTOUPDATE") : true,
  OPENCODE_ALWAYS_NOTIFY_UPDATE: truthy("OPENCODE_ALWAYS_NOTIFY_UPDATE"),
  OPENCODE_DISABLE_PRUNE: truthy("OPENCODE_DISABLE_PRUNE"),
  OPENCODE_DISABLE_TERMINAL_TITLE: truthy("OPENCODE_DISABLE_TERMINAL_TITLE"),
  OPENCODE_SHOW_TTFD: truthy("OPENCODE_SHOW_TTFD"),
  OPENCODE_DISABLE_AUTOCOMPACT: truthy("OPENCODE_DISABLE_AUTOCOMPACT"),
  OPENCODE_DISABLE_MODELS_FETCH: truthy("OPENCODE_DISABLE_MODELS_FETCH"),
  OPENCODE_DISABLE_MOUSE: truthy("OPENCODE_DISABLE_MOUSE"),
  OPENCODE_FAKE_VCS: process.env["OPENCODE_FAKE_VCS"],
  OPENCODE_SERVER_PASSWORD: process.env["OPENCODE_SERVER_PASSWORD"],
  OPENCODE_SERVER_USERNAME: process.env["OPENCODE_SERVER_USERNAME"],
  OPENCODE_DISABLE_FFF: fff === undefined ? process.platform === "win32" : truthy("OPENCODE_DISABLE_FFF"),

  // Experimental
  OPENCODE_EXPERIMENTAL_FILEWATCHER: Config.boolean("OPENCODE_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  OPENCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthy("OPENCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),
  OPENCODE_MODELS_URL: process.env["OPENCODE_MODELS_URL"],
  OPENCODE_MODELS_PATH: process.env["OPENCODE_MODELS_PATH"],
  OPENCODE_DB: process.env["OPENCODE_DB"],

  OPENCODE_WORKSPACE_ID: process.env["OPENCODE_WORKSPACE_ID"],
  OPENCODE_EXPERIMENTAL_WORKSPACES: enabledByExperimental("OPENCODE_EXPERIMENTAL_WORKSPACES"),

  // Evaluated at access time (not module load) because tests, the CLI, and
  // external tooling set these env vars at runtime. Inherited OPENCODE_*
  // values were already stripped above; anything visible here was set
  // deliberately after startup.
  get OPENCODE_DISABLE_PROJECT_CONFIG() {
    // OpenJob is a workspace-first tool: project-level `openjob.json` and
    // `.openjob/` directories stay discoverable unless explicitly disabled.
    if (process.env["OPENCODE_DISABLE_PROJECT_CONFIG"] === undefined) return false
    return truthy("OPENCODE_DISABLE_PROJECT_CONFIG")
  },
  get OPENCODE_EXPERIMENTAL_REFERENCES() {
    return enabledByExperimental("OPENCODE_EXPERIMENTAL_REFERENCES")
  },
  get OPENCODE_TUI_CONFIG(): string | undefined {
    return process.env["OPENCODE_TUI_CONFIG"]
  },
  get OPENCODE_CONFIG_DIR(): string | undefined {
    return process.env["OPENCODE_CONFIG_DIR"]
  },
  get OPENJOB_RUNTIME_DIR() {
    const value = process.env["OPENJOB_RUNTIME_DIR"]
    return value ? path.resolve(value) : undefined
  },
  get OPENCODE_PURE() {
    // Self-contained by default: external TUI plugins stay off unless a test
    // or embedder opts in explicitly after startup.
    if (process.env["OPENCODE_PURE"] === undefined) return true
    return truthy("OPENCODE_PURE")
  },
  get OPENCODE_PERMISSION(): string | undefined {
    return process.env["OPENCODE_PERMISSION"]
  },
  get OPENCODE_PLUGIN_META_FILE(): string | undefined {
    return process.env["OPENCODE_PLUGIN_META_FILE"]
  },
  get OPENJOB_TRUSTED_TEST() {
    return trustedTest
  },
  get OPENCODE_CLIENT() {
    return process.env["OPENCODE_CLIENT"] ?? "cli"
  },
}
