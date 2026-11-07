import type { Given, Then, When } from '@cucumber/cucumber'
import { describe, expect, expectTypeOf, test, vi } from 'vitest'

import { createStepContext } from './dom.ts'
import { librarySteps } from './library.ts'
import { type CucumberDefiners, registerSteps } from './register.ts'
import type { StepDefinition } from './types.ts'

const fakeCucumber = () => ({ Given: vi.fn(), When: vi.fn(), Then: vi.fn() })

const context = createStepContext({
  driver: { click: vi.fn(), hover: vi.fn(), setGeolocation: vi.fn() },
  document: {} as Document,
})

const projectStep: StepDefinition = {
  keyword: 'Given',
  wording: 'I am on the {string} metro',
  meaning: 'Picks a metro.',
  example: 'I am on the "sf" metro',
  run: vi.fn(async () => undefined),
}

describe('registerSteps', () => {
  test('accepts the Given, When and Then of @cucumber/cucumber', () => {
    expectTypeOf<{ Given: typeof Given; When: typeof When; Then: typeof Then }>().toMatchTypeOf<CucumberDefiners>()
  })

  test('registers each library step under its keyword and wording', () => {
    const cucumber = fakeCucumber()
    registerSteps(cucumber, { context })
    const registered = [...cucumber.Then.mock.calls, ...cucumber.When.mock.calls].map(([wording]) => wording)
    expect(registered.sort()).toEqual(librarySteps.map((step) => step.wording).sort())
    expect(cucumber.Given).not.toHaveBeenCalled()
  })

  test('registers the project steps the same way, after the library', () => {
    const cucumber = fakeCucumber()
    const steps = registerSteps(cucumber, { context, projectSteps: [projectStep] })
    expect(cucumber.Given).toHaveBeenCalledWith('I am on the {string} metro', expect.any(Function))
    expect(steps).toEqual([...librarySteps, projectStep])
  })

  test('runs a step with the context and the matched values', async () => {
    const cucumber = fakeCucumber()
    registerSteps(cucumber, { context, projectSteps: [projectStep] })
    const code = cucumber.Given.mock.calls[0][1]
    await code.call({}, 'sf')
    expect(projectStep.run).toHaveBeenCalledWith(context, 'sf')
  })

  test('gives each step function one argument per parameter, as Cucumber requires', () => {
    const cucumber = fakeCucumber()
    registerSteps(cucumber, { context, projectSteps: [projectStep] })
    const arity = (wording: string) =>
      [...cucumber.Given.mock.calls, ...cucumber.When.mock.calls, ...cucumber.Then.mock.calls].find(
        ([registered]) => registered === wording
      )?.[1].length
    expect(arity('I am on the {string} metro')).toBe(1)
    expect(arity('I {string} geolocation and set the location to {string}, {string}')).toBe(3)
  })

  test('refuses a project step that redefines a library step', () => {
    const clash = { ...projectStep, keyword: 'When' as const, wording: librarySteps[0].wording }
    expect(() => registerSteps(fakeCucumber(), { context, projectSteps: [clash] })).toThrow(
      `Step defined twice: "${librarySteps[0].wording}"`
    )
  })
})
