// Storybook's side of the runner: a project-level `afterEach` that runs the contracts bound to the story that
// just rendered. Wire it in the project's preview, so no story file needs a `play` function:
//
//   // .storybook/preview.ts
//   afterEach: runStoryContracts,
//   parameters: { viewport: { options: { ...INITIAL_VIEWPORTS, ...contractViewports } } },
//
// Browser-safe and free of runner imports: in a normal Storybook (dev or the static build), no runner is
// published and it does nothing.
import { runtime, type StoryHandle } from './runtime.ts'

export { contractViewports } from './devices.ts'

export const runStoryContracts = async (story: StoryHandle) => {
  const runner = runtime()
  const run = runner?.settings.stories[story.id]
  if (!runner || !run) {
    // Not a contract run, or a story without a contract: rendering it was the whole test.
    return
  }

  const featurePath = `${runner.settings.root}/${run.file}`
  // The runner hands `id` to Cucumber as a path, so `file:line:line` selects exactly the scenarios and Examples
  // rows bound to this story (and to this device).
  const id = `${featurePath}:${run.lines.join(':')}`
  const storyKey = crypto.randomUUID()
  runner.stories.set(storyKey, { story, file: run.file, started: 0 })

  try {
    const { results } = await runner.runCucumber({ id, config: { worldParameters: { storyKey } } })
    const failed = results.find((result) => result.error)
    if (failed?.error) {
      // Point the stack frames at the feature file, not at the id with its lines.
      failed.error.stack = failed.error.stack?.replaceAll(`${id}:`, `${featurePath}:`)
      throw failed.error
    }
    // Each bound line selects one pickle; fewer results would mean a contract silently stopped running.
    if (results.length !== run.lines.length) {
      throw new Error(`${run.file}: ${run.lines.length} scenarios are bound to ${story.id}, but ${results.length} ran`)
    }
  } finally {
    runner.stories.delete(storyKey)
  }
}
