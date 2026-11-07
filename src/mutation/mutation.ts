// The deliberate-break check: proves the contracts' passes are real. Two kinds of break:
//  * a contract break changes one expectation in a feature file to a wrong one; the run must then fail on
//    exactly that scenario or Examples row (the steps really check what they claim);
//  * a code break puts a realistic bug in the code a story renders; the contracts it names must then fail
//    somewhere (the contracts would catch that regression).
// Node only.
import { bindFeature, parseFeature } from '../contracts/bindings.ts'
import type { ScenarioResult } from '../view/viewModel.ts'

/** One deliberate break: in `file`, the first occurrence of `find` becomes `replace`. */
export interface Break {
  /** A short, unique name to report it by and to pick it with `--break`. */
  name: string
  /** What it shows the contracts catch. */
  checks: string
  /**
   * The file to break, relative to the project root: a contract (`.feature`), or the code a story renders
   * (a code break, which must name its `contracts`).
   */
  file: string
  find: string
  replace: string
  /** A code break's contracts (feature files): they run, and at least one of their pickles must fail. */
  contracts?: readonly string[]
  /** The devices the broken pickle runs on, when not all (it's in a `@desktop` or `@mobile` Examples block). */
  devices?: readonly string[]
}

/**
 * What a break must make fail. A contract break: its Examples row, or every pickle of the scenario whose step it
 * changed. A code break: any pickle of its contracts.
 */
export type Target =
  | {
      kind: 'contract'
      file: string
      /** The line of the change. */
      line: number
      /** The lines of the pickles that must fail (see ScenarioResult's `line`). */
      pickleLines: number[]
    }
  | {
      kind: 'code'
      file: string
      /** The line of the change. */
      line: number
      /** The contracts that must fail somewhere. */
      contracts: readonly string[]
    }

/** A break in anything but a feature file is a code break. */
export const isCodeBreak = (brk: Break) => !brk.file.endsWith('.feature')

const replaceFirst = (text: string, brk: Break) => {
  const at = text.indexOf(brk.find)
  if (at < 0) {
    throw new Error(`${brk.file} no longer contains ${JSON.stringify(brk.find)}`)
  }
  return {
    broken: text.slice(0, at) + brk.replace + text.slice(at + brk.find.length),
    line: text.slice(0, at).split('\n').length,
  }
}

/** Applies a break to its file's text. Throws when the text to break isn't there. */
export const applyBreak = (text: string, brk: Break): { text: string; target: Target } => {
  const { broken, line } = replaceFirst(text, brk)
  if (isCodeBreak(brk)) {
    if (!brk.contracts?.length) {
      throw new Error(`${brk.name} breaks code (${brk.file}), so it must name the contracts that should catch it`)
    }
    return { text: broken, target: { kind: 'code', file: brk.file, line, contracts: brk.contracts } }
  }
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
  return { text: broken, target: { kind: 'contract', file: brk.file, line, pickleLines: hit.map((p) => p.line) } }
}

/** The contracts a break's run must cover. */
export const contractsOf = (target: Target): readonly string[] =>
  target.kind === 'code' ? target.contracts : [target.file]

export const isFailure = (result: ScenarioResult) => !['passed', 'skipped', 'pending'].includes(result.status)

const hits = (target: Target, result: ScenarioResult) =>
  target.kind === 'code'
    ? target.contracts.includes(result.file)
    : result.file === target.file && target.pickleLines.includes(result.line)

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
