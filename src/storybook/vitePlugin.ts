// A Vite plugin that hands the spec view its data as a virtual module, in dev and in the static build.
// It uses only the resolveId and load hooks and addWatchFile, which are stable across Vite 5 to 8.
import type { Plugin } from 'vite'

import { buildSpecData } from '../view/specData.ts'

export const SPEC_MODULE_ID = 'virtual:living-spec/contracts'
const RESOLVED_ID = `\0${SPEC_MODULE_ID}`

export const livingSpecPlugin = ({
  root = process.cwd(),
  dir = 'src',
  results,
}: {
  /** The project root; paths below are relative to it. */
  root?: string
  /** The folder holding the contracts and their stories. */
  dir?: string
  /** The results file the contract runner writes; with none, every scenario shows "not run yet". */
  results?: string
} = {}): Plugin => ({
  name: 'living-spec',
  resolveId(id) {
    return id === SPEC_MODULE_ID ? RESOLVED_ID : undefined
  },
  async load(id) {
    if (id !== RESOLVED_ID) {
      return undefined
    }
    const { spec, files } = await buildSpecData({ root, dir, results })
    // Editing a contract, a story file or the results reloads the module in dev.
    files.forEach((file) => this.addWatchFile(file))
    return `export default ${JSON.stringify(spec)}`
  },
})
