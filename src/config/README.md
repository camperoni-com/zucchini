# config

## Overview

The project config: one optional file at the project root (`zucchini.config.ts` or `zucchini.config.mts`) that
tells Zucchini where the contracts, the step catalog, the project's own steps and the results file live, and which
attribute holds test ids. `config.ts` declares the settings and their defaults; `load.ts` finds the file, checks it
and fills in the defaults.

`loadConfig` is used by the `catalog`, `lint`, `merge-results` and `mutation` commands (`src/cli`), the Storybook
Vite plugin (`src/storybook/vitePlugin.ts`) and the contract runner (`src/runner/vitest.ts`). Some of them can
override a setting: `catalog --out` and `--project-steps`, `lint --root` and `--catalog`, `merge-results --out`,
and the plugin's `dir` and `results` options. The runner and `mutation` use the config's settings as they are.

## Interface

- `config.ts`
  - `ZucchiniConfig`: the settings, all optional strings. `contracts` (folder of contracts and their stories),
    `catalog` (folder the catalog's `steps.json` and `steps.md` go to), `projectSteps` (module exporting
    `projectSteps`), `results` (results file the runner writes and the spec view reads), `testIdAttribute`.
  - `ResolvedConfig`: every setting filled in except `projectSteps`, which stays optional.
  - `DEFAULT_CONFIG`: `contracts: 'src'`, `catalog: 'docs/zucchini'`, `results: 'test-results/zucchini.json'`,
    `testIdAttribute: DEFAULT_TEST_ID_ATTRIBUTE` (from `src/steps/dom.ts`, `data-testid`). No `projectSteps`.
  - `defineConfig(config)`: types a config file's default export and returns it unchanged.
  - `ZucchiniConfig`, `ResolvedConfig`, `DEFAULT_CONFIG` and `defineConfig` are re-exported from the package root
    (`src/index.ts`).
- `load.ts` (Node only, not exported from the package root)
  - `CONFIG_FILES`: `['zucchini.config.ts', 'zucchini.config.mts']`, looked up in that order.
  - `loadConfig(root = process.cwd())`: resolves to `{ file?, config }`. Without a config file it returns a copy
    of `DEFAULT_CONFIG` and no `file`.

## Invariants

- The first of `CONFIG_FILES` that exists at `root` wins; `zucchini.config.ts` is preferred over `.mts`.
- The config file must have a default export that is an object, or `loadConfig` throws.
- Every key must be one of the settings (`contracts`, `catalog`, `projectSteps`, `results`, `testIdAttribute`);
  an unknown key throws an error that lists them.
- Every value must be a string. A value of `undefined` is skipped and keeps the default; any other non-string
  throws.
- `loadConfig` never mutates `DEFAULT_CONFIG`; it always starts from a copy.
- Paths in the config are relative to the project root. `loadConfig` does not resolve them; callers do.
- `config.ts` has no Node imports, so it stays safe to export from the package root. Keep file-system code in
  `load.ts`.
- Adding a setting means adding it to `ZucchiniConfig`, `DEFAULT_CONFIG` (unless optional like `projectSteps`) and
  the `SETTINGS` list in `load.ts`, which is what accepts it.

## Side Effects

- `config.ts`: none.
- `loadConfig` checks the file system for the config files (`fs.existsSync`) and imports the one it finds with a
  dynamic `import()`, which runs that module's code.

## Verification

- Run: `npm test` from the repository root (or `npx vitest run src/config` for this folder's tests,
  `src/config/load.spec.ts`).
