// A project with its own steps and its own folders, for the command specs. They run it from a copy, where the
// type-only import below is erased.
import type { LivingSpecConfig } from '../../../src/config/config.ts'

export default {
  contracts: 'contracts',
  catalog: 'catalog',
  projectSteps: 'steps/projectSteps.ts',
} satisfies LivingSpecConfig
