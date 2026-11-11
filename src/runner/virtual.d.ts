// Provided by the runner's Vite plugin (vitest.ts) during a contract run.
declare module 'virtual:zucchini/runner' {
  import type { StepDefinition } from '../steps/types.ts'
  import type { RunnerSettings } from './runtime.ts'

  export const settings: RunnerSettings
  /** The project's own steps (the config's `projectSteps`), or none. */
  export const projectSteps: readonly StepDefinition[]
}
