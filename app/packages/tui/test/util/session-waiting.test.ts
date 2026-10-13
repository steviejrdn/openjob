import { describe, expect, test } from "bun:test"
import { isWaitingForOutput } from "../../src/util/session-waiting"

const busy = { type: "busy" }
const assistant = { role: "assistant", time: {} as { completed?: number } }
const user = { role: "user" }

describe("isWaitingForOutput", () => {
  test("is false while idle or without a status", () => {
    expect(isWaitingForOutput({ type: "idle" }, user, [])).toBe(false)
    expect(isWaitingForOutput(undefined, user, [])).toBe(false)
  })

  test("is false when there is no message yet", () => {
    expect(isWaitingForOutput(busy, undefined, [])).toBe(false)
  })

  test("is true while the last message is still the user's", () => {
    expect(isWaitingForOutput(busy, user, [])).toBe(true)
  })

  test("is true for a busy assistant message with no visible parts", () => {
    expect(isWaitingForOutput(busy, assistant, [])).toBe(true)
    expect(isWaitingForOutput(busy, assistant, [{ type: "reasoning", text: "  " }])).toBe(true)
  })

  test("is false once reasoning, text, or a tool renders", () => {
    expect(isWaitingForOutput(busy, assistant, [{ type: "reasoning", text: "hmm" }])).toBe(false)
    expect(isWaitingForOutput(busy, assistant, [{ type: "reasoning", metadata: {} }])).toBe(false)
    expect(isWaitingForOutput(busy, assistant, [{ type: "text", text: "hello" }])).toBe(false)
    expect(isWaitingForOutput(busy, assistant, [{ type: "tool" }])).toBe(false)
  })

  test("is false once the assistant message completed", () => {
    expect(isWaitingForOutput(busy, { role: "assistant", time: { completed: 1 } }, [])).toBe(false)
  })
})
