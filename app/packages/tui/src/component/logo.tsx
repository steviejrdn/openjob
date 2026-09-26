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
    <box alignItems="flex-start" aria-label="OpenJob">
      <box flexDirection="row" gap={2} alignItems="flex-end">
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
          v{OpenJobVersion}
        </text>
      </box>
    </box>
  )
}
