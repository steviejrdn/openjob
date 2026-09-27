import { createStore } from "solid-js/store"
import { createSimpleContext } from "./helper"

export type PermissionMode = "auto" | "normal"

export const { use: usePermission, provider: PermissionProvider } = createSimpleContext({
  name: "Permission",
  init: () => {
    // OpenJob auto-approves permission prompts by default (the prompt shows an
    // "auto" badge). Toggle it off per session from the command palette.
    // Explicit `deny` rules still apply.
    const [store, setStore] = createStore<{ mode: PermissionMode }>({
      mode: "auto",
    })
    return {
      get mode() {
        return store.mode
      },
      set(mode: PermissionMode) {
        setStore("mode", mode)
      },
      toggle() {
        setStore("mode", (mode) => (mode === "auto" ? "normal" : "auto"))
      },
    }
  },
})
