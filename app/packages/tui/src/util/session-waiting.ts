// Whether the session view should show an optimistic "Thinking" indicator.
//
// The server only emits a reasoning part once the provider returns its first
// reasoning delta, which can take a second or two on a cold request. Until then
// the session looks idle even though a turn is running. This predicate lets the
// UI show progress from the moment the session reports busy, and hide it as soon
// as any part renders its own state (reasoning text, assistant text, or a tool).

export type WaitingStatus = { type: string } | undefined
export type WaitingMessage = { role: string; time?: { completed?: number; [key: string]: unknown } }
export type WaitingPart = { type: string; text?: string; metadata?: unknown }

export function isWaitingForOutput(
  status: WaitingStatus,
  last: WaitingMessage | undefined,
  parts: readonly WaitingPart[],
): boolean {
  if (!status || status.type === "idle") return false
  if (!last) return false
  if (last.role === "user") return true
  const active = parts.some(
    (part) =>
      (part.type === "reasoning" && ((part.text ?? "").trim().length > 0 || part.metadata !== undefined)) ||
      (part.type === "text" && (part.text ?? "").trim().length > 0) ||
      part.type === "tool",
  )
  return !active && !last.time?.completed
}
