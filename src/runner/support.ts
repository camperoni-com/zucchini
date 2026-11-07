// Cucumber support code for a contract run (browser side), loaded by @lotun/vitest-cucumber. It registers the
// library's steps and the project's over the Vitest driver, gives each scenario after the first on a story a
// fresh mount, and records every pickle's result in the results file's format.
import { After, Before, Given, setDefaultTimeout, Then, When, World } from '@cucumber/cucumber'
import type { GherkinDocument, Pickle } from '@cucumber/messages'
import { projectSteps, settings } from 'virtual:living-spec/runner'
import { commands } from 'vitest/browser'

import { createStepContext } from '../steps/dom.ts'
import { type DefineStep, registerSteps } from '../steps/register.ts'
import { type PickleContent, pickleHash } from '../view/pickleHash.ts'
import { vitestDriver } from './driver.ts'
import { runtime, type StoryEntry, type WorldParameters } from './runtime.ts'

// The old E2E steps' default (e2e/steps/hooks.js).
setDefaultTimeout(30 * 1000)

registerSteps(
  { Given: Given as DefineStep, When: When as DefineStep, Then: Then as DefineStep },
  {
    context: createStepContext({ driver: vitestDriver, testIdAttribute: settings.testIdAttribute }),
    projectSteps,
  }
)

type ContractWorld = World<WorldParameters> & { entry?: StoryEntry; startedAt?: number }

const entryOf = (world: ContractWorld) => {
  const key = world.parameters.storyKey ?? ''
  const entry = runtime()?.stories.get(key)
  if (!entry) {
    throw new Error(`No story is being run for key "${key}"`)
  }
  return entry
}

Before(async function (this: ContractWorld) {
  await commands.livingSpecResetPointer()
  const entry = entryOf(this)
  // The story already rendered for its first scenario. Each further one gets a fresh mount, like the old
  // E2E's page load per scenario.
  if (entry.started > 0) {
    await entry.story.renderToCanvas?.()
  }
  entry.started += 1
  this.entry = entry
  this.startedAt = performance.now()
})

/** The pickle's line (its Examples row, or its scenario) and what its content hash covers (see pickleHash). */
const describePickle = (doc: GherkinDocument, pickle: Pickle): { line: number; content: PickleContent } => {
  const [scenarioId, rowId] = pickle.astNodeIds
  const children = (doc.feature?.children ?? []).flatMap((child) => [child, ...(child.rule?.children ?? [])])
  const scenario = children.find((child) => child.scenario?.id === scenarioId)?.scenario
  const keywords = new Map(
    children
      .flatMap((child) => [...(child.background?.steps ?? []), ...(child.scenario?.steps ?? [])])
      .map((step) => [step.id, step.keyword.trim()])
  )
  const row = scenario?.examples.flatMap((examples) => examples.tableBody).find((r) => r.id === rowId)
  return {
    line: row?.location.line ?? scenario?.location.line ?? 0,
    content: {
      name: pickle.name,
      steps: pickle.steps.map((step) => ({ keyword: keywords.get(step.astNodeIds[0]) ?? '', text: step.text })),
      values: row?.cells.map((cell) => cell.value) ?? [],
    },
  }
}

After(async function (this: ContractWorld, { gherkinDocument, pickle, result }) {
  const { line, content } = describePickle(gherkinDocument, pickle)
  await commands.livingSpecRecord({
    file: this.entry?.file ?? pickle.uri,
    line,
    name: pickle.name,
    browser: settings.browser,
    hash: await pickleHash(content),
    status: String(result?.status ?? 'unknown').toLowerCase(),
    durationMs: Math.round(performance.now() - (this.startedAt ?? performance.now())),
    // The failure's first line, without the "Error: " Cucumber puts in front.
    ...(result?.message ? { error: result.message.split('\n')[0].replace(/^Error: /, '') } : {}),
    ranAt: new Date().toISOString(),
  })
})
