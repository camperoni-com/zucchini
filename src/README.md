# Zucchini source Blueprint

## System Overview

Zucchini runs Gherkin contracts (`.feature` files) against Storybook stories and shows the results in Storybook as a
living spec. The source splits into these parts:

- **Definitions:** the step library (`steps`), the project config (`config`) and the step catalog built from the steps
  (`catalog`).
- **Contracts:** parsing `.feature` files, binding each scenario to a story, and the linter (`contracts`).
- **Running:** the Vitest browser-mode runner on `@lotun/vitest-cucumber`, which writes the results file (`runner`).
- **Showing:** the view model built from contracts and results (`view`), and the Storybook doc blocks and Vite plugin
  that render it (`storybook`).
- **Commands:** the `zucchini` CLI (`cli`) and the experimental mutation check's logic (`mutation`).

Data flows one way: a contract is parsed and bound to its story (`contracts`); the runner runs it in each browser and
device and records a result per pickle (`runner`); the Vite plugin builds the view model from the contracts and that
results file (`view`) and serves it to the doc blocks (`storybook`).

The package entries (`package.json` `exports`, built by `tsdown.config.ts`):

| Entry                                | Source                    |
| ------------------------------------ | ------------------------- |
| `@camperoni/zucchini`                | `index.ts`                |
| `@camperoni/zucchini/storybook`      | `storybook/index.ts`      |
| `@camperoni/zucchini/vite`           | `storybook/vitePlugin.ts` |
| `@camperoni/zucchini/runner`         | `runner/vitest.ts`        |
| `@camperoni/zucchini/runner/preview` | `runner/preview.ts`       |
| `zucchini` command (`bin`)           | `cli/zucchini.ts`         |

`runner/setup.ts` and `runner/support.ts` are build entries but not package exports: the runner hands their paths to
Vitest and Cucumber at run time.

## Local Interface & Invariants

- `index.ts` re-exports, and holds no code of its own:
  - from `catalog/catalog.ts`: `buildCatalog`, `catalogToJson`, `catalogToMarkdown`, `discouragedText` and the types
    `Catalog`, `CatalogEntry`, `StepSource`;
  - from `config/config.ts`: `DEFAULT_CONFIG`, `defineConfig` and the types `ZucchiniConfig`, `ResolvedConfig`;
  - from `view/pickleHash.ts`: `PICKLE_HASH_LENGTH`, `pickleHash` and the type `PickleContent`;
  - from `steps/dom.ts`: `createStepContext`, `DEFAULT_BUDGETS`, `DEFAULT_TEST_ID_ATTRIBUTE`;
  - from `steps/library.ts`: `librarySteps`;
  - from `steps/register.ts`: `registerSteps` and the types `CucumberDefiners`, `DefineStep`;
  - from `steps/types.ts`: the types `Budgets`, `Discouraged`, `Driver`, `StepContext`, `StepDefinition`, `StepKeyword`;
  - from `mutation/mutation.ts`: the type `Break`.
- Nothing `index.ts` loads imports a Node built-in (`node:*`); `Break` is exported as a type only, so `mutation` isn't
  loaded.

## Subdirectories & System Boundaries

- steps: [./steps/README.md](./steps/README.md) - The step library: each step's wording, parameters, meaning, example
  and run function, acting on the page only through an injected `Driver`.
- config: [./config/README.md](./config/README.md) - `ZucchiniConfig`, its defaults and `loadConfig`, which finds and
  validates `zucchini.config.ts` or `.mts`.
- catalog: [./catalog/README.md](./catalog/README.md) - Builds the step catalog (library steps, then project steps) and
  formats it as JSON and Markdown; pure functions.
- contracts: [./contracts/README.md](./contracts/README.md) - Parses `.feature` files, binds each scenario or Examples
  row to one story, and lints contracts against the catalog.
- runner: [./runner/README.md](./runner/README.md) - One Vitest browser project per browser and device; runs a story's
  bound scenarios from Storybook's `afterEach` and records each result.
- view: [./view/README.md](./view/README.md) - Builds the living spec's view model and per-scenario status from
  contracts and results; holds the results file types and `pickleHash`.
- storybook: [./storybook/README.md](./storybook/README.md) - The `ContractsDocsPage` and `ContractsOverview` doc blocks
  and the `zucchiniPlugin` Vite plugin that serves the view model as `virtual:zucchini/contracts`.
- mutation: [./mutation/README.md](./mutation/README.md) - Pure logic of the experimental mutation check: applying a
  break and judging a run as caught, missed or not run.
- cli: [./cli/README.md](./cli/README.md) - The `zucchini` command and its subcommands: `catalog`, `lint`,
  `contracts`, `merge-results` and `mutation`.

## Global Invariants

- **Step wording is frozen.** Library step wording is not renamed or reworded; a step meant to be replaced is marked
  `discouraged`, which makes the linter warn (`steps/library.ts`, `contracts/lint.ts`).
- **One binding rule everywhere.** `<Component>.feature` binds to the story file beside it whose title's last `/`
  segment is exactly `<Component>` (`storyFileFor` in `contracts/lint.ts`, `componentOf` in `contracts/bindings.ts`),
  and each pickle binds to at most one story (`contracts/bindings.ts`). The linter, the runner (`runner/bindings.ts`)
  and the view (`view/specData.ts`) all use it.
- **One pickle hash.** The runner records `pickleHash` with each result and the view recomputes it to spot changed
  scenarios, so both sides must hash the same content (`view/pickleHash.ts`).
- **Browser-safe modules import nothing Node-only.** `view/pickleHash.ts` and `view/describeRuns.ts` import nothing;
  `runner/preview.ts`, `runner/runtime.ts` and `runner/devices.ts` import no Node modules; `steps` run functions use
  only `context.document` and `context.driver`.
- **`virtual:zucchini/runner` exists only inside a contract run.** The runner's Vite plugin serves it, and only
  `runner/setup.ts` and `runner/support.ts` import it; the build leaves it unbundled.
- **`virtual:zucchini/contracts` exists only inside Vite** with `zucchiniPlugin`. `storybook/specModule.ts` imports it,
  so nothing in Node code or tests may import the `./storybook` entry's components directly.
- **Runner files resolve by extension.** `runner/vitest.ts` finds its sibling files with `sibling()`, as `.ts` in this
  repository and `.js` once built; a new file the runner hands to Vitest or Cucumber must be added to
  `tsdown.config.ts`, as an entry if it is code or to `copy` if it isn't (as `runner/cucumber.json` is).
- **Config is validated once.** `config/load.ts` rejects unknown settings and non-string values; a new setting goes in
  `ZucchiniConfig`, `DEFAULT_CONFIG` (unless optional) and `SETTINGS`.

## Global Side Effects

- **Files read:** the config file (imported, so it runs), every `.feature` and story file under the contracts folder,
  the step catalog (`lint`, `catalog --check`), the results file (`view`, `runner`, `mutation`), the project steps
  module (`catalog`, and the runner's browser run), the `--breaks` module (`mutation`) and `merge-results`' inputs.
- **Files written:** the results file (`runner/results.ts`, by the runner and `merge-results`; each Vitest project
  rewrites it at start without its own browser's entries), the step catalog files (`cli/catalog.ts`), and, during
  `zucchini mutation`, the broken file and the results file (deleted before each break, then restored or removed at
  the end) (`cli/mutation.ts`).
- **Processes and browsers:** `zucchini contracts` spawns `npx vitest run` once per browser and device, one after the
  other, each launching headless Playwright browsers on port 63315 by default; `zucchini mutation` spawns
  `zucchini contracts` once per break.
- **Environment:** importing `runner/vitest.ts` adds the runner's Cucumber config to `CUCUMBER_OPTIONS`, unless it
  already has `--config` or `-c`; `zucchini`
  sets `ZUCCHINI_CLI` for the commands it starts.

## System Verification

- Run: `npm test`
