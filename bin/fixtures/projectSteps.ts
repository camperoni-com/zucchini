import type { StepDefinition } from '../../src/steps/types.ts'

export const projectSteps: StepDefinition[] = [
  {
    keyword: 'Given',
    wording: 'I am in the {string} metro',
    meaning: 'Picks a metro.',
    example: 'I am in the "Bay Area" metro',
    run: async () => undefined,
  },
]
