import { jsx } from "@opentui/solid/jsx-runtime"
import { createSignal } from "solid-js"
import { readFileSync } from "node:fs"
import { join } from "node:path"

// Renders the currently active ai/scenario/<name>.md as one line in the native
// TUI sidebar, e.g. "📍 search_form — step 6". "Current" is tracked by the
// scenario subagent (.opencode/agents/scenario.md), which writes the active
// scenario's name to ai/.install/current-scenario on every invocation. See
// docs/PLAN.md section 4.6.
//
// Rendering a slot only happens once at mount — Solid's reactivity needs an
// explicit signal, refreshed here on session.idle/message.part.updated, since
// our writes only ever happen as a side effect of the scenario subagent acting
// mid-session.

function currentScenarioLine(directory: string): string {
  let name: string
  try {
    name = readFileSync(join(directory, "ai", ".install", "current-scenario"), "utf-8").trim()
  } catch {
    return ""
  }
  if (!name) return ""

  let step = 0
  try {
    const contents = readFileSync(join(directory, "ai", "scenario", `${name}.md`), "utf-8")
    for (const line of contents.split("\n")) {
      const match = /^(\d+)\./.exec(line.trim())
      if (match) step = Math.max(step, Number(match[1]))
    }
  } catch {
    return ""
  }

  return step > 0 ? `📍 ${name} — step ${step}` : `📍 ${name}`
}

const plugin = {
  id: "scenario-sidebar",
  tui: async (api: any) => {
    const directory: string = api.state?.path?.directory ?? process.cwd()
    const [line, setLine] = createSignal(currentScenarioLine(directory))

    const refresh = () => setLine(currentScenarioLine(directory))
    api.event.on("session.idle", refresh)
    api.event.on("message.part.updated", refresh)

    api.slots.register({
      slots: {
        sidebar_content: (_ctx: unknown, _props: { session_id: string }) => {
          return jsx("text", { children: line })
        },
      },
    })
  },
}

export default plugin
