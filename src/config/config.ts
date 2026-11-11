// The project config: one file at the project root, read by the catalog command, the contract linter and the
// Storybook plugin. Command-line flags and plugin options override it. Paths are relative to the project root.
import { DEFAULT_TEST_ID_ATTRIBUTE } from '../steps/dom.ts'

export interface ZucchiniConfig {
  /** The folder holding the contracts and their stories. Default `src`. */
  contracts?: string
  /** The folder the step catalog (steps.json and steps.md) is written to. Default `docs/zucchini`. */
  catalog?: string
  /** A module exporting `projectSteps`, the project's own step definitions. Default: none. */
  projectSteps?: string
  /** The results file the contract runner writes and the spec view reads. Default `test-results/zucchini.json`. */
  results?: string
  /** The attribute that holds test ids. Default `data-testid`. */
  testIdAttribute?: string
}

export type ResolvedConfig = Required<Omit<ZucchiniConfig, 'projectSteps'>> & Pick<ZucchiniConfig, 'projectSteps'>

export const DEFAULT_CONFIG: ResolvedConfig = {
  contracts: 'src',
  catalog: 'docs/zucchini',
  results: 'test-results/zucchini.json',
  testIdAttribute: DEFAULT_TEST_ID_ATTRIBUTE,
}

/** Types a project config: `export default defineConfig({ ... })`. Returns it unchanged. */
export const defineConfig = (config: ZucchiniConfig) => config
