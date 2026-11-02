import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { buildCatalog, catalogToJson } from '../src/catalog/catalog.ts'
import { librarySteps } from '../src/steps/library.ts'

const script = path.join(__dirname, 'lint.ts')
const fixtureStories = path.join(__dirname, '..', 'src', 'contracts', 'fixtures', 'Badge', 'Badge.stories.ts')

let root: string

const lint = () => {
  const args = [script, '--catalog', path.join(root, 'steps.json'), '--root', path.join(root, 'src')]
  try {
    return { code: 0, output: execFileSync('node', args, { stdio: 'pipe' }).toString() }
  } catch (error) {
    const failed = error as { status: number; stderr: Buffer }
    return { code: failed.status, output: failed.stderr.toString() }
  }
}

const writeFeature = (...lines: string[]) =>
  fs.writeFileSync(path.join(root, 'src', 'Badge', 'Badge.feature'), ['Feature: Badge', '', ...lines, ''].join('\n'))

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'lint-'))
  fs.mkdirSync(path.join(root, 'src', 'Badge'), { recursive: true })
  fs.copyFileSync(fixtureStories, path.join(root, 'src', 'Badge', 'Badge.stories.ts'))
  fs.writeFileSync(
    path.join(root, 'steps.json'),
    catalogToJson(buildCatalog({ library: librarySteps, generatedBy: 'x' }))
  )
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

// Each test starts Node and loads the Storybook CSF reader, which is slow on a busy machine.
describe('the lint command', { timeout: 30000 }, () => {
  test('passes on valid contracts and lists the uncovered stories', () => {
    writeFeature('    @story:Default', '    Scenario: Waits', '        When I wait for "1" seconds')
    const result = lint()
    expect(result.code).toBe(0)
    expect(result.output).toContain('Stories without a contract: 2 of 3')
    expect(result.output).toContain('Fixtures/Components/Badge')
    expect(result.output).toContain('1 contract files, 1 scenarios: no problems.')
  })

  test('fails with file and line on a problem', () => {
    writeFeature('    @story:Default', '    Scenario: Waits', '        When I wait a bit')
    const result = lint()
    expect(result.code).toBe(1)
    expect(result.output).toContain(
      `${path.join(root, 'src', 'Badge', 'Badge.feature')}:5: unknown step "When I wait a bit"`
    )
  })
})
