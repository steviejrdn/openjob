export * as ConfigPaths from "./paths"

import path from "path"
import { Flag } from "@opencode-ai/core/flag/flag"
import { Global } from "@opencode-ai/core/global"
import { unique } from "remeda"
import * as Effect from "effect/Effect"
import { FSUtil } from "@opencode-ai/core/fs-util"

export const files = Effect.fn("ConfigPaths.projectFiles")(function* (
  name: string,
  directory: string,
  worktree?: string,
) {
  const afs = yield* FSUtil.Service
  return (yield* afs.up({
    targets: [`${name}.jsonc`, `${name}.json`],
    start: directory,
    stop: worktree,
  })).toReversed()
})

export const directories = Effect.fn("ConfigPaths.directories")(function* (directory: string, worktree?: string) {
  const afs = yield* FSUtil.Service
  // A `.openjob` anywhere up-tree means we are inside a user workspace. In
  // that case the host-level framework (shared commands such as add-portal) is
  // deliberately NOT loaded: those are host-mode only.
  const projectDirs = !Flag.OPENCODE_DISABLE_PROJECT_CONFIG
    ? yield* afs.up({
        targets: [".openjob"],
        start: directory,
        stop: worktree,
      })
    : []
  const hostFramework =
    !Flag.OPENCODE_DISABLE_PROJECT_CONFIG && projectDirs.length === 0
      ? yield* afs.up({
          targets: ["scaffold/host"],
          start: directory,
          stop: worktree,
        })
      : []
  return unique([
    Global.Path.config,
    ...projectDirs,
    ...(yield* afs.up({
      targets: [".openjob"],
      start: Global.Path.home,
      stop: Global.Path.home,
    })),
    ...hostFramework,
    ...(Flag.OPENCODE_CONFIG_DIR ? [Flag.OPENCODE_CONFIG_DIR] : []),
  ])
})

export function fileInDirectory(dir: string, name: string) {
  return [path.join(dir, `${name}.json`), path.join(dir, `${name}.jsonc`)]
}
