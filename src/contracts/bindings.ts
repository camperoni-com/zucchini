// Which scenario runs on which story. The convention:
// - `<Component>.feature` sits beside the story file whose title ends in `<Component>` and holds its contracts;
// - a `@story:Story_Name` tag binds a scenario to one story (`_` stands for a space, since Gherkin tags can't
//   contain one);
// - a `story` column in an outline's Examples binds each row to the story it names;
// - scenario titles are free text.
import { AstBuilder, compile, GherkinClassicTokenMatcher, Parser } from '@cucumber/gherkin'
import type { GherkinDocument, Pickle, Scenario, Step, TableRow } from '@cucumber/messages'
import { IdGenerator } from '@cucumber/messages'

import type { PickleContent } from '../view/pickleHash.ts'
import type { StoryFile } from './stories.ts'

export const STORY_TAG = '@story:'
export const STORY_COLUMN = 'story'

export const storyFromTag = (tag: string) => tag.slice(STORY_TAG.length).replaceAll('_', ' ')
export const tagForStory = (name: string) => `${STORY_TAG}${name.replaceAll(' ', '_')}`

/** The last segment of a story title, which names the feature file: `Camperoni/Cards/CampItem` -> `CampItem`. */
export const componentOf = (title: string) => title.split('/').pop() ?? title

export interface Problem {
  file: string
  line: number
  message: string
}

type ParserError = { message: string; location?: { line: number } }

/** Parses a feature file; a file that doesn't parse comes back as problems with the parser's lines. */
export const parseFeature = (text: string, file: string): { doc?: GherkinDocument; problems: Problem[] } => {
  const parser = new Parser(new AstBuilder(IdGenerator.incrementing()), new GherkinClassicTokenMatcher())
  try {
    return { doc: { ...parser.parse(text), uri: file }, problems: [] }
  } catch (error) {
    const errors = (error as { errors?: ParserError[] }).errors ?? [error as ParserError]
    return {
      problems: errors.map((e) => ({
        file,
        line: e.location?.line ?? 1,
        // The parser prefixes "(line:column): "; the problem already says where.
        message: e.message.replace(/^\(\d+:\d+\): /, ''),
      })),
    }
  }
}

export const scenariosOf = (doc: GherkinDocument): Scenario[] =>
  (doc.feature?.children ?? []).flatMap((child) => [
    ...(child.scenario ? [child.scenario] : []),
    ...(child.rule?.children ?? []).flatMap((ruleChild) => (ruleChild.scenario ? [ruleChild.scenario] : [])),
  ])

/** Every step of a parsed feature (Background steps included), by id. */
export const stepsById = (doc: GherkinDocument) => {
  const steps = new Map<string, Step>()
  const add = (list: readonly Step[] | undefined) => list?.forEach((step) => steps.set(step.id, step))
  for (const child of doc.feature?.children ?? []) {
    add(child.background?.steps)
    add(child.scenario?.steps)
    for (const ruleChild of child.rule?.children ?? []) {
      add(ruleChild.background?.steps)
      add(ruleChild.scenario?.steps)
    }
  }
  return steps
}

export interface BoundPickle {
  pickle: Pickle
  scenario: Scenario
  /** The Examples row this pickle comes from, if it comes from an outline. */
  row?: TableRow
  /** The line that selects this pickle: its Examples row, or the scenario. */
  line: number
  /** The story it runs on, when the binding is valid. */
  story?: string
  /** What its content hash covers: its name, its steps as they run and its Examples values. */
  content: PickleContent
}

export interface FeatureBinding {
  pickles: BoundPickle[]
  problems: Problem[]
}

const rowOf = (scenario: Scenario, rowId: string | undefined) => {
  for (const examples of scenario.examples) {
    const row = examples.tableBody.find((r) => r.id === rowId)
    if (row) {
      const column = (examples.tableHeader?.cells ?? []).findIndex((cell) => cell.value === STORY_COLUMN)
      return { row, story: column >= 0 ? row.cells[column].value : undefined }
    }
  }
  return undefined
}

/** Binds each pickle of a parsed feature to a story of `storyFile` (or reports why it can't). */
export const bindFeature = (doc: GherkinDocument, storyFile: StoryFile | undefined): FeatureBinding => {
  const file = doc.uri ?? ''
  const problems: Problem[] = []
  const scenarios = new Map(scenariosOf(doc).map((scenario) => [scenario.id, scenario]))
  const known = new Set(storyFile?.stories.map((story) => story.name))
  const pickles: BoundPickle[] = []
  const astSteps = stepsById(doc)

  for (const pickle of compile(doc, file, IdGenerator.incrementing())) {
    const scenario = scenarios.get(pickle.astNodeIds[0])
    if (!scenario) {
      continue
    }
    const fromRow = rowOf(scenario, pickle.astNodeIds[1])
    const bound: BoundPickle = {
      pickle,
      scenario,
      row: fromRow?.row,
      line: fromRow?.row.location.line ?? scenario.location.line,
      content: {
        name: pickle.name,
        steps: pickle.steps.map((step) => ({
          keyword: astSteps.get(step.astNodeIds[0])?.keyword.trim() ?? '',
          text: step.text,
        })),
        values: fromRow?.row.cells.map((cell) => cell.value) ?? [],
      },
    }
    pickles.push(bound)

    const scenarioLine = scenario.location.line
    const tagged = [
      ...new Set(pickle.tags.filter((t) => t.name.startsWith(STORY_TAG)).map((t) => storyFromTag(t.name))),
    ]
    if (tagged.length > 1) {
      problems.push({
        file,
        line: scenarioLine,
        message: `"${pickle.name}" has more than one ${STORY_TAG} tag (${tagged.join(', ')})`,
      })
      continue
    }
    if (tagged.length && fromRow?.story !== undefined) {
      problems.push({
        file,
        line: scenarioLine,
        message: `"${pickle.name}" has both a ${STORY_TAG} tag and a "${STORY_COLUMN}" column; use one`,
      })
      continue
    }
    const story = tagged[0] ?? fromRow?.story
    if (story === undefined) {
      problems.push({
        file,
        line: scenarioLine,
        message: `"${pickle.name}" names no story: add a ${STORY_TAG}<Story_Name> tag or a "${STORY_COLUMN}" column`,
      })
      continue
    }
    if (!storyFile) {
      continue
    }
    if (!known.has(story)) {
      // A tag names the story once for the whole scenario; a column names it on each row.
      problems.push({
        file,
        line: tagged.length ? scenarioLine : bound.line,
        message:
          `story "${story}" is not in ${storyFile.title}. ` +
          `Its stories: ${storyFile.stories.map((s) => s.name).join(', ')}`,
      })
      continue
    }
    bound.story = story
  }

  return { pickles, problems: dedupe(problems) }
}

export const dedupe = (problems: Problem[]) => {
  const seen = new Set<string>()
  return problems.filter((p) => {
    const key = `${p.file}:${p.line}:${p.message}`
    return seen.has(key) ? false : (seen.add(key), true)
  })
}
