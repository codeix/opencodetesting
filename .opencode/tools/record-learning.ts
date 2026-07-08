import { tool } from "@opencode-ai/plugin"
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"

// Fire-and-forget bridge to the "learnings" subagent. OpenCode's in-chat task tool
// can't dispatch custom subagents (its subagent_type enum is hardcoded — see
// opencode#20059/#29616), and there is no native background delegation yet
// (opencode#5887), so this tool spawns `opencode run --agent learnings` as a
// detached OS process instead. Replace with the native mechanism once it ships.
export default tool({
  description:
    "Record one reusable fact about the testproject into LEARNINGS.md via the 'learnings' subagent — " +
    "a navigation path, a reliable selector, a decision, a Selenium convention. Fire-and-forget: the " +
    "subagent runs in a detached background process and this tool returns immediately, so never wait " +
    "for LEARNINGS.md to change and never retry a note. One call per distinct note.",
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

    // `timeout 300`: a non-interactive `opencode run` has no TTY, so a stray `ask`
    // permission prompt would hang it forever (root-caused in log.md's Known
    // Gotchas). The cap turns a hung run into a self-cleaning one.
    // detached + stdio:"ignore" + unref(): the child gets its own process group and
    // no inherited pipes, so it survives this session ending and nothing waits on it.
    // cwd must be the testproject (not the shared clone) — that's where the
    // learnings agent resolves LEARNINGS.md (log.md pattern rule 3).
    const child = spawn(
      "timeout",
      ["300", "opencode", "run", "--agent", "learnings", note],
      { cwd: context.directory, detached: true, stdio: "ignore" },
    )
    child.unref()

    return `Note handed to the learnings subagent (background pid ${child.pid}). Do not wait or retry.`
  },
})
