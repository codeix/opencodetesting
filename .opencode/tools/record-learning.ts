import { tool } from "@opencode-ai/plugin"
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"

// Synchronous bridge to the "learnings" subagent. OpenCode's in-chat task tool can't
// dispatch custom subagents (its subagent_type enum is hardcoded — see
// opencode#20059/#29616), so this tool blocks on `opencode run --agent learnings`
// instead and returns its real result. Delete this file and go back to a plain
// task-tool call once either of those upstream issues ships.
export default tool({
  description:
    "Record one reusable fact about the testproject into LEARNINGS.md via the 'learnings' subagent — " +
    "a navigation path, a reliable selector, a decision, a Selenium convention. Blocks until the " +
    "subagent finishes and returns whether the note was recorded. One call per distinct note.",
  args: {
    note: tool.schema
      .string()
      .describe(
        "One terse, self-contained fact worth remembering, phrased so it makes sense without this " +
          "session's context. Keep it to a single line. Never include a real secret — use the " +
          "$SECRET:NAME placeholder.",
      ),
  },
  async execute(args, context) {
    // The learnings agent files one-line bullets; flatten whatever the model sent.
    const note = args.note.replace(/\s+/g, " ").trim()
    if (!note) throw new Error("note must not be empty")

    // LEARNINGS.md is testproject-specific and must never be created in the shared
    // opencodetesting clone (whose .opencode/ this file lives in). A testproject is
    // identified the same way learnings.md defines it: the directory with pom.xml.
    if (!existsSync(join(context.directory, "pom.xml"))) {
      throw new Error(
        `${context.directory} is not a testproject (no pom.xml) — refusing to record. ` +
          "LEARNINGS.md is project-specific and belongs at the testproject root, never in the " +
          "shared opencodetesting clone. Run opencode from the testproject directory, or state " +
          "the note in your reply instead.",
      )
    }

    // 15-minute cap: a non-interactive `opencode run` has no TTY, so a stray `ask`
    // permission prompt would otherwise hang forever (root-caused in log.md's Known
    // Gotchas) and freeze this whole turn with it. `learnings.md` has an explicit
    // `permission.edit: allow` to keep that from firing in the first place; this is
    // the backstop. cwd is the testproject — that's where the learnings agent
    // resolves LEARNINGS.md (log.md pattern rule 3).
    const result = spawnSync("opencode", ["run", "--agent", "learnings", note], {
      cwd: context.directory,
      encoding: "utf-8",
      timeout: 15 * 60 * 1000,
    })

    if (result.error) throw new Error(`Failed to run learnings subagent: ${result.error.message}`)
    if (result.signal === "SIGTERM") throw new Error("learnings subagent timed out after 15 minutes")
    if (result.status !== 0) {
      throw new Error(`learnings subagent exited ${result.status}: ${result.stderr || result.stdout}`)
    }

    return result.stdout.trim() || "learnings subagent finished with no output."
  },
})
