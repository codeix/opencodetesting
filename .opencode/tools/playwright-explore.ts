import { tool } from "@opencode-ai/plugin"
import { chromium, type Browser, type Page } from "playwright"
import { mkdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

// Singleton across calls so the same session doesn't re-launch/re-login on every
// skill invocation. See docs/PLAN.md section 4.2.
let browser: Browser | undefined
let page: Page | undefined

const SECRET_PLACEHOLDER = /^\$SECRET:(.+)$/

// Resolves a "$SECRET:NAME" placeholder from .tools/secrets.env. The AI only ever
// sees the placeholder in its own tool call; the real value never enters the prompt
// or the tool's return value. See docs/PLAN.md section 5.3.
function resolveValue(value: string, projectDirectory: string): string {
  const match = SECRET_PLACEHOLDER.exec(value)
  if (!match) return value

  const name = match[1]
  const secretsPath = join(projectDirectory, ".tools", "secrets.env")
  let contents: string
  try {
    contents = readFileSync(secretsPath, "utf-8")
  } catch {
    throw new Error(`Secret "${name}" was requested but ${secretsPath} does not exist. Create it manually (see AGENTS.md "Secrets").`)
  }

  for (const line of contents.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    if (trimmed.slice(0, eq) === name) return trimmed.slice(eq + 1)
  }
  throw new Error(`Secret "${name}" not found in ${secretsPath}`)
}

async function getPage(): Promise<Page> {
  if (!browser) {
    // Headed on purpose: the developer watches the exploration live in the browser.
    browser = await chromium.launch({ headless: false })
  }
  if (!page || page.isClosed()) {
    page = await browser.newPage()
  }
  return page
}

export default tool({
  description:
    "Drives a visible (non-headless) Playwright browser to explore a web app for test generation: navigate (goto), " +
    "capture a compact ARIA snapshot as text (snapshot), take a cropped screenshot saved to disk (screenshot " +
    "— returns only the file path, never inline image data), click an element (click), fill a form field " +
    "(fill), or run arbitrary JavaScript in the page context (evaluate). The fill value may be the placeholder " +
    "\"$SECRET:NAME\" instead of a real secret — it is resolved from .tools/secrets.env inside this tool and " +
    "never appears in the prompt or the tool's return value. Browser/page are a singleton and persist across " +
    "calls in the same session, so a login flow only needs to run once. Always prefer 'snapshot' text over " +
    "'screenshot' — only screenshot, and only a cropped region, when the ARIA snapshot leaves a specific " +
    "element genuinely ambiguous.",
  args: {
    action: tool.schema.enum(["goto", "snapshot", "screenshot", "click", "fill", "evaluate"]).describe("Which browser action to perform."),
    url: tool.schema.string().optional().describe("Target URL. Required for action=goto."),
    selector: tool.schema.string().optional().describe("CSS selector of the target element. Required for action=click and action=fill."),
    value: tool.schema.string().optional().describe("Text to fill, or a \"$SECRET:NAME\" placeholder. Required for action=fill."),
    code: tool.schema.string().optional().describe("JavaScript to run in the page context. May contain statements and a 'return' to produce a value. Required for action=evaluate."),
    clip: tool.schema
      .object({
        x: tool.schema.number(),
        y: tool.schema.number(),
        width: tool.schema.number(),
        height: tool.schema.number(),
      })
      .optional()
      .describe("Crop region for action=screenshot, in page pixels. Always set this to the relevant element's bounding box — never take a full-page screenshot unless truly necessary."),
  },
  async execute(args, context) {
    const p = await getPage()

    switch (args.action) {
      case "goto": {
        if (!args.url) throw new Error("action=goto requires 'url'")
        // networkidle, not domcontentloaded: SPAs (Angular/React/Vue) fetch their
        // data after the initial DOM is ready, so domcontentloaded snapshots
        // intermittently caught an empty/loading state instead of real content.
        await p.goto(args.url, { waitUntil: "networkidle" })
        return `Navigated to ${args.url}`
      }

      case "snapshot": {
        // Bounded settle wait: SPAs can still be mid-fetch right after a click/goto
        // resolves. Non-throwing — apps that poll/keep a socket open would never go
        // idle, so this must not block the snapshot indefinitely.
        await p.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {})
        return await p.locator("body").ariaSnapshot()
      }

      case "screenshot": {
        const dir = join(context.directory, ".tools", "screenshots")
        mkdirSync(dir, { recursive: true })
        const file = join(dir, `screenshot-${Date.now()}.png`)
        await p.screenshot({ path: file, clip: args.clip })
        return `Screenshot saved to ${file}`
      }

      case "click": {
        if (!args.selector) throw new Error("action=click requires 'selector'")
        await p.locator(args.selector).click()
        return `Clicked ${args.selector}`
      }

      case "fill": {
        if (!args.selector) throw new Error("action=fill requires 'selector'")
        if (args.value === undefined) throw new Error("action=fill requires 'value'")
        const resolved = resolveValue(args.value, context.directory)
        await p.locator(args.selector).fill(resolved)
        return `Filled ${args.selector}`
      }

      case "evaluate": {
        if (args.code === undefined) throw new Error("action=evaluate requires 'code'")
        // Wrapped in `new Function` (rather than passing the string straight to
        // page.evaluate) so multi-statement code with an explicit `return` works,
        // not just single expressions.
        const result = await p.evaluate((code) => new Function(code)(), args.code)
        return result === undefined ? "undefined" : JSON.stringify(result)
      }

      default: {
        const exhaustive: never = args.action
        throw new Error(`Unknown action: ${exhaustive}`)
      }
    }
  },
})
