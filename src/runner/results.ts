// The results file: written by the runner, one entry per pickle and browser, and merged across browsers.
// The format is the one the spec view reads (see ScenarioResult). Node only.
import fs from 'node:fs'
import path from 'node:path'

import type { Results, ScenarioResult } from '../view/viewModel.ts'

const keyOf = (result: ScenarioResult) => JSON.stringify([result.file, result.line, result.name, result.browser])

const latest = (a: string, b: string) => (a > b ? a : b)

/**
 * Merges results files, for example one per browser, into one. When the same pickle ran on the same browser in
 * more than one of them, the latest run counts.
 */
export const mergeResults = (files: readonly Results[]): Results => {
  const byKey = new Map<string, ScenarioResult>()
  let ranAt = ''
  for (const file of files) {
    ranAt = latest(ranAt, file.ranAt)
    for (const result of file.scenarios) {
      const entry = { ...result, ranAt: result.ranAt ?? file.ranAt }
      const previous = byKey.get(keyOf(entry))
      if (!previous || latest(previous.ranAt ?? '', entry.ranAt) === entry.ranAt) {
        byKey.set(keyOf(entry), entry)
      }
    }
  }
  return { ranAt, scenarios: [...byKey.values()] }
}

export const readResults = (file: string): Results | null =>
  fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Results) : null

export const writeResults = (file: string, results: Results) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(results, null, 2)}\n`)
}

/** Drops one browser's entries from the file at the start of its run, keeping the other browsers' results. */
export const dropBrowser = (file: string, browser: string) => {
  const results = readResults(file)
  if (results) {
    writeResults(file, { ...results, scenarios: results.scenarios.filter((r) => r.browser !== browser) })
  }
}

/** Adds one pickle's run. Node's synchronous file calls keep concurrent records from interleaving. */
export const appendResult = (file: string, result: ScenarioResult) => {
  const results = readResults(file) ?? { ranAt: '', scenarios: [] }
  writeResults(file, mergeResults([results, { ranAt: result.ranAt ?? new Date().toISOString(), scenarios: [result] }]))
}
