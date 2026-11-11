// Writes the step catalog (steps.json and steps.md) into the config's catalog folder, or with --check fails
// when the committed files differ from what the step definitions produce.
// Settings come from the project config (zucchini.config.ts or .mts in the working directory);
// flags override them.
//
//   zucchini catalog [--out <dir>] [--project-steps <module>] [--command <text>] [--check]
//
// A project-steps module exports `projectSteps`, an array of step definitions.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

import { buildCatalog, catalogToJson, catalogToMarkdown } from '../catalog/catalog.ts'
import { loadConfig } from '../config/load.ts'
import { librarySteps } from '../steps/library.ts'
import type { StepDefinition } from '../steps/types.ts'

const { values } = parseArgs({
  options: {
    out: { type: 'string' },
    'project-steps': { type: 'string' },
    command: { type: 'string', default: 'zucchini catalog' },
    check: { type: 'boolean', default: false },
  },
})

const { config } = await loadConfig()
const out = values.out ?? config.catalog

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
  project: await loadProjectSteps(values['project-steps'] ?? config.projectSteps),
  generatedBy: values.command,
})

const files = {
  [path.join(out, 'steps.json')]: catalogToJson(catalog),
  [path.join(out, 'steps.md')]: catalogToMarkdown(catalog),
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
  fs.mkdirSync(out, { recursive: true })
  for (const [file, content] of Object.entries(files)) {
    fs.writeFileSync(file, content)
  }
  process.stdout.write(`Wrote ${Object.keys(files).join(' and ')} (${catalog.steps.length} steps).\n`)
}
