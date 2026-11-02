// Step wording as Cucumber expressions, compiled without a runner, for the catalog and the linter.
import { CucumberExpression, type Node, ParameterTypeRegistry } from '@cucumber/cucumber-expressions'

import type { StepDefinition } from './types.ts'

const PARAMETER_NODE = 'PARAMETER_NODE'

const parameterNames = (node: Node): string[] =>
  node.type === PARAMETER_NODE ? [node.text()] : (node.nodes ?? []).flatMap(parameterNames)

export const compileWording = (wording: string, registry = new ParameterTypeRegistry()) => {
  const expression = new CucumberExpression(wording, registry)
  return {
    /** The expression's parameter types, in order, for example `["string", "int"]`. */
    parameterTypes: parameterNames(expression.ast),
    /** Whether a step text (without its keyword) matches. */
    matches: (text: string) => expression.match(text) !== null,
  }
}

export type CompiledStep<T extends StepDefinition = StepDefinition> = ReturnType<typeof compileWording> & {
  step: T
}

export const compileSteps = <T extends StepDefinition>(steps: readonly T[]): CompiledStep<T>[] => {
  const registry = new ParameterTypeRegistry()
  return steps.map((step) => ({ step, ...compileWording(step.wording, registry) }))
}
