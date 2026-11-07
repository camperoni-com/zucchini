// Which lines run on which story, worked out in Node before the run. Node only.
import path from 'node:path'

import { bindFeature, parseFeature, type Problem } from '../contracts/bindings.ts'
import { storyFileFor } from '../contracts/lint.ts'
import { findContracts } from '../contracts/load.ts'
import { type Device, DEVICES } from './devices.ts'

/** A story's contract: its feature file, relative to the project root, and the lines that select its pickles. */
export interface StoryRun {
  file: string
  lines: number[]
}

export interface RunBindings {
  /** By Storybook story id. */
  stories: Record<string, StoryRun>
  /** The story files that have a contract beside them, relative to the project root. */
  storyFiles: string[]
  problems: Problem[]
}

/** True when a pickle with these tags runs on `device`: it names no other device. */
export const runsOn = (tags: readonly string[], device: Device) =>
  !DEVICES.some((other) => other !== device && tags.includes(`@${other}`))

export const computeRunBindings = async ({
  root,
  dir,
  device,
}: {
  root: string
  /** The folder holding the contracts and their stories, relative to `root`. */
  dir: string
  device: Device
}): Promise<RunBindings> => {
  const { features, storyFiles } = await findContracts({ root, dir })
  const stories: Record<string, StoryRun> = {}
  const covered = new Set<string>()
  const problems: Problem[] = []

  for (const { file, text } of features) {
    const parsed = parseFeature(text, file)
    problems.push(...parsed.problems)
    if (!parsed.doc) {
      continue
    }
    const storyFile = storyFileFor(file, storyFiles)
    if (!storyFile) {
      problems.push({
        file,
        line: 1,
        message: `no story file beside it has a title ending in "${path.basename(file, '.feature')}"`,
      })
      continue
    }
    covered.add(storyFile.file)
    const binding = bindFeature(parsed.doc, storyFile)
    problems.push(...binding.problems)
    for (const bound of binding.pickles) {
      const story = storyFile.stories.find((s) => s.name === bound.story)
      const tags = bound.pickle.tags.map((tag) => tag.name)
      if (!story || !runsOn(tags, device)) {
        continue
      }
      const run = (stories[story.id] ??= { file, lines: [] })
      run.lines.push(bound.line)
    }
  }

  return { stories, storyFiles: [...covered].sort(), problems }
}
