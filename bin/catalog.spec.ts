import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

const script = path.join(__dirname, 'catalog.ts')
const fixtureSteps = path.join(__dirname, 'fixtures', 'project', 'steps', 'projectSteps.ts')

// A project with no config, so the catalog goes to the default folder.
let project: string
let out: string

const catalog = (...args: string[]) => {
  try {
    return {
      code: 0,
      output: execFileSync('node', [script, '--command', 'npm run cat', ...args], {
        cwd: project,
        stdio: 'pipe',
      }).toString(),
    }
  } catch (error) {
    const failed = error as { status: number; stderr: Buffer }
    return { code: failed.status, output: failed.stderr.toString() }
  }
}

const readJson = () => JSON.parse(fs.readFileSync(path.join(out, 'steps.json'), 'utf8'))

beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-'))
  out = path.join(project, 'docs', 'zucchini')
})

afterEach(() => {
  fs.rmSync(project, { recursive: true, force: true })
})

// Each test starts Node, which is slow on a busy machine.
describe('the catalog command', { timeout: 30000 }, () => {
  test('writes the JSON and Markdown catalog of the library steps to the default folder', () => {
    expect(catalog()).toMatchObject({ code: 0 })
    const json = readJson()
    expect(json.generatedBy).toBe('npm run cat')
    expect(json.steps).toHaveLength(10)
    expect(json.steps.every((step: { source: string }) => step.source === 'library')).toBe(true)
    expect(fs.readFileSync(path.join(out, 'steps.md'), 'utf8')).toContain(
      '10 steps: 10 from the library, 0 from the project.'
    )
  })

  test('includes the project steps, marked as project steps', () => {
    catalog('--project-steps', fixtureSteps)
    expect(readJson().steps.at(-1)).toMatchObject({ wording: 'I am in the {string} metro', source: 'project' })
  })

  test('--out names another folder', () => {
    catalog('--out', 'elsewhere')
    expect(fs.existsSync(path.join(project, 'elsewhere', 'steps.json'))).toBe(true)
    expect(fs.existsSync(out)).toBe(false)
  })

  test('--check passes on a fresh catalog', () => {
    catalog()
    expect(catalog('--check')).toMatchObject({ code: 0 })
  })

  test('--check fails on a stale catalog and names the command to run', () => {
    catalog()
    catalog('--project-steps', fixtureSteps)
    fs.writeFileSync(path.join(out, 'steps.md'), 'edited by hand\n')
    const result = catalog('--project-steps', fixtureSteps, '--check')
    expect(result.code).toBe(1)
    expect(result.output).toContain(`The step catalog is out of date: ${path.join('docs', 'zucchini', 'steps.md')}.`)
    expect(result.output).toContain('Run `npm run cat` and commit the result.')
  })

  test('--check fails when the catalog is missing', () => {
    expect(catalog('--check')).toMatchObject({ code: 1 })
  })
})
