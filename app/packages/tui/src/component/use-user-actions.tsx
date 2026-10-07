import { useDialog } from "../ui/dialog"
import { useExit } from "../context/exit"
import { useProject } from "../context/project"
import { useTuiPaths } from "../context/runtime"
import { useKV } from "../context/kv"
import { useToast } from "../ui/toast"
import { useTheme } from "../context/theme"
import { abbreviateHome } from "../runtime"
import { errorMessage } from "../util/error"
import { DialogPrompt } from "../ui/dialog-prompt"
import { scaffoldUser, usersRoot, writeActiveUser, USER_NAME_MAX, type UserInfo } from "../util/users"

/**
 * Shared user actions for the host picker and the switch-user dialog: activate
 * another user workspace, or scaffold a brand-new one.
 */
export function useUserActions() {
  const dialog = useDialog()
  const exit = useExit()
  const project = useProject()
  const paths = useTuiPaths()
  const kv = useKV()
  const toast = useToast()
  const { theme } = useTheme()

  const current = () => project.instance.directory() || paths.cwd
  const root = () => usersRoot(current())

  async function switchTo(user: UserInfo) {
    await writeActiveUser(root(), user.name).catch(() => {})
    dialog.clear()
    exit({ type: "reopen", directory: user.directory })
  }

  async function addUser(onCancel?: () => void) {
    const value = await DialogPrompt.show(dialog, "New user", {
      placeholder: "name (e.g. salma)",
      description: () => (
        <text fg={theme.textMuted}>
          Creates users/&lt;name&gt; in {abbreviateHome(root(), paths.home)} and switches to it. Up to {USER_NAME_MAX}{" "}
          characters. Run /setup there.
        </text>
      ),
    })
    if (!value?.trim()) {
      onCancel?.()
      return
    }
    const name = value.trim()
    try {
      const directory = await scaffoldUser(root(), name)
      await writeActiveUser(root(), name).catch(() => {})
      // Shown once in the relaunched TUI: new users need to know where their
      // documents folder actually lives on disk.
      kv.set("openjob_welcome", directory)
      dialog.clear()
      exit({ type: "reopen", directory })
    } catch (error) {
      toast.show({ message: errorMessage(error), variant: "error" })
      onCancel?.()
    }
  }

  return { switchTo, addUser, root, current }
}
