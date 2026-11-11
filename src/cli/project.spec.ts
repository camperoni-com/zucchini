import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { buildCatalog, catalogToJson } from '../catalog/catalog.ts'
import { librarySteps } from '../steps/library.ts'

// A project whose config (test/fixtures/project/zucchini.config.ts) puts its contracts in contracts/, its
// catalog in catalog/, and declares a project step that its contract uses.
const fixture = path.join(__dirname, '..', '..', 'test', 'fixtures', 'project')
const FEATURE = path.join('contracts', 'Badge', 'Badge.feature')

let project: string

const run = (command: 'catalog' | 'lint', ...args: string[]) => {
  try {
    const output = execFileSync('node', [path.join(__dirname, 'zucchini.ts'), command, ...args], {
      cwd: project,
      stdio: 'pipe',
    })
    return { code: 0, output: output.toString() }
  } catch (error) {
    const failed = error as { status: number; stderr: Buffer }
    return { code: failed.status, output: failed.stderr.toString() }
  }
}

beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'project-'))
  fs.cpSync(fixture, project, { recursive: true })
})

afterEach(() => {
  fs.rmSync(project, { recursive: true, force: true })
})

// Each test starts Node, which is slow on a busy machine.
describe('a project with a config and its own steps', { timeout: 30000 }, () => {
  test('the catalog command writes to the configured folder, with the project steps marked', () => {
    expect(run('catalog')).toMatchObject({ code: 0 })
    const json = JSON.parse(fs.readFileSync(path.join(project, 'catalog', 'steps.json'), 'utf8'))
    expect(json.steps).toHaveLength(11)
    expect(json.steps.at(-1)).toMatchObject({ wording: 'I am in the {string} metro', source: 'project' })
    expect(fs.readFileSync(path.join(project, 'catalog', 'steps.md'), 'utf8')).toContain(
      '11 steps: 10 from the library, 1 from the project.'
    )
    expect(run('catalog', '--check')).toMatchObject({ code: 0 })
  })

  test('the linter reads the configured catalog and contracts, and accepts the project step', () => {
    run('catalog')
    const result = run('lint')
    expect(result.code).toBe(0)
    expect(result.output).toContain('1 contract files, 1 scenarios: no problems.')
  })

  test('the linter says so when there is no catalog yet', () => {
    expect(run('lint')).toEqual({
      code: 2,
      output: `No step catalog at ${path.join('catalog', 'steps.json')}. Run the catalog command first.\n`,
    })
  })

  test('flags override the config', () => {
    run('catalog', '--out', 'other')
    expect(fs.existsSync(path.join(project, 'other', 'steps.json'))).toBe(true)
    expect(fs.existsSync(path.join(project, 'catalog'))).toBe(false)

    // A catalog without the project's steps, named by --catalog, doesn't know the project step.
    fs.writeFileSync(
      path.join(project, 'library.json'),
      catalogToJson(buildCatalog({ library: librarySteps, generatedBy: 'npm run cat' }))
    )
    const result = run('lint', '--catalog', 'library.json')
    expect(result.code).toBe(1)
    expect(result.output).toContain(
      `${FEATURE}:5: unknown step "Given I am in the "Bay Area" metro": no step in library.json matches it. ` +
        'If you just added or changed a step definition, run `npm run cat`.'
    )

    // --root names another folder of contracts: an empty one has none.
    fs.mkdirSync(path.join(project, 'empty'))
    expect(run('lint', '--catalog', 'library.json', '--root', 'empty').output).toContain(
      '0 contract files, 0 scenarios: no problems.'
    )
  })
})
