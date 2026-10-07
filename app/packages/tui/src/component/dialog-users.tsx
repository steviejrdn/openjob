import { createMemo, createSignal, onMount } from "solid-js"
import { DialogSelect, type DialogSelectOption } from "../ui/dialog-select"
import { useDialog } from "../ui/dialog"
import { useTuiPaths } from "../context/runtime"
import { abbreviateHome } from "../runtime"
import { listUsers, type UserInfo } from "../util/users"
import { useUserActions } from "./use-user-actions"

type UserSelection = { type: "user"; user: UserInfo } | { type: "add" }

/**
 * Host scope: pick a user or add a new one (fallback to the inline home
 * picker). User scope: switch to another user; the current workspace is
 * excluded and adding users is not offered.
 */
export function DialogUsers(props: { scope?: "host" | "user" }) {
  const scope = () => props.scope ?? "host"
  const dialog = useDialog()
  const paths = useTuiPaths()
  const { switchTo, addUser, root, current } = useUserActions()
  onMount(() => dialog.setSize("large"))

  const [users, setUsers] = createSignal(listUsers(root()))

  const visibleUsers = createMemo(() =>
    scope() === "user" ? users().filter((user) => user.directory !== current()) : users(),
  )

  const options = createMemo<DialogSelectOption<UserSelection>[]>(() => [
    ...visibleUsers().map((user) => ({
      title: user.name,
      description: abbreviateHome(user.directory, paths.home),
      footer: scope() === "host" && user.active ? "default" : undefined,
      value: { type: "user" as const, user },
    })),
    ...(scope() === "host"
      ? [
          {
            title: "Add user…",
            description: "Create users/<name> and switch to it",
            value: { type: "add" as const },
          },
        ]
      : []),
  ])

  return (
    <DialogSelect
      title={scope() === "host" ? "Select a user or add a new user" : "Switch to another user"}
      placeholder=""
      renderFilter={false}
      options={options()}
      onSelect={(option) => {
        if (option.value.type === "add") {
          void addUser(() => setUsers(listUsers(root())))
          return
        }
        void switchTo(option.value.user)
      }}
    />
  )
}
