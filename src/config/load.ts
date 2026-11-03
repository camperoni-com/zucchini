// Finds and loads the project config. Node only.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { DEFAULT_CONFIG, type LivingSpecConfig, type ResolvedConfig } from './config.ts'

/** Looked up in this order at the project root. `.mts` suits a project whose package.json isn't `"type": "module"`. */
export const CONFIG_FILES = ['living-spec.config.ts', 'living-spec.config.mts']

const SETTINGS: readonly (keyof LivingSpecConfig)[] = [
  'contracts',
  'catalog',
  'projectSteps',
  'results',
  'testIdAttribute',
]

/** Loads the config at `root`, filled in with the defaults. Without a config file, the defaults alone. */
export const loadConfig = async (root = process.cwd()): Promise<{ file?: string; config: ResolvedConfig }> => {
  const file = CONFIG_FILES.map((name) => path.join(root, name)).find((candidate) => fs.existsSync(candidate))
  if (!file) {
    return { config: { ...DEFAULT_CONFIG } }
  }
  const loaded: { default?: unknown } = await import(pathToFileURL(file).href)
  const exported = loaded.default
  if (!exported || typeof exported !== 'object') {
    throw new Error(`${file} must export its settings as default: export default defineConfig({ ... })`)
  }
  const config: ResolvedConfig = { ...DEFAULT_CONFIG }
  for (const [key, value] of Object.entries(exported)) {
    if (!SETTINGS.includes(key as keyof LivingSpecConfig)) {
      throw new Error(`${file}: unknown setting "${key}". The settings are ${SETTINGS.join(', ')}.`)
    }
    if (value === undefined) {
      continue
    }
    if (typeof value !== 'string') {
      throw new Error(`${file}: "${key}" must be a string`)
    }
    config[key as keyof LivingSpecConfig] = value
  }
  return { file, config }
}
