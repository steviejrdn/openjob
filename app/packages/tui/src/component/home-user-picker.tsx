import { createMemo, createSignal, For } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { listUsers } from "../util/users"
import { selectedForeground, useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { OPENCODE_BASE_MODE, useBindings } from "../keymap"
import { useUserActions } from "./use-user-actions"

/**
 * Inline host-mode launcher: a single panel with highlight-bar rows and an
 * "Add user…" row, styled like the command-palette dialog so it stays familiar.
 * Keyboard-driven; mouse hover moves the selection and a click activates it.
 */
export function HomeUserPicker() {
  const { theme } = useTheme()
  const dialog = useDialog()
  const dimensions = useTerminalDimensions()
  const { switchTo, addUser, root } = useUserActions()
  const [selected, setSelected] = createSignal(0)

  const users = createMemo(() => listUsers(root()))
  const rows = createMemo(() => users().length + 1) // users + "Add user…"

  // Wide enough for the panel title, capped to the terminal.
  const panelWidth = createMemo(() => Math.min(52, Math.max(42, dimensions().width - 6)))

  const move = (direction: number) => setSelected((index) => (index + direction + rows()) % rows())

  function select(index: number) {
    if (index >= users().length) {
      void addUser(() => setSelected(users().length))
      return
    }
    void switchTo(users()[index])
  }

  // Guarded while a dialog is open (command palette, add-user prompt) so the
  // picker does not steal Up/Down/Enter from it.
  useBindings(() => ({
    mode: OPENCODE_BASE_MODE,
    enabled: () => dialog.stack.length === 0,
    bindings: [
      { key: "up", desc: "Previous user", group: "Users", cmd: () => move(-1) },
      { key: "down", desc: "Next user", group: "Users", cmd: () => move(1) },
      { key: "return", desc: "Select user", group: "Users", cmd: () => select(selected()) },
    ],
  }))

  const addSelected = () => selected() === users().length

  return (
    <box flexDirection="column" alignItems="center">
      <box
        width={panelWidth()}
        border
        borderStyle="rounded"
        borderColor={theme.border}
        title=" Select a user or add a new user "
        titleColor={theme.textMuted}
        paddingLeft={1}
        paddingRight={1}
      >
        <For each={users()}>
          {(user, index) => {
            const active = () => index() === selected()
            return (
              <box
                flexDirection="row"
                backgroundColor={active() ? theme.primary : undefined}
                onMouseMove={() => setSelected(index())}
                onMouseUp={() => select(index())}
              >
                <text fg={active() ? selectedForeground(theme) : theme.textMuted}>{active() ? "❯ " : "  "}</text>
                <text fg={active() ? selectedForeground(theme) : theme.text}>{user.name}</text>
              </box>
            )
          }}
        </For>
        <box height={1} />
        <box
          flexDirection="row"
          backgroundColor={addSelected() ? theme.primary : undefined}
          onMouseMove={() => setSelected(users().length)}
          onMouseUp={() => select(users().length)}
        >
          <text fg={addSelected() ? selectedForeground(theme) : theme.textMuted}>{addSelected() ? "❯ " : "  "}</text>
          <text fg={addSelected() ? selectedForeground(theme) : theme.textMuted}>+ Add user…</text>
        </box>
      </box>
      <box flexDirection="row" gap={3} marginTop={1}>
        <text fg={theme.textMuted}>
          <span style={{ fg: theme.text }}>↑↓</span> navigate
        </text>
        <text fg={theme.textMuted}>
          <span style={{ fg: theme.text }}>ENTER</span> select
        </text>
        <text fg={theme.textMuted}>
          <span style={{ fg: theme.text }}>CTRL+P</span> commands
        </text>
      </box>
    </box>
  )
}
