import type { Argv } from "yargs"
import { UI } from "../ui"

export const UpgradeCommand = {
  command: "upgrade [target]",
  describe: "upgrade OpenJob to the latest release",
  builder: (yargs: Argv) => {
    return yargs.positional("target", {
      describe: "version to upgrade to, for ex '0.1.0' or 'v0.1.0'",
      type: "string",
    })
  },
  handler: async () => {
    UI.empty()
    UI.println(UI.logo("  "))
    UI.empty()
    // OpenJob never self-updates: auto-update is disabled and the installer is
    // the only supported upgrade path (it also refreshes the workspace bundle).
    UI.println("OpenJob does not self-update. Re-run the installer to upgrade:")
    UI.empty()
    UI.println(
      "  curl -fsSL https://raw.githubusercontent.com/steviejrdn/openjob/main/scripts/install | bash",
    )
    UI.empty()
  },
}
