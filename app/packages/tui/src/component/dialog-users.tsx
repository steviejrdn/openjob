import { createMemo, createSignal, onMount } from "solid-js"
import { DialogSelect, type DialogSelectOption } from "../ui/dialog-select"
import { DialogPrompt } from "../ui/dialog-prompt"
import { useDialog } from "../ui/dialog"
import { useExit } from "../context/exit"
import { useProject } from "../context/project"
import { useTuiPaths } from "../context/runtime"
import { useKV } from "../context/kv"
import { useToast } from "../ui/toast"
import { useTheme } from "../context/theme"
import { abbreviateHome } from "../runtime"
import { errorMessage } from "../util/error"
import { listUsers, scaffoldUser, usersRoot, writeActiveUser, type UserInfo } from "../util/users"

type UserSelection = { type: "user"; user: UserInfo } | { type: "add" } | { type: "open" }

export function DialogUsers() {
  const dialog = useDialog()
  const exit = useExit()
  const project = useProject()
  const paths = useTuiPaths()
  const kv = useKV()
  const toast = useToast()
  const { theme } = useTheme()
  onMount(() => dialog.setSize("large"))

  const root = createMemo(() => usersRoot(project.instance.path().worktree, project.instance.directory() || paths.cwd))
  const [users, setUsers] = createSignal(listUsers(root()))

  function openFolder(directory: string) {
    const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "explorer" : "xdg-open"
    try {
      Bun.spawn([opener, directory], { stdio: ["ignore", "ignore", "ignore"] }).unref()
      dialog.clear()
    } catch (error) {
      toast.show({ message: `Could not open ${directory}: ${errorMessage(error)}`, variant: "error" })
    }
  }

  async function switchTo(user: UserInfo) {
    await writeActiveUser(root(), user.name).catch(() => {})
    dialog.clear()
    exit({ type: "reopen", directory: user.directory })
  }

  async function addUser() {
    const value = await DialogPrompt.show(dialog, "New user", {
      placeholder: "name (e.g. salma)",
      description: () => (
        <text fg={theme.textMuted}>
          Creates users/&lt;name&gt; in {abbreviateHome(root(), paths.home)} and switches to it. Run /setup there.
        </text>
      ),
    })
    if (!value?.trim()) {
      dialog.replace(() => <DialogUsers />)
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
      setUsers(listUsers(root()))
      dialog.replace(() => <DialogUsers />)
    }
  }

  const openTarget = createMemo(() => users().find((user) => user.active)?.directory ?? root())

  const options = createMemo<DialogSelectOption<UserSelection>[]>(() => [
    ...users().map((user) => ({
      title: user.name,
      description: abbreviateHome(user.directory, paths.home),
      footer: user.active ? "default" : undefined,
      value: { type: "user" as const, user },
    })),
    {
      title: "Open workspace folder",
      description: abbreviateHome(openTarget(), paths.home),
      value: { type: "open" as const },
    },
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
        if (option.value.type === "open") {
          openFolder(openTarget())
          return
        }
        void switchTo(option.value.user)
      }}
    />
  )
}
