// Registers the library's steps, and the project's own, with Cucumber. The runner's Given/When/Then
// are passed in, so the library doesn't depend on a particular Cucumber runner.
import { librarySteps } from './library.ts'
import type { StepContext, StepDefinition, StepKeyword } from './types.ts'

export type DefineStep = (pattern: string, code: (this: unknown, ...args: unknown[]) => Promise<void>) => void

export type CucumberDefiners = Record<StepKeyword, DefineStep>

export const registerSteps = (
  cucumber: CucumberDefiners,
  { context, projectSteps = [] }: { context: StepContext; projectSteps?: readonly StepDefinition[] }
) => {
  const steps = [...librarySteps, ...projectSteps]
  const seen = new Set<string>()
  for (const step of steps) {
    if (seen.has(step.wording)) {
      throw new Error(`Step defined twice: "${step.wording}"`)
    }
    seen.add(step.wording)
    cucumber[step.keyword](step.wording, (...args: unknown[]) => step.run(context, ...args))
  }
  return steps
}
