// Checks contract feature files: every step must match exactly one catalog step, and every scenario must
// run on a story that exists. Also lists the stories no contract covers.
import path from 'node:path'

import type { GherkinDocument, Step } from '@cucumber/messages'

import { compileSteps } from '../steps/expressions.ts'
import { bindFeature, componentOf, dedupe, parseFeature, type Problem } from './bindings.ts'
import type { StoryFile } from './stories.ts'

export interface ContractFile {
  file: string
  text: string
}

export interface UncoveredStories {
  title: string
  file: string
  stories: string[]
}

/** Where the catalog's steps come from, named in the hint on unknown and ambiguous steps. */
export interface CatalogSource {
  /** The catalog file, e.g. `docs/living-spec/steps.json`. */
  file: string
  /** The command that regenerates it (the catalog's `generatedBy`). */
  command: string
}

export interface LintResult {
  problems: Problem[]
  uncovered: UncoveredStories[]
  scenarios: number
  stories: number
}

/** The story file beside `featureFile` whose title ends in the feature file's name. */
export const storyFileFor = (featureFile: string, storyFiles: readonly StoryFile[]) => {
  const component = path.basename(featureFile, '.feature')
  const dir = path.dirname(featureFile)
  return storyFiles.find((s) => path.dirname(s.file) === dir && componentOf(s.title) === component)
}

const stepsById = (doc: GherkinDocument) => {
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

export const lintContracts = ({
  features,
  storyFiles,
  steps,
  catalog,
}: {
  features: readonly ContractFile[]
  storyFiles: readonly StoryFile[]
  /** The catalog's steps; only their wording matters for matching. */
  steps: readonly { wording: string }[]
  catalog?: CatalogSource
}): LintResult => {
  const compiled = compileSteps(steps)
  const catalogName = catalog?.file ?? 'the step catalog'
  // A step added to the code but not yet to the committed catalog shows up as unknown, so say how to fix that.
  const hint = `If you just added or changed a step definition, run ${catalog ? `\`${catalog.command}\`` : 'the catalog command'}.`
  const problems: Problem[] = []
  const covered = new Set<string>()
  let scenarios = 0

  for (const { file, text } of features) {
    const parsed = parseFeature(text, file)
    problems.push(...parsed.problems)
    if (!parsed.doc) {
      continue
    }
    const storyFile = storyFileFor(file, storyFiles)
    if (!storyFile) {
      const component = path.basename(file, '.feature')
      problems.push({ file, line: 1, message: `no story file beside it has a title ending in "${component}"` })
    }

    const binding = bindFeature(parsed.doc, storyFile)
    problems.push(...binding.problems)
    scenarios += new Set(binding.pickles.map((p) => p.scenario.id)).size

    const astSteps = stepsById(parsed.doc)
    for (const bound of binding.pickles) {
      if (storyFile && bound.story) {
        covered.add(`${storyFile.file}::${bound.story}`)
      }
      for (const pickleStep of bound.pickle.steps) {
        const astStep = astSteps.get(pickleStep.astNodeIds[0])
        const line = astStep?.location.line ?? bound.line
        const written = `${astStep?.keyword.trim() ?? ''} ${pickleStep.text}`.trim()
        const matches = compiled.filter((c) => c.matches(pickleStep.text))
        if (matches.length === 0) {
          problems.push({
            file,
            line,
            message: `unknown step "${written}": no step in ${catalogName} matches it. ${hint}`,
          })
        } else if (matches.length > 1) {
          problems.push({
            file,
            line,
            message: `ambiguous step "${written}" matches ${matches.length} steps in ${catalogName}: ${matches.map((m) => `"${m.step.wording}"`).join(', ')}. ${hint}`,
          })
        }
      }
    }
  }

  const uncovered = storyFiles
    .map((s) => ({
      title: s.title,
      file: s.file,
      stories: s.stories.map((story) => story.name).filter((name) => !covered.has(`${s.file}::${name}`)),
    }))
    .filter((s) => s.stories.length)

  return {
    problems: dedupe(problems).sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line),
    uncovered,
    scenarios,
    stories: storyFiles.reduce((n, s) => n + s.stories.length, 0),
  }
}

export const formatLintResult = (result: LintResult, featureCount: number) => {
  const uncoveredCount = result.uncovered.reduce((n, s) => n + s.stories.length, 0)
  const lines = [
    ...result.problems.map((p) => `${p.file}:${p.line}: ${p.message}`),
    ...(result.problems.length ? [''] : []),
    `Stories without a contract: ${uncoveredCount} of ${result.stories}`,
    ...result.uncovered.map((s) => `  ${s.title} (${s.file}): ${s.stories.join(', ')}`),
    '',
    result.problems.length
      ? `${result.problems.length} problem${result.problems.length === 1 ? '' : 's'} in ${featureCount} contract files.`
      : `${featureCount} contract files, ${result.scenarios} scenarios: no problems.`,
  ]
  return `${lines.join('\n')}\n`
}
