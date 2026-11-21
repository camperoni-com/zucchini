# Contract runner

## Overview

The runner runs a project's `.feature` contracts against its Storybook stories in Vitest browser mode, using
[`@lotun/vitest-cucumber`](https://www.npmjs.com/package/@lotun/vitest-cucumber). It has two halves that meet
only through a virtual module and `globalThis`:

- **Node side** (`vitest.ts`, `bindings.ts`, `commands.ts`, `results.ts`): before the run, it loads the Zucchini
  config, works out which feature lines run on which story for each device, and builds one Vitest browser
  project per browser and device. During the run, it serves the Vitest commands that need Node or Playwright,
  and writes the results file.
- **Browser side** (`setup.ts`, `support.ts`, `driver.ts`, `geolocation.ts`, `runtime.ts`, `preview.ts`): a
  setup file publishes the runner on `globalThis`, the Cucumber support code registers the step library over a
  Vitest driver, and Storybook's project-level `afterEach` (`runStoryContracts`) runs the scenarios bound to the
  story that just rendered.

`devices.ts` is shared by both sides. Everything specific to the runner lives in this folder. The steps in
`src/steps` see only the `Driver`.

A project wires the runner in two places:

```ts
// vitest.zucchini.config.ts
import { zucchiniProjects } from '@camperoni/zucchini/runner'
export default defineConfig({ test: { projects: await zucchiniProjects() } })

// .storybook/preview.ts
import { contractViewports, runStoryContracts } from '@camperoni/zucchini/runner/preview'
// afterEach: runStoryContracts,
// parameters: { viewport: { options: { ...INITIAL_VIEWPORTS, ...contractViewports } } },
```

## Interface

Published entry points (`package.json` `exports`, built by `tsdown.config.ts`):

| Export                                | Source       | Runs in |
| ------------------------------------- | ------------ | ------- |
| `@camperoni/zucchini/runner`          | `vitest.ts`  | Node    |
| `@camperoni/zucchini/runner/preview`  | `preview.ts` | Browser |
| `dist/runner/setup.js` (entry only)   | `setup.ts`   | Browser |
| `dist/runner/support.js` (entry only) | `support.ts` | Browser |

`setup` and `support` are build entries but not package exports: the runner hands their paths to Vitest and
Cucumber at run time. `cucumber.json` is copied to `dist/runner`.

### `vitest.ts` (Node)

- `zucchiniProjects(options?: ZucchiniProjectsOptions): Promise<TestProjectInlineConfiguration[]>`: one Vitest
  browser project per device and browser, named `contracts-<browser>-<device>`. Each project gets Storybook's
  `storybookTest` plugin (with the device's viewport global), the `cucumber` plugin importing `support`, and
  the `zucchini:runner` plugin. It also sets `setupFiles: [setup]`, a headless Playwright provider with a
  20 s `actionTimeout`, and `commands: createCommands({ resultsFile })`.
- `ZucchiniProjectsOptions`: `root` (default `process.cwd()`), `configDir` (default `.storybook`), `browsers`
  (default `BROWSERS`), `devices` (default `DEVICES`), `port` (default `63315`), `contextOptions` (merged into
  every browser context), `testTimeout` (default `300_000` ms per story test).
- `RUNNER_MODULE_ID = 'virtual:zucchini/runner'`: the virtual module the `zucchini:runner` Vite plugin serves.
  It exports `settings: RunnerSettings` and `projectSteps: readonly StepDefinition[]` (declared in
  `virtual.d.ts`). `projectSteps` re-exports the config's `projectSteps` module, resolved against `root`, or is
  `[]` when the config names none.

### `preview.ts` (browser)

- `runStoryContracts(story: StoryHandle): Promise<void>`: Storybook `afterEach`. It runs the scenarios bound to
  `story.id` through `runCucumber`. It does nothing outside a contract run or for a story without a contract.
- `contractViewports`: re-exported from `devices.ts`.

### `devices.ts` (shared, browser-safe)

- `BROWSERS = ['chromium', 'firefox', 'webkit']`, `type Browser`.
- `type Device = 'desktop' | 'mobile'`, `DEVICES`.
- `DEVICE_VIEWPORTS`: `desktop` 1280x720, `mobile` 390x664.
- `viewportKey(device)`: the Storybook viewport key, `zucchiniDesktop` or `zucchiniMobile`.
- `contractViewports`: Storybook viewport options for both devices.
- `browserLabel(browser, device)`: `<browser>-<device>`, for example `webkit-mobile`.
- `projectName(browser, device)`: `contracts-<browser>-<device>`.

### `bindings.ts` (Node)

- `computeRunBindings({ root, dir, device }): Promise<RunBindings>`: finds the contracts under `dir`, binds each
  feature to the story file beside it, and lists the feature lines that run on each story for `device`.
- `RunBindings`: `stories` (by Storybook story id), `storyFiles` (sorted), `problems`.
- `StoryRun`: `{ file, lines }`, a feature file and the lines that select its pickles.
- Paths come from `findContracts` as given: relative to `root` when the contracts folder is relative, absolute
  when it is absolute.
- `runsOn(tags, device)`: true unless the tags name a different device (`@desktop`, `@mobile`).

### `results.ts` (Node)

Used by the runner and by the CLI (`src/cli/merge-results.ts`, `mutation.ts`). The CLI's `contracts.ts` imports
only `devices.ts`.

- `readResults(file): Results | null`, `writeResults(file, results)`.
- `mergeResults(files: readonly Results[]): Results`: merges results files. For the same file, line, name and
  browser, the latest `ranAt` wins.
- `dropBrowser(file, browser)`: removes one browser label's entries and keeps the others.
- `appendResult(file, result: ScenarioResult)`: merges one pickle's result into the file.

### `commands.ts` (Node)

- `createCommands({ resultsFile })`: Vitest browser commands `zucchiniRecord(result)`, which calls
  `appendResult`, and `zucchiniResetPointer()`, which moves Playwright's mouse to (0, 0). Their browser-side
  types are declared on `vitest/browser`'s `BrowserCommands` in `driver.ts`.

### `runtime.ts` (browser-safe)

- `publishRuntime(settings, runCucumber)`: stores the runner on `globalThis.__zucchiniRunner__`, once.
- `runtime()`: the published runner, or `undefined` outside a contract run.
- Types: `RunnerSettings` (`root`, `device`, `browser`, `testIdAttribute`, `stories`), `RunCucumber`,
  `StoryHandle`, `StoryEntry`, `WorldParameters` (`storyKey`).

### `driver.ts`, `geolocation.ts` (browser)

- `vitestDriver: Driver`: `click` and `hover` through `userEvent`, and `setGeolocation` through the fake.
- `geolocationFake`: `createGeolocationFake(navigator.geolocation)`.
- `createGeolocationFake(geolocation): GeolocationFake`: `set(permission, latitude, longitude)` replaces
  `getCurrentPosition`, `watchPosition` and `clearWatch` with own properties. `reset()` deletes them so the
  browser's own methods come back.

### `setup.ts`, `support.ts` (browser, no exports)

- `setup.ts`: calls `publishRuntime(settings, runCucumber)` with the virtual module's settings.
- `support.ts`: `setDefaultTimeout(30 s)` and `registerSteps` for the library's steps and `projectSteps` over
  `vitestDriver`. Its `Before` hook resets the pointer and the geolocation fake and remounts the story for
  every scenario after the first. Its `After` hook sends `zucchiniRecord` for each pickle.

## Invariants

- **Own files by extension.** `vitest.ts` finds `setup` and `support` with `sibling()`, which uses the extension
  of its own file: `.ts` in this repo, `.js` once built. A new runner file that is handed to Vitest or Cucumber
  by path must work with `sibling()` and must be added as an entry in `tsdown.config.ts`.
- **Browser-safe modules stay free of runner imports.** `preview.ts`, `runtime.ts` and `devices.ts` are imported
  by a normal Storybook (dev or static build), where no runner is published. They must not import
  `virtual:zucchini/runner`, `@lotun/vitest-cucumber` or Node modules. `bindings.ts`, `commands.ts`,
  `results.ts` and `vitest.ts` are Node only.
- **The browser halves meet on `globalThis`.** Storybook's preview and the Cucumber support code can get separate
  copies of a module, so they share state only through `globalThis.__zucchiniRunner__` (`runtime.ts`).
  `publishRuntime` keeps the first runtime it is given (`??=`).
- **`virtual:zucchini/runner` exists only inside a contract run.** Only `setup.ts` and `support.ts` import it.
  The build never bundles it (`deps.neverBundle` in `tsdown.config.ts`).
- **Contracts must bind.** `zucchiniProjects` throws `The contracts don't bind (run the contract linter)` if
  `computeRunBindings` reports any problem. A feature with no story file beside it whose title's last segment is
  the feature's name is a problem.
- **Every bound line runs.** `runStoryContracts` throws if the number of Cucumber results differs from the
  number of bound lines, and rethrows the first failed result's error with its stack frames pointing at the
  feature file.
- **Scenarios find their story by key.** `runStoryContracts` passes a `storyKey` World parameter, and
  `support.ts` throws `No story is being run for key "<key>"` when the runtime has no entry for it. The first
  scenario on a story uses the render Storybook already made; each later one remounts it.
- **User context options win.** `contextOptions` is spread after the runner's own browser context options.
- **Device tags.** A pickle tagged with another device's name does not run on this device. A pickle with no
  device tag runs on every device.
- **One port for every project.** All projects serve on the same `port` with `strictPort: true`, so they run one
  at a time (`zucchini contracts` does that).
- **The outer page is 1600x1200.** It is larger than any story viewport, so Vitest does not scale the story's
  iframe, which Playwright could not click into. The story gets its device size from the `viewport` global.
- **Firefox has no `isMobile`.** For the mobile device, Firefox gets the iPhone 13 size, touch and user agent
  without `isMobile`, which Playwright rejects there.
- **Playwright only.** `zucchiniResetPointer` throws unless the Vitest provider is `playwright`.
- **Geolocation answers.** `set` accepts `allow` (with two numbers) or `deny`, and throws `Invalid location` or
  `Invalid permissionType` otherwise. Answers arrive asynchronously (`setTimeout(..., 0)`), never during the
  call. `deny` answers with error code 1. A watch answers once.
- **Result identity.** A result is keyed by `[file, line, name, browser]`. A pickle's line is its Examples row,
  or its scenario if it has no row.

## Side Effects

- **Environment.** Importing `vitest.ts` prepends `--config <path to this folder's cucumber.json>` to
  `process.env.CUCUMBER_OPTIONS`, unless it already has `--config` or `-c`. This keeps a project's own
  Cucumber config out of the contract run.
- **Config read.** `zucchiniProjects` loads the Zucchini config from `root` (`loadConfig`), and
  `computeRunBindings` reads the contracts and story files under the config's `contracts` folder. The config's
  `projectSteps` module is loaded into the browser run through `virtual:zucchini/runner`.
- **Results file** (the config's `results` path, resolved against `root`):
  - `configureVitest` calls `dropBrowser` at the start of each project, which rewrites the file without that
    browser label's entries.
  - `zucchiniRecord` calls `appendResult`, which reads, merges and rewrites the file with synchronous `fs` calls,
    so concurrent records don't interleave.
  - `writeResults` creates the parent folder if needed.
- **Vitest config.** `configureVitest` replaces the project's `include` with the story files that have a
  contract. The plugin's `config` excludes `@lotun/vitest-cucumber` and `@lotun/vitest-cucumber/browser` from Vite's
  dependency pre-bundling and
  includes `@cucumber/cucumber-expressions`.
- **Browser globals.** `setup.ts` sets `globalThis.__zucchiniRunner__`. `geolocationFake.set` defines own
  properties on `navigator.geolocation`, and `reset` deletes them. `runStoryContracts` adds a
  `crypto.randomUUID()` entry to the runtime's `stories` map and deletes it when the scenarios finish.
- **Page state.** Before each scenario, the pointer is moved to (0, 0) and, after the first scenario on a story,
  the story is remounted with `renderToCanvas`. `vitestDriver` clicks and hovers through real `userEvent`
  input.
- **Global timeout.** `support.ts` sets Cucumber's default step timeout to 30 s.

## Verification

- Run: `npm test` (from the repository root). The runner's unit tests are `bindings.spec.ts`,
  `geolocation.spec.ts`, `results.spec.ts` and `vitest.spec.ts`; run them alone with `npx vitest run src/runner`.
- End to end: in `examples/demo`, `npm run contracts -- --browser chromium` runs real contracts through the
  runner (after `npm run demo:install` at the root).
