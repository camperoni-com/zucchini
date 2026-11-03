// Lints the contract feature files against the step catalog and the stories beside them. Prints every problem
// as file:line, lists the stories without a contract, and exits 1 on any problem. Runs on Node's built-in
// TypeScript support. Settings come from the project config (living-spec.config.ts or .mts in the working
// directory); flags override them: --catalog names the steps.json to check against, --root the folder of
// contracts.
//
//   node packages/living-spec/bin/lint.ts [--catalog <steps.json>] [--root <dir>]
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

import type { Catalog } from '../src/catalog/catalog.ts'
import { loadConfig } from '../src/config/load.ts'
import { formatLintResult, lintContracts } from '../src/contracts/lint.ts'
import { findContracts } from '../src/contracts/load.ts'

const { values } = parseArgs({
  options: {
    catalog: { type: 'string' },
    root: { type: 'string' },
  },
})

const { config } = await loadConfig()
const catalogFile = values.catalog ?? path.join(config.catalog, 'steps.json')
if (!fs.existsSync(catalogFile)) {
  process.stderr.write(`No step catalog at ${catalogFile}. Run the catalog command first.\n`)
  process.exit(2)
}
const catalog: Catalog = JSON.parse(fs.readFileSync(catalogFile, 'utf8'))
const { features, storyFiles } = await findContracts({ dir: values.root ?? config.contracts })

const result = lintContracts({
  features,
  storyFiles,
  steps: catalog.steps,
  catalog: { file: catalogFile, command: catalog.generatedBy },
})

const report = formatLintResult(result, features.length)
if (result.problems.length) {
  process.stderr.write(report)
  process.exit(1)
}
process.stdout.write(report)
