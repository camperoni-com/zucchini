// Writes the step catalog (steps.json and steps.md) into --out, or with --check fails when the committed
// files differ from what the step definitions produce. Runs on Node's built-in TypeScript support.
//
//   node packages/living-spec/bin/catalog.ts --out <dir> [--project-steps <module>] [--command <text>] [--check]
//
// A --project-steps module exports `projectSteps`, an array of step definitions.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

import { buildCatalog, catalogToJson, catalogToMarkdown } from '../src/catalog/catalog.ts'
import { librarySteps } from '../src/steps/library.ts'
import type { StepDefinition } from '../src/steps/types.ts'

const { values } = parseArgs({
  options: {
    out: { type: 'string' },
    'project-steps': { type: 'string' },
    command: { type: 'string', default: 'node packages/living-spec/bin/catalog.ts' },
    check: { type: 'boolean', default: false },
  },
})

if (!values.out) {
  process.stderr.write('Usage: catalog.ts --out <dir> [--project-steps <module>] [--command <text>] [--check]\n')
  process.exit(2)
}

const loadProjectSteps = async (modulePath: string | undefined): Promise<StepDefinition[]> => {
  if (!modulePath) {
    return []
  }
  const loaded: { projectSteps?: StepDefinition[] } = await import(pathToFileURL(path.resolve(modulePath)).href)
  if (!Array.isArray(loaded.projectSteps)) {
    throw new Error(`${modulePath} must export projectSteps, an array of step definitions`)
  }
  return loaded.projectSteps
}

const catalog = buildCatalog({
  library: librarySteps,
  project: await loadProjectSteps(values['project-steps']),
  generatedBy: values.command,
})

const files = {
  [path.join(values.out, 'steps.json')]: catalogToJson(catalog),
  [path.join(values.out, 'steps.md')]: catalogToMarkdown(catalog),
}

if (values.check) {
  const stale = Object.entries(files)
    .filter(([file, content]) => !fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content)
    .map(([file]) => file)
  if (stale.length) {
    process.stderr.write(
      `The step catalog is out of date: ${stale.join(', ')}.\nRun \`${values.command}\` and commit the result.\n`
    )
    process.exit(1)
  }
  process.stdout.write(`The step catalog is up to date (${catalog.steps.length} steps).\n`)
} else {
  fs.mkdirSync(values.out, { recursive: true })
  for (const [file, content] of Object.entries(files)) {
    fs.writeFileSync(file, content)
  }
  process.stdout.write(`Wrote ${Object.keys(files).join(' and ')} (${catalog.steps.length} steps).\n`)
}
