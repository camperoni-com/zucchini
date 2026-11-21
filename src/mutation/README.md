# mutation

## Overview

The logic of the deliberate-break check (experimental), which proves that the contracts' passes are real. A break
replaces some text in one file with a wrong version, then the contracts run and must fail:

- A **contract break** changes one expectation in a `.feature` file. The run must fail on a pickle the change
  targets (that Examples row, or a pickle of the scenario whose step changed), which shows the steps really check
  what they claim.
- A **code break** puts a realistic bug in the code a story renders. The contracts the break names must fail
  somewhere, which shows they would catch that regression.

This folder only applies breaks to text and judges results. Writing the broken file, running the contracts and
reverting are done by the `zucchini mutation` command in [`../cli`](../cli/README.md). The user guide is
`docs/mutation.md` at the repository root.

## Interface

- `Break`: one deliberate break. `name` (short and unique, used by `--break`), `checks` (what it shows),
  `file` (relative to the project root), `find`, `replace`, optional `contracts` (feature files, required for a
  code break) and optional `devices` (when the broken pickle runs on some devices only). The `Break` type is
  re-exported from the package root (`src/index.ts`) so projects can type their breaks module.
- `Target`: what a break must make fail. `{ kind: 'contract', file, line, pickleLines }` or
  `{ kind: 'code', file, line, contracts }`; `line` is the line of the change.
- `isCodeBreak(brk)`: true when `brk.file` doesn't end in `.feature`.
- `applyBreak(text, brk)`: returns `{ text, target }`, the broken text and its `Target`. Throws when the text to
  break isn't there.
- `contractsOf(target)`: the contracts a break's run must cover (a code break's `contracts`, or the broken feature
  file).
- `isFailure(result)`: true when a `ScenarioResult`'s status is anything but `passed`, `skipped` or `pending`.
- `Verdict`: `caught` (with `failures`), `missed` or `not-run`, each with `unexplained` failures.
- `judge(target, results)`: the `Verdict` for one break's run.

## Invariants

- `applyBreak` replaces only the first occurrence of `find`. If `find` is no longer in the text it throws
  (`<file> no longer contains ...`), so a stale break fails loudly rather than passing.
- `line` is the 1-based line where the match starts.
- A code break must name at least one contract, or `applyBreak` throws.
- A contract break's broken text must still parse as Gherkin (`parseFeature` from `src/contracts/bindings.ts`), or
  `applyBreak` throws with the parser's problems.
- A contract break that lands on an Examples row targets that row's pickle only; otherwise it targets every pickle
  of the scenario with a step on that line. A line that is neither throws.
- `judge` counts a result as targeted when its `file` is one of a code break's `contracts`, or, for a contract break,
  when its `file` equals the break's file and its `line` is one of `pickleLines`. Paths are compared as plain
  strings, so they must use the same form as the results file.
- `judge` returns `caught` if any targeted result failed, `missed` if targeted results ran and none failed, and
  `not-run` if no targeted result is present. Any failure outside the target is reported as `unexplained`.

## Side Effects

- None. Every function here works on the strings and results it is given; it reads and writes no files and starts
  no processes.

## Verification

- Run: `npm test` from the repository root (or `npx vitest run src/mutation` for this folder's tests,
  `src/mutation/mutation.spec.ts`).
