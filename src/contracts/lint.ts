// Checks contract feature files: every step must match exactly one catalog step, and every scenario must
// run on a story that exists. Also lists the stories no contract covers.
import path from 'node:path'

import { discouragedText } from '../catalog/catalog.ts'
import { compileSteps } from '../steps/expressions.ts'
import type { Discouraged } from '../steps/types.ts'
import { bindFeature, componentOf, dedupe, parseFeature, type Problem, stepsById } from './bindings.ts'
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
  /** The catalog file, e.g. `docs/zucchini/steps.json`. */
  file: string
  /** The command that regenerates it (the catalog's `generatedBy`). */
  command: string
}

export interface LintResult {
  problems: Problem[]
  /** Uses of discouraged steps. They don't fail the lint. */
  warnings: Problem[]
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

export const lintContracts = ({
  features,
  storyFiles,
  steps,
  catalog,
}: {
  features: readonly ContractFile[]
  storyFiles: readonly StoryFile[]
  /** The catalog's steps: their wording for matching, and whether they're discouraged. */
  steps: readonly { wording: string; discouraged?: Discouraged }[]
  catalog?: CatalogSource
}): LintResult => {
  const compiled = compileSteps(steps)
  const catalogName = catalog?.file ?? 'the step catalog'
  // A step added to the code but not yet to the committed catalog shows up as unknown, so say how to fix that.
  const hint = `If you just added or changed a step definition, run ${catalog ? `\`${catalog.command}\`` : 'the catalog command'}.`
  const problems: Problem[] = []
  const warnings: Problem[] = []
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
        } else if (matches[0].step.discouraged) {
          warnings.push({
            file,
            line,
            message: `discouraged step "${written}": ${discouragedText(matches[0].step.discouraged)}`,
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

  const byPlace = (a: Problem, b: Problem) => a.file.localeCompare(b.file) || a.line - b.line
  return {
    problems: dedupe(problems).sort(byPlace),
    // An Examples table repeats its steps per row; one warning per line is enough.
    warnings: dedupe(warnings).sort(byPlace),
    uncovered,
    scenarios,
    stories: storyFiles.reduce((n, s) => n + s.stories.length, 0),
  }
}

export const formatLintResult = (result: LintResult, featureCount: number) => {
  const uncoveredCount = result.uncovered.reduce((n, s) => n + s.stories.length, 0)
  const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`
  const warnings = result.warnings.length ? `, ${plural(result.warnings.length, 'warning')}` : ''
  const lines = [
    ...result.problems.map((p) => `${p.file}:${p.line}: ${p.message}`),
    ...result.warnings.map((w) => `${w.file}:${w.line}: warning: ${w.message}`),
    ...(result.problems.length || result.warnings.length ? [''] : []),
    `Stories without a contract: ${uncoveredCount} of ${result.stories}`,
    ...result.uncovered.map((s) => `  ${s.title} (${s.file}): ${s.stories.join(', ')}`),
    '',
    result.problems.length
      ? `${plural(result.problems.length, 'problem')} in ${featureCount} contract files${warnings}.`
      : `${featureCount} contract files, ${result.scenarios} scenarios: no problems${warnings}.`,
  ]
  return `${lines.join('\n')}\n`
}
