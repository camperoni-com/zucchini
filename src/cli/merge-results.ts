// Merges contract results files, for example one per browser from separate CI jobs, into the config's results
// file (or --out). When a pickle ran on the same browser in more than one, the latest run counts. Files that
// don't exist are skipped with a warning, so a job that produced none leaves its scenarios "not run yet".
//
//   zucchini merge-results <results.json>... [--out <file>]
import fs from 'node:fs'
import { parseArgs } from 'node:util'

import { loadConfig } from '../config/load.ts'
import { mergeResults, readResults, writeResults } from '../runner/results.ts'
import type { Results } from '../view/viewModel.ts'

const { values, positionals } = parseArgs({ options: { out: { type: 'string' } }, allowPositionals: true })

const out = values.out ?? (await loadConfig()).config.results
const files: Results[] = []
for (const file of positionals) {
  const results = fs.existsSync(file) ? readResults(file) : null
  if (results) {
    files.push(results)
  } else {
    process.stderr.write(`No results at ${file}; skipped.\n`)
  }
}
if (!files.length) {
  process.stdout.write(`No results to merge; ${out} left as it was.\n`)
  process.exit(0)
}
const merged = mergeResults(files)
writeResults(out, merged)
const browsers = [...new Set(merged.scenarios.map((s) => s.browser))].sort()
process.stdout.write(`Wrote ${merged.scenarios.length} results (${browsers.join(', ') || 'none'}) to ${out}\n`)
