// The deliberate-break check: proves the contracts' passes are real. Each break changes one expectation in a
// contract to a wrong one; the run must then fail on exactly that scenario or Examples row. Node only.
import { bindFeature, parseFeature } from '../contracts/bindings.ts'
import type { ScenarioResult } from '../view/viewModel.ts'

/** One deliberate break: in `file`, the first occurrence of `find` becomes `replace`. */
export interface Break {
  /** A short, unique name to report it by and to pick it with `--break`. */
  name: string
  /** What it shows the contracts catch. */
  checks: string
  /** The contract (feature file) to break, relative to the project root. */
  file: string
  find: string
  replace: string
  /** The devices the broken pickle runs on, when not all (it's in a `@desktop` or `@mobile` Examples block). */
  devices?: readonly string[]
}

/** The pickles a break must make fail: its Examples row, or every pickle of the scenario whose step it changed. */
export interface Target {
  file: string
  /** The line of the change. */
  line: number
  /** The lines of the pickles that must fail (see ScenarioResult's `line`). */
  pickleLines: number[]
}

/** Applies a break to a contract's text. Throws when the text to break isn't there. */
export const applyBreak = (text: string, brk: Break): { text: string; target: Target } => {
  const at = text.indexOf(brk.find)
  if (at < 0) {
    throw new Error(`${brk.file} no longer contains ${JSON.stringify(brk.find)}`)
  }
  const broken = text.slice(0, at) + brk.replace + text.slice(at + brk.find.length)
  const line = text.slice(0, at).split('\n').length
  const { doc, problems } = parseFeature(broken, brk.file)
  if (!doc) {
    throw new Error(`${brk.file} doesn't parse once broken: ${problems.map((p) => p.message).join('; ')}`)
  }
  const { pickles } = bindFeature(doc, undefined)
  const inRow = pickles.filter((p) => p.row?.location.line === line)
  const inScenario = pickles.filter((p) => p.scenario.steps.some((step) => step.location.line === line))
  const hit = inRow.length ? inRow : inScenario
  if (!hit.length) {
    throw new Error(`${brk.file}:${line} is neither an Examples row nor a scenario step`)
  }
  return { text: broken, target: { file: brk.file, line, pickleLines: hit.map((p) => p.line) } }
}

export const isFailure = (result: ScenarioResult) => !['passed', 'skipped', 'pending'].includes(result.status)

const hits = (target: Target, result: ScenarioResult) =>
  result.file === target.file && target.pickleLines.includes(result.line)

export type Verdict =
  /** A pickle it targets failed: the contracts caught it. */
  | { kind: 'caught'; failures: ScenarioResult[]; unexplained: ScenarioResult[] }
  /** Its pickles ran and passed: the contracts missed it. */
  | { kind: 'missed'; unexplained: ScenarioResult[] }
  /** None of its pickles ran, so it proves nothing. */
  | { kind: 'not-run'; unexplained: ScenarioResult[] }

/** Judges one break's run. Any other failure in the run is unexplained: the run wasn't clean. */
export const judge = (target: Target, results: readonly ScenarioResult[]): Verdict => {
  const targeted = results.filter((r) => hits(target, r))
  const unexplained = results.filter((r) => isFailure(r) && !hits(target, r))
  const failures = targeted.filter(isFailure)
  if (failures.length) {
    return { kind: 'caught', failures, unexplained }
  }
  return targeted.length ? { kind: 'missed', unexplained } : { kind: 'not-run', unexplained }
}
