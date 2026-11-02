import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import type { SpecData } from '../view/specData.ts'
import { livingSpecPlugin, SPEC_MODULE_ID } from './vitePlugin.ts'

const fixtureStories = path.join(__dirname, '..', 'contracts', 'fixtures', 'Badge', 'Badge.stories.ts')

let root: string

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-plugin-'))
  fs.mkdirSync(path.join(root, 'src', 'Badge'), { recursive: true })
  fs.copyFileSync(fixtureStories, path.join(root, 'src', 'Badge', 'Badge.stories.ts'))
  fs.writeFileSync(
    path.join(root, 'src', 'Badge', 'Badge.feature'),
    [
      'Feature: Badge',
      '',
      '    @story:With_Label',
      '    Scenario: Shows its label',
      '        When I wait for "1" seconds',
      '',
    ].join('\n')
  )
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

// Calls the plugin's hooks the way Vite does, with a stand-in plugin context.
const loadSpec = async (options: { results?: string }) => {
  const plugin = livingSpecPlugin({ root, dir: 'src', ...options })
  const resolveId = plugin.resolveId as (id: string) => string | undefined
  const load = plugin.load as (this: { addWatchFile: (file: string) => void }, id: string) => Promise<string>
  const resolved = resolveId(SPEC_MODULE_ID)
  expect(resolved).toBeDefined()
  expect(resolveId('./other')).toBeUndefined()
  const watched: string[] = []
  const code = await load.call({ addWatchFile: (file) => watched.push(file) }, resolved as string)
  return { spec: JSON.parse(code.replace(/^export default /, '')) as SpecData, watched }
}

describe('livingSpecPlugin', () => {
  test('serves the contracts and the uncovered stories as a virtual module', async () => {
    const { spec, watched } = await loadSpec({})
    expect(spec.ranAt).toBeNull()
    expect(spec.contracts).toHaveLength(1)
    expect(spec.contracts[0]).toMatchObject({
      file: path.join('src', 'Badge', 'Badge.feature'),
      title: 'Fixtures/Components/Badge',
      status: 'not-run',
    })
    expect(spec.contracts[0].scenarios[0].stories).toEqual([
      { name: 'With Label', id: 'fixtures-components-badge--with-label' },
    ])
    expect(spec.uncovered).toEqual([
      {
        title: 'Fixtures/Components/Badge',
        componentId: 'fixtures-components-badge',
        stories: [
          { name: 'Default', id: 'fixtures-components-badge--default' },
          { name: 'Empty', id: 'fixtures-components-badge--empty' },
        ],
      },
    ])
    expect(watched.sort()).toEqual(
      [path.join(root, 'src', 'Badge', 'Badge.feature'), path.join(root, 'src', 'Badge', 'Badge.stories.ts')].sort()
    )
  })

  test('shows the results when the results file exists, and watches it', async () => {
    fs.writeFileSync(
      path.join(root, 'results.json'),
      JSON.stringify({
        ranAt: '2026-11-02T10:00:00Z',
        scenarios: [{ file: path.join('src', 'Badge', 'Badge.feature'), line: 4, status: 'passed' }],
      })
    )
    const { spec, watched } = await loadSpec({ results: 'results.json' })
    expect(spec.ranAt).toBe('2026-11-02T10:00:00Z')
    expect(spec.contracts[0].scenarios[0].status).toBe('passed')
    expect(watched).toContain(path.join(root, 'results.json'))
  })

  test('shows every scenario as not run yet when the results file is missing', async () => {
    const { spec } = await loadSpec({ results: 'missing.json' })
    expect(spec.ranAt).toBeNull()
    expect(spec.contracts[0].scenarios[0].status).toBe('not-run')
  })
})
