// The spec view's model: a contract feature, its story bindings and optional results, turned into what a
// reader sees. Scenarios keep their steps in order; a `#` comment line among the steps starts a named group
// that runs to the next comment or blank line. Each scenario shows the stories it runs on and its last
// result: passed, failed, changed since its last run, or not run yet.
import type { GherkinDocument, Step } from '@cucumber/messages'

import { type BoundPickle, type FeatureBinding, scenariosOf } from '../contracts/bindings.ts'
import type { StoryFile } from '../contracts/stories.ts'
import { pickleHash } from './pickleHash.ts'

/** `changed`: it has results, but only for an earlier version of its steps or Examples values. */
export type Status = 'passed' | 'failed' | 'changed' | 'not-run'

/** One recorded run of one pickle: a scenario, or one Examples row of an outline. */
export interface ScenarioResult {
  /** The feature file, named as the spec view names it. */
  file: string
  /** The line that selects the pickle: its Examples row, or the scenario. */
  line: number
  /**
   * Cucumber's pickle name: the scenario's name, with an outline row's values in its `<placeholders>`. When
   * present, it must still be the name of the pickle at `line`, or the result is ignored: the scenario was
   * moved or renamed since it ran. A result without a name is matched by `file` and `line` alone.
   */
  name?: string
  /** The browser and device it ran on: a free label such as `webkit-mobile`. */
  browser?: string
  /**
   * The pickle's content hash when it ran (see pickleHash). When present and no longer the pickle's hash, the
   * scenario was edited since: the result is stale and the pickle shows as changed since its last run. A
   * result without a hash is taken as current.
   */
  hash?: string
  /** Cucumber's result status, lower-case: passed, failed, skipped, pending, undefined, ambiguous... */
  status: string
  durationMs?: number
  error?: string
  /** When it ran (ISO 8601); defaults to the results file's `ranAt`. */
  ranAt?: string
}

/** The results file the contract runner writes. */
export interface Results {
  ranAt: string
  scenarios: ScenarioResult[]
}

export interface StepView {
  keyword: string
  text: string
  line: number
}

export interface StepGroupView {
  /** The comment that names the group; absent for steps outside any group. */
  title?: string
  steps: StepView[]
}

export interface StoryLink {
  name: string
  id: string
}

export interface ExampleRowView {
  line: number
  cells: string[]
  story?: StoryLink
  status: Status
  /** The browsers it failed on, from the results' `browser` labels. */
  failedOn: string[]
}

export interface ExamplesView {
  name: string
  header: string[]
  rows: ExampleRowView[]
}

export interface ScenarioView {
  name: string
  line: number
  description: string
  groups: StepGroupView[]
  examples: ExamplesView[]
  /** The stories it runs on, in order of first appearance. */
  stories: StoryLink[]
  status: Status
  /** The browsers any of its pickles failed on, from the results' `browser` labels. */
  failedOn: string[]
  /** When its latest result was recorded. */
  ranAt?: string
  /** The first failure's message. */
  error?: string
}

export interface ContractView {
  file: string
  /** The title of the story file the contract covers. */
  title: string
  /** Storybook's component id, the prefix of its story ids. */
  componentId?: string
  name: string
  description: string
  scenarios: ScenarioView[]
  status: Status
}

const commentText = (text: string) => text.trim().replace(/^#\s*/, '').trim()

const lastLineOf = (step: Step) => {
  const rows = step.dataTable?.rows ?? []
  return rows.length ? rows[rows.length - 1].location.line : step.location.line
}

/**
 * Groups steps by the source lines between them: a comment line starts a group named by it, and the group
 * runs to the next comment or blank line. Steps outside any group form unnamed groups.
 */
export const groupSteps = ({
  steps,
  after,
  comments,
  lines,
}: {
  steps: readonly Step[]
  /** The line just before the first step (the scenario's line). */
  after: number
  comments: GherkinDocument['comments']
  /** The feature file's source lines. */
  lines: readonly string[]
}): StepGroupView[] => {
  const commentAt = new Map(comments.map((c) => [c.location.line, commentText(c.text)]))
  const groups: StepGroupView[] = []
  let current: StepGroupView | undefined
  let previousEnd = after
  for (const step of steps) {
    let title: string | undefined
    let blank = false
    for (let line = previousEnd + 1; line < step.location.line; line++) {
      const comment = commentAt.get(line)
      if (comment !== undefined) {
        title = comment
        blank = false
      } else if (!lines[line - 1]?.trim()) {
        blank = true
      }
    }
    if (title !== undefined && !blank) {
      current = { title, steps: [] }
      groups.push(current)
    } else if (blank || !current) {
      current = { steps: [] }
      groups.push(current)
    }
    current.steps.push({ keyword: step.keyword.trim(), text: step.text, line: step.location.line })
    previousEnd = lastLineOf(step)
  }
  return groups
}

const isFailure = (result: ScenarioResult) => !['passed', 'skipped', 'pending'].includes(result.status)

const statusOf = (results: readonly ScenarioResult[]): Status => {
  if (results.some(isFailure)) {
    return 'failed'
  }
  return results.length && results.every((r) => r.status === 'passed') ? 'passed' : 'not-run'
}

const overall = (statuses: readonly Status[]): Status => {
  if (statuses.includes('failed')) {
    return 'failed'
  }
  if (statuses.length && statuses.every((s) => s === 'passed')) {
    return 'passed'
  }
  return statuses.includes('changed') ? 'changed' : 'not-run'
}

/** A pickle's results for its current content, and those recorded for an earlier version of it. */
interface PickleRuns {
  current: ScenarioResult[]
  stale: ScenarioResult[]
}

const statusOfRuns = ({ current, stale }: PickleRuns): Status => {
  if (current.length) {
    return statusOf(current)
  }
  return stale.length ? 'changed' : 'not-run'
}

const failedBrowsers = (results: readonly ScenarioResult[]) => [
  ...new Set(results.filter(isFailure).flatMap((r) => (r.browser ? [r.browser] : []))),
]

const uniqueStories = (stories: readonly (StoryLink | undefined)[]) => {
  const byId = new Map<string, StoryLink>()
  for (const story of stories) {
    if (story && !byId.has(story.id)) {
      byId.set(story.id, story)
    }
  }
  return [...byId.values()]
}

export const buildContractView = async ({
  file,
  doc,
  text,
  binding,
  storyFile,
  results,
}: {
  /** The feature file, as results name it. */
  file: string
  doc: GherkinDocument
  /** The feature file's source, for the blank lines between steps. */
  text: string
  binding: FeatureBinding
  storyFile?: StoryFile
  results?: Results | null
}): Promise<ContractView> => {
  const lines = text.split(/\r?\n/)
  const storyIds = new Map(storyFile?.stories.map((s) => [s.name, s.id]))
  const linkTo = (name: string | undefined): StoryLink | undefined => {
    const id = name === undefined ? undefined : storyIds.get(name)
    return name !== undefined && id !== undefined ? { name, id } : undefined
  }
  const hashes = new Map(
    await Promise.all(binding.pickles.map(async (bound) => [bound, await pickleHash(bound.content)] as const))
  )
  // A result belongs to a pickle when it names the pickle's file and line and, if it records a name, the
  // pickle's name. It is stale when it records a content hash that is no longer the pickle's.
  const isResultOf = (result: ScenarioResult, bound: BoundPickle) =>
    result.file === file &&
    result.line === bound.line &&
    (result.name === undefined || result.name === bound.pickle.name)
  const runsOf = (bound: BoundPickle | undefined): PickleRuns => {
    const runs: PickleRuns = { current: [], stale: [] }
    for (const result of results?.scenarios ?? []) {
      if (bound && isResultOf(result, bound)) {
        const stale = result.hash !== undefined && result.hash !== hashes.get(bound)
        runs[stale ? 'stale' : 'current'].push({ ...result, ranAt: result.ranAt ?? results?.ranAt })
      }
    }
    return runs
  }

  const scenarios = scenariosOf(doc).map((scenario): ScenarioView => {
    const pickles: BoundPickle[] = binding.pickles.filter((b) => b.scenario.id === scenario.id)
    const pickleOfRow = new Map(pickles.flatMap((b) => (b.row ? [[b.row.id, b] as const] : [])))
    const runs = pickles.map(runsOf)
    const current = runs.flatMap((r) => r.current)
    // Passed only once every pickle (each Examples row) has passed.
    const status = overall(runs.map(statusOfRuns))
    return {
      name: scenario.name,
      line: scenario.location.line,
      description: scenario.description.trim(),
      groups: groupSteps({ steps: scenario.steps, after: scenario.location.line, comments: doc.comments, lines }),
      examples: scenario.examples.map((examples) => ({
        name: examples.name,
        header: (examples.tableHeader?.cells ?? []).map((cell) => cell.value),
        rows: examples.tableBody.map((row) => {
          const bound = pickleOfRow.get(row.id)
          const rowRuns = runsOf(bound)
          return {
            line: row.location.line,
            cells: row.cells.map((cell) => cell.value),
            story: linkTo(bound?.story),
            status: statusOfRuns(rowRuns),
            failedOn: failedBrowsers(rowRuns.current),
          }
        }),
      })),
      stories: uniqueStories(pickles.map((b) => linkTo(b.story))),
      status,
      failedOn: failedBrowsers(current),
      ranAt: runs
        .flatMap((r) => [...r.current, ...r.stale])
        .flatMap((r) => (r.ranAt ? [r.ranAt] : []))
        .sort()
        .pop(),
      error: current.find(isFailure)?.error,
    }
  })

  return {
    file,
    title: storyFile?.title ?? '',
    componentId: storyFile?.stories[0]?.id.split('--')[0],
    name: doc.feature?.name ?? '',
    description: doc.feature?.description.trim() ?? '',
    scenarios,
    status: overall(scenarios.map((s) => s.status)),
  }
}
