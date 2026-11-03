// Everything the Storybook spec view shows: each contract's view model and the stories without a contract.
// Built in Node by the Vite plugin; the browser only renders it.
import fs from 'node:fs'
import path from 'node:path'

import { bindFeature, parseFeature } from '../contracts/bindings.ts'
import { storyFileFor } from '../contracts/lint.ts'
import { findContracts } from '../contracts/load.ts'
import { buildContractView, type ContractView, type Results, type StoryLink } from './viewModel.ts'

export interface UncoveredView {
  title: string
  componentId?: string
  stories: StoryLink[]
}

export interface SpecData {
  contracts: ContractView[]
  uncovered: UncoveredView[]
  /** When the results were recorded, or null when there are none. */
  ranAt: string | null
}

export const buildSpecData = async ({
  root = process.cwd(),
  dir,
  results,
}: {
  root?: string
  /** The folder holding the contracts and their stories, relative to `root`. */
  dir: string
  /** The results file the contract runner writes, relative to `root`; optional. */
  results?: string
}): Promise<{ spec: SpecData; files: string[] }> => {
  const { features, storyFiles } = await findContracts({ root, dir })
  const resultsFile = results ? path.resolve(root, results) : undefined
  const recorded: Results | null =
    resultsFile && fs.existsSync(resultsFile) ? JSON.parse(fs.readFileSync(resultsFile, 'utf8')) : null

  const contracts: ContractView[] = []
  for (const { file, text } of features) {
    const { doc } = parseFeature(text, file)
    // A feature that doesn't parse is the linter's to report; the view leaves it out.
    if (doc) {
      const storyFile = storyFileFor(file, storyFiles)
      const binding = bindFeature(doc, storyFile)
      contracts.push(await buildContractView({ file, doc, text, binding, storyFile, results: recorded }))
    }
  }

  const covered = new Set(contracts.flatMap((c) => c.scenarios.flatMap((s) => s.stories.map((story) => story.id))))
  const uncovered = storyFiles
    .map((s) => ({
      title: s.title,
      componentId: s.stories[0]?.id.split('--')[0],
      stories: s.stories.filter((story) => !covered.has(story.id)),
    }))
    .filter((s) => s.stories.length)

  return {
    spec: { contracts, uncovered, ranAt: recorded?.ranAt ?? null },
    files: [
      ...features.map((f) => path.resolve(root, f.file)),
      ...storyFiles.map((s) => path.resolve(root, s.file)),
      ...(resultsFile && recorded ? [resultsFile] : []),
    ],
  }
}
