// A Vite plugin that hands the spec view its data as a virtual module, in dev and in the static build.
// It uses only the resolveId and load hooks and addWatchFile, which are stable across Vite 5 to 8. Its settings
// come from the project config at `root`; the options below override them.
import type { Plugin } from 'vite'

import { loadConfig } from '../config/load.ts'
import { buildSpecData } from '../view/specData.ts'

export const SPEC_MODULE_ID = 'virtual:zucchini/contracts'
const RESOLVED_ID = `\0${SPEC_MODULE_ID}`

export const zucchiniPlugin = ({
  root = process.cwd(),
  dir,
  results,
}: {
  /** The project root, where the config lives; paths below are relative to it. */
  root?: string
  /** The folder holding the contracts and their stories; overrides the config's `contracts`. */
  dir?: string
  /**
   * The results file the contract runner writes; overrides the config's `results`. While it doesn't exist,
   * every scenario shows "not run yet".
   */
  results?: string
} = {}): Plugin => ({
  name: 'zucchini',
  resolveId(id) {
    return id === SPEC_MODULE_ID ? RESOLVED_ID : undefined
  },
  async load(id) {
    if (id !== RESOLVED_ID) {
      return undefined
    }
    const { config } = await loadConfig(root)
    const { spec, files } = await buildSpecData({
      root,
      dir: dir ?? config.contracts,
      results: results ?? config.results,
    })
    // Editing a contract, a story file or the results reloads the module in dev.
    files.forEach((file) => this.addWatchFile(file))
    return `export default ${JSON.stringify(spec)}`
  },
})
