import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import type { ScenarioResult } from '../view/viewModel.ts'
import { appendResult, dropBrowser, mergeResults, readResults } from './results.ts'

const result = (overrides: Partial<ScenarioResult>): ScenarioResult => ({
  file: 'src/Badge/Badge.feature',
  line: 4,
  name: 'Shows its label',
  browser: 'chromium-desktop',
  hash: 'abc123abc123',
  status: 'passed',
  ...overrides,
})

describe('mergeResults', () => {
  test('puts every browser into one file, under the latest time', () => {
    const merged = mergeResults([
      { ranAt: '2026-11-02T10:00:00Z', scenarios: [result({ browser: 'chromium-desktop' })] },
      { ranAt: '2026-11-02T11:00:00Z', scenarios: [result({ browser: 'webkit-mobile', status: 'failed' })] },
    ])
    expect(merged.ranAt).toBe('2026-11-02T11:00:00Z')
    expect(merged.scenarios).toEqual([
      result({ browser: 'chromium-desktop', ranAt: '2026-11-02T10:00:00Z' }),
      result({ browser: 'webkit-mobile', status: 'failed', ranAt: '2026-11-02T11:00:00Z' }),
    ])
  })

  test('keeps the latest run of a pickle on the same browser', () => {
    const merged = mergeResults([
      { ranAt: '2026-11-02T11:00:00Z', scenarios: [result({ status: 'failed' })] },
      { ranAt: '2026-11-02T10:00:00Z', scenarios: [result({ status: 'passed' })] },
    ])
    expect(merged.scenarios).toEqual([result({ status: 'failed', ranAt: '2026-11-02T11:00:00Z' })])
  })
})

describe('the results file', () => {
  let dir: string
  let file: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'results-'))
    file = path.join(dir, 'nested', 'living-spec.json')
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  test("a run replaces its own browser's results and keeps the others", () => {
    appendResult(file, result({ browser: 'webkit-mobile', ranAt: '2026-11-01T09:00:00Z' }))
    appendResult(file, result({ browser: 'chromium-desktop', status: 'failed', ranAt: '2026-11-01T09:00:00Z' }))

    dropBrowser(file, 'chromium-desktop')
    appendResult(file, result({ browser: 'chromium-desktop', ranAt: '2026-11-02T10:00:00Z' }))

    expect(readResults(file)).toEqual({
      ranAt: '2026-11-02T10:00:00Z',
      scenarios: [
        result({ browser: 'webkit-mobile', ranAt: '2026-11-01T09:00:00Z' }),
        result({ browser: 'chromium-desktop', ranAt: '2026-11-02T10:00:00Z' }),
      ],
    })
  })

  test('dropping a browser from a missing file does nothing', () => {
    dropBrowser(file, 'chromium-desktop')
    expect(fs.existsSync(file)).toBe(false)
  })
})
