import { openjobAscii } from "../logo"

const reset = "\x1b[0m"
const bold = "\x1b[1m"
const dim = "\x1b[90m"

function wordmark(pad = "") {
  return openjobAscii.map((line) => `${pad}${line}`)
}

/** Logo-only banner, shown when OpenJob exits outside a session. */
export function brandEpilogue() {
  return [...wordmark("  "), ""].join("\n")
}

export function sessionEpilogue(input: { title: string; sessionID?: string }) {
  const weak = (text: string) => `${dim}${text.padEnd(10, " ")}${reset}`
  return [
    ...wordmark("  "),
    "",
    `  ${weak("Session")}${bold}${input.title}${reset}`,
    `  ${weak("Continue")}${bold}openjob -s ${input.sessionID}${reset}`,
    "",
  ].join("\n")
}
