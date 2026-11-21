# cli

## Overview

The `zucchini` command: `zucchini <command> [options]`. `zucchini.ts` is the dispatcher and the package's `bin`
(built to `dist/cli.js` as the `cli` entry in `tsdown.config.ts`). Each subcommand is a module that runs when it
is imported: it reads its own flags from `process.argv` with `node:util`'s `parseArgs`, does its work and sets the
exit code. The logic lives in the other packages; these modules wire it to flags, files and processes.

## Interface

| Command                         | Module             | What it does                                                                                                                                                                                                                  |
| ------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `zucchini catalog`              | `catalog.ts`       | Writes `steps.json` and `steps.md` into the catalog folder, or with `--check` fails when they differ from what the step definitions produce. Flags: `--out <dir>`, `--project-steps <module>`, `--command <text>`, `--check`. |
| `zucchini lint`                 | `lint.ts`          | Lints the contract feature files against the catalog's `steps.json` and the stories beside them. Flags: `--catalog <steps.json>`, `--root <dir>`.                                                                             |
| `zucchini contracts`            | `contracts.ts`     | Runs the contracts with Vitest, one project per browser and device, one after the other. Flags: `--config <vitest config>` (required), `--browser` (default `chromium`), `--device` (default all), `-- <vitest args>`.        |
| `zucchini merge-results`        | `merge-results.ts` | Merges several results files (for example one per CI job) into one. Positionals: the results files. Flag: `--out <file>`.                                                                                                     |
| `zucchini mutation`             | `mutation.ts`      | (Experimental) the deliberate-break check. Flags: `--config <vitest config>` and `--breaks <module>` (both required), `--browser` (default `chromium`), `--device` (default `desktop`), `--break <name>` (repeatable).        |
| `zucchini --help`, `-h`, `help` | `zucchini.ts`      | Prints the usage, which lists each command and its summary.                                                                                                                                                                   |

- `zucchini.ts`: the `COMMANDS` table maps each name to a one-line summary and a lazy `import()` of its module.
- `--browser` and `--device` take comma-separated lists, in `contracts` and in `mutation`.
- `--command` (default `zucchini catalog`) is the command that regenerates the catalog. It is stored as the
  catalog's `generatedBy`, which `steps.md`'s header, the stale-catalog message and `lint`'s hints show.
- A `--project-steps` module must export `projectSteps`, an array of step definitions.
- A `--breaks` module exports `breaks`, an array of `Break` from [`../mutation`](../mutation/README.md).
- Defaults for the catalog folder, the contracts folder, the project steps and the results file come from the
  project config through `loadConfig` in [`../config`](../config/README.md). `catalog --out` and `--project-steps`,
  `lint --root` and `--catalog`, and `merge-results --out` override them; `mutation` has no flags for them. `contracts.ts`
  doesn't read the project config itself: the Vitest runs it starts do.
- Packages used: `src/catalog` (`buildCatalog`, `catalogToJson`, `catalogToMarkdown`), `src/steps`
  (`librarySteps`), `src/contracts` (`findContracts`, `lintContracts`, `formatLintResult`, `storyFileFor`),
  `src/runner` (`BROWSERS`, `DEVICES`, `projectName`, `readResults`, `mergeResults`, `writeResults`) and
  `src/mutation` (`applyBreak`, `contractsOf`, `isFailure`, `judge`).

## Invariants

- The dispatcher rewrites `process.argv` to `[node, 'zucchini <name>', ...args]` before loading a command, so a
  command's `parseArgs` sees only its own arguments.
- The dispatcher sets `ZUCCHINI_CLI` to its own file path. `mutation.ts` starts `zucchini contracts` through it
  with the same Node (`process.execPath`), and throws if `ZUCCHINI_CLI` is unset, so run the check as
  `zucchini mutation`, not by running `mutation.ts` directly.
- A new command needs an entry in `COMMANDS`, and a name in the `COMMANDS` list of `zucchini.spec.ts`, which checks
  that the usage lists every command.
- Exit codes:
  - `1`: an unknown or missing command; `catalog --check` found stale files; `lint` found problems; a
    `contracts` run failed; `mutation` found a problem (a break missed, not run, not applicable, an
    unexplained failure, or an interruption).
  - `2`: bad usage. `contracts` without `--config` or with an unknown browser or device; `lint` with no
    catalog file; `mutation` without `--config` or `--breaks`, with an unknown `--break`, or with a `--breaks` module that has no
    breaks. An unknown flag or a stray positional argument is bad usage too, but it currently crashes with a stack
    trace and exit code 1 ([#34](https://github.com/camperoni-com/zucchini/issues/34)).
  - `130`: `contracts` was interrupted with Ctrl-C.
  - `0`: `merge-results` with no existing input files, which leaves the output as it was.
- `contracts` runs every browser and device combination in turn, because they all serve on the same port, and
  keeps going after a failure. After Ctrl-C the run in progress stops and no later run starts.
- `merge-results` skips input files that don't exist, with a warning. When a pickle ran on the same browser in more
  than one file, the latest run counts (`mergeResults` in `src/runner/results.ts`).
- `mutation` applies one break at a time and always writes the original file back after its run, even when the
  run fails or is interrupted. When it finishes it puts the results file back as it was, or removes it if there
  was none before.

## Side Effects

- `catalog`: creates the catalog folder and writes `steps.json` and `steps.md` (without `--check`); reads them
  with `--check`. Imports the `--project-steps` module.
- `lint`: reads the catalog's `steps.json` and the feature and story files under the contracts folder.
- `contracts`: starts `npx vitest run --config <file> --project contracts-<browser>-<device>` for each combination, with
  inherited stdio. Those runs write the results file. Listens for `SIGINT`.
- `merge-results`: reads the input results files and writes the merged one.
- `mutation`: imports the `--breaks` module; for each break, deletes the results file, overwrites the break's
  file with the broken text, starts `zucchini contracts` as a child process, then restores the file. Saves and
  restores the results file around the whole check. Listens for `SIGINT`.
- Every command that reads the project config imports `zucchini.config.ts` or `.mts` from the working directory.
- All commands write their reports to stdout and stderr and set the process exit code.

## Verification

- Run: `npm test` from the repository root (or `npx vitest run src/cli` for this folder's tests:
  `zucchini.spec.ts`, `catalog.spec.ts`, `lint.spec.ts` and `project.spec.ts`, which run the command with Node
  against fixtures in `test/fixtures` and `src/contracts/fixtures`).
- The `contracts` and `mutation` commands have no unit tests here; they are exercised in `examples/demo`
  (`npm run contracts -- --browser chromium`, `npm run mutation`).
