// Lints the contract feature files under --root against the step catalog and the stories beside them.
// Prints every problem as file:line, lists the stories without a contract, and exits 1 on any problem.
// Runs on Node's built-in TypeScript support.
//
//   node packages/living-spec/bin/lint.ts --catalog <steps.json> [--root <dir>]
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

import type { Catalog } from '../src/catalog/catalog.ts'
import { formatLintResult, lintContracts } from '../src/contracts/lint.ts'
import { readStoryFile } from '../src/contracts/stories.ts'

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
const glob = (pattern: string) => fs.globSync(path.join(values.root, pattern)).sort()

const featureFiles = glob('**/*.feature')
const storyFiles = await Promise.all(glob('**/*.stories.{ts,tsx,js,jsx,mjs}').map(readStoryFile))

const result = lintContracts({
  features: featureFiles.map((file) => ({ file, text: fs.readFileSync(file, 'utf8') })),
  storyFiles,
  steps: catalog.steps,
})

const report = formatLintResult(result, featureFiles.length)
if (result.problems.length) {
  process.stderr.write(report)
  process.exit(1)
}
process.stdout.write(report)
