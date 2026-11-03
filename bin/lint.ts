// Lints the contract feature files under --root against the step catalog and the stories beside them.
// Prints every problem as file:line, lists the stories without a contract, and exits 1 on any problem.
// Runs on Node's built-in TypeScript support.
//
//   node packages/living-spec/bin/lint.ts --catalog <steps.json> [--root <dir>]
import fs from 'node:fs'
import { parseArgs } from 'node:util'

import type { Catalog } from '../src/catalog/catalog.ts'
import { formatLintResult, lintContracts } from '../src/contracts/lint.ts'
import { findContracts } from '../src/contracts/load.ts'

const { values } = parseArgs({
  options: {
    catalog: { type: 'string' },
    root: { type: 'string', default: 'src' },
  },
})

if (!values.catalog) {
  process.stderr.write('Usage: lint.ts --catalog <steps.json> [--root <dir>]\n')
  process.exit(2)
}

const catalog: Catalog = JSON.parse(fs.readFileSync(values.catalog, 'utf8'))
const { features, storyFiles } = await findContracts({ dir: values.root })

const result = lintContracts({
  features,
  storyFiles,
  steps: catalog.steps,
  catalog: { file: values.catalog, command: catalog.generatedBy },
})

const report = formatLintResult(result, features.length)
if (result.problems.length) {
  process.stderr.write(report)
  process.exit(1)
}
process.stdout.write(report)
