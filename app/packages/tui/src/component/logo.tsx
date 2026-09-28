import { TextAttributes } from "@opentui/core"
import { For, Show } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "../context/theme"
import { openjobAscii } from "../logo"
import { OpenJobVersion } from "@opencode-ai/core/installation/version"

export function Logo() {
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()
  const wideEnough = () => dimensions().width >= 46

  return (
    <box alignItems="center" aria-label="OpenJob">
      <Show
        when={wideEnough()}
        fallback={
          <text fg={theme.text} attributes={TextAttributes.BOLD} selectable={false}>
            OPENJOB
          </text>
        }
      >
        <box>
          <For each={openjobAscii}>
            {(line) => (
              <text fg={theme.text} selectable={false} wrapMode="none">
                {line}
              </text>
            )}
          </For>
        </box>
      </Show>
      <text fg={theme.textMuted} selectable={false}>
        {OpenJobVersion === "dev" ? "dev" : `v${OpenJobVersion}`}
      </text>
    </box>
  )
}
