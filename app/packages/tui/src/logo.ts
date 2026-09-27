// OpenJob wordmark, drawn in the same 4-row block style the renderer already
// understands. The home screen shows `openjobAscii` on wide terminals and the
// compact fallback below it otherwise.
export const openjobAscii = [
  "▄▄▄▄ ▄▄▄▄ ▄▄▄▄ ▄▄▄  ▄▄▄▄ ▄▄▄▄ █▄▄▄",
  "█  █ █  █ █▄▄█ █  █    █ █  █ █  █",
  "█▄▄█ █▄▄█ █▄▄▄ █  █ ▄  █ █▄▄█ █▄▄█",
  "     ▀               ▀▀           ",
] as const

// Compact rail mark (OJB) for narrow terminals and future sidebars.
export const openjobMark = [
  "▄▄▄▄ ▄▄▄▄ ▄▄▄▄",
  "█  █    █ █▀▀▄",
  "▀▀▀▀ ▀▀▀▀ ▀▀▀▀",
] as const

// Retained for the animated background pulse (`go` and `marks` are consumed by
// bg-pulse-render.ts). The legacy `logo` pair stays as a narrow fallback.
export const logo = {
  left: ["      ", "      ", "      ", "      "],
  right: ["       ", "OPENJOB", "       ", "       "],
}

export const go = {
  left: ["    ", "█▀▀▀", "█_^█", "▀▀▀▀"],
  right: ["    ", "█▀▀█", "█__█", "▀▀▀▀"],
}

export const marks = "_^~,"
