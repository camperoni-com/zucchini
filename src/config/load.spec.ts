import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { DEFAULT_CONFIG } from './config.ts'
import { loadConfig } from './load.ts'

let root: string

const writeConfig = (name: string, body: string) => fs.writeFileSync(path.join(root, name), body)

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'config-'))
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('loadConfig', () => {
  test('gives the defaults when the project has no config', async () => {
    expect(await loadConfig(root)).toEqual({
      config: {
        contracts: 'src',
        catalog: 'docs/zucchini',
        results: 'test-results/zucchini.json',
        testIdAttribute: 'data-testid',
      },
    })
  })

  test('reads zucchini.config.mts and fills in the defaults', async () => {
    writeConfig('zucchini.config.mts', "export default { contracts: 'app', projectSteps: 'steps.ts' }\n")
    expect(await loadConfig(root)).toEqual({
      file: path.join(root, 'zucchini.config.mts'),
      config: { ...DEFAULT_CONFIG, contracts: 'app', projectSteps: 'steps.ts' },
    })
  })

  test('prefers zucchini.config.ts', async () => {
    writeConfig('zucchini.config.ts', "export default { results: 'ts.json' }\n")
    writeConfig('zucchini.config.mts', "export default { results: 'mts.json' }\n")
    expect((await loadConfig(root)).config.results).toBe('ts.json')
  })

  test('rejects a config without a default export', async () => {
    writeConfig('zucchini.config.mts', "export const contracts = 'app'\n")
    await expect(loadConfig(root)).rejects.toThrow('must export its settings as default')
  })

  test('rejects an unknown setting', async () => {
    writeConfig('zucchini.config.mts', "export default { contract: 'app' }\n")
    await expect(loadConfig(root)).rejects.toThrow('unknown setting "contract"')
  })

  test('rejects a setting that is not a string', async () => {
    writeConfig('zucchini.config.mts', 'export default { results: 3 }\n')
    await expect(loadConfig(root)).rejects.toThrow('"results" must be a string')
  })
})
