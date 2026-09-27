import { createMemo, createSignal, onMount } from "solid-js"
import { DialogSelect, type DialogSelectOption } from "../ui/dialog-select"
import { DialogPrompt } from "../ui/dialog-prompt"
import { useDialog } from "../ui/dialog"
import { useExit } from "../context/exit"
import { useProject } from "../context/project"
import { useTuiPaths } from "../context/runtime"
import { useToast } from "../ui/toast"
import { useTheme } from "../context/theme"
import { abbreviateHome } from "../runtime"
import { errorMessage } from "../util/error"
import { listUsers, scaffoldUser, usersRoot, writeActiveUser, type UserInfo } from "../util/users"

type UserSelection = { type: "user"; user: UserInfo } | { type: "add" }

export function DialogUsers() {
  const dialog = useDialog()
  const exit = useExit()
  const project = useProject()
  const paths = useTuiPaths()
  const toast = useToast()
  const { theme } = useTheme()
  onMount(() => dialog.setSize("large"))

  const root = createMemo(() => usersRoot(project.instance.path().worktree, project.instance.directory() || paths.cwd))
  const [users, setUsers] = createSignal(listUsers(root()))

  async function switchTo(user: UserInfo) {
    await writeActiveUser(root(), user.name).catch(() => {})
    dialog.clear()
    exit({ type: "reopen", directory: user.directory })
  }

  async function addUser() {
    const value = await DialogPrompt.show(dialog, "New user", {
      placeholder: "name (e.g. salma)",
      description: () => <text fg={theme.textMuted}>Creates users/&lt;name&gt; and switches to it. Run /setup there.</text>,
    })
    if (!value?.trim()) {
      dialog.replace(() => <DialogUsers />)
      return
    }
    const name = value.trim()
    try {
      const directory = await scaffoldUser(root(), name)
      await writeActiveUser(root(), name).catch(() => {})
      dialog.clear()
      exit({ type: "reopen", directory })
    } catch (error) {
      toast.show({ message: errorMessage(error), variant: "error" })
      setUsers(listUsers(root()))
      dialog.replace(() => <DialogUsers />)
    }
  }

  const options = createMemo<DialogSelectOption<UserSelection>[]>(() => [
    ...users().map((user) => ({
      title: user.name,
      description: abbreviateHome(user.directory, paths.home),
      footer: user.active ? "default" : undefined,
      value: { type: "user" as const, user },
    })),
    {
      title: "Add user…",
      description: "Create users/<name> and switch to it",
      value: { type: "add" as const },
    },
  ])

  return (
    <DialogSelect
      title="Users"
      placeholder="Search users"
      options={options()}
      onSelect={(option) => {
        if (option.value.type === "add") {
          void addUser()
          return
        }
        void switchTo(option.value.user)
      }}
    />
  )
}
