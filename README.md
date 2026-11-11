# Zucchini

Behavioral contracts for Storybook components, written in Gherkin, with a library of generic,
test-id-based steps and a readable spec view.

This package is incubated inside the Camperoni frontend, which is its first and only user. It is meant
to move to its own repository, with its history, once it's ready to publish; the public name is chosen
then. Until that move:

- it is private and is not published;
- it has no imports from the app (`src/`); the app imports the package, never the other way round;
- its dependencies come from the root `package.json`, so CI needs no second install;
- its unit specs run in the root Vitest suite, and the root type check and lint cover it.

## Project config

One file at the project root holds the project's settings: `zucchini.config.ts`, or
`zucchini.config.mts` in a project whose `package.json` isn't `"type": "module"` (Node then loads it as
an ES module without a warning). The catalog command, the contract linter and the Storybook plugin read it
from the working directory; command-line flags and plugin options override it. Without a config file, the
defaults apply. Paths are relative to the project root.

```ts
// zucchini.config.ts
import { defineConfig } from '@camperoni/zucchini'

export default defineConfig({
  contracts: 'src', // the folder holding the contracts and their stories
  catalog: 'docs/zucchini', // where the catalog command writes steps.json and steps.md
  projectSteps: 'test/projectSteps.ts', // optional: a module exporting `projectSteps`
  results: 'test-results/zucchini.json', // the results file the runner writes and the spec view reads
  testIdAttribute: 'data-testid', // the attribute the steps look elements up by
})
```

| Setting           | Default                      | Read by                          | Overridden by                                                    |
| ----------------- | ---------------------------- | -------------------------------- | ---------------------------------------------------------------- |
| `contracts`       | `src`                        | linter, Storybook plugin, runner | `zucchini lint --root`, plugin option `dir`                      |
| `catalog`         | `docs/zucchini`              | catalog command, linter          | `zucchini catalog --out`, `zucchini lint --catalog <steps.json>` |
| `projectSteps`    | none                         | catalog command, runner          | `zucchini catalog --project-steps`                               |
| `results`         | `test-results/zucchini.json` | Storybook plugin, runner         | plugin option `results`                                          |
| `testIdAttribute` | `data-testid`                | runner                           |                                                                  |

An unknown setting, or one that isn't a string, is an error.

### Project steps

A project's own steps are defined the same way as the library's (see [Steps](#steps)), in a module that
exports them as `projectSteps`:

```ts
// test/projectSteps.ts
import type { StepDefinition } from '@camperoni/zucchini'

export const projectSteps: StepDefinition[] = [
  {
    keyword: 'Given',
    wording: 'I am in the {string} metro',
    meaning: 'Picks a metro.',
    example: 'I am in the "Bay Area" metro',
    run: async (context, metro) => {
      /* ... */
    },
  },
]
```

Name that module in the config's `projectSteps` and regenerate the catalog: the steps appear in it marked as
project steps, and the linter, which checks contracts against the catalog, accepts them. The runner registers
them next to the library's (see [Registering the steps](#registering-the-steps)).
`test/fixtures/project/` is a small project set up this way.

Camperoni's config is `zucchini.config.mts` at the repo root. It has no project steps yet, so it leaves
`projectSteps` out, with a comment saying how to add them.

## Contracts

A component's contract is a Gherkin feature file beside its stories:

- `<Component>.feature` sits beside `<Component>.stories.tsx` and covers the story file whose title ends in
  `<Component>`;
- a `@story:Story_Name` tag binds a scenario to one story (`_` stands for a space, since Gherkin tags can't
  contain one);
- a `story` column in an outline's Examples binds each row to the story it names;
- scenario titles are free text.

```gherkin
Feature: MapViewComponent

    @story:Map_View_Default
    Scenario Outline: Verify map can be zoomed
        When I click on the element which has an attribute "aria-label" with value "<action>"
        ...
```

### Running them

The contracts run as Vitest browser tests (see [Running the contracts](#running-the-contracts)). The old
Storybook E2E scenarios in `e2e/features` keep running unchanged next to them until they're retired.

## Steps

Each step is data: a keyword, its wording (a [Cucumber expression](https://github.com/cucumber/cucumber-expressions)),
a one-line meaning, an example and a run function. Run functions query the DOM by test id and act through an
injected driver (click, hover, geolocation), so they don't depend on a browser runner.

v1 holds the 10 generic steps the Storybook scenarios use. Their wording is the old E2E steps' wording,
unchanged, so scenarios move over word for word.

The DOM rules match the old Playwright steps:

- **Visible** means a non-empty bounding box and not `visibility: hidden`.
- **Strict lookups:** an element a step acts on, or checks the type or an attribute of, must be the only
  match. The two text steps read the first match, as before.
- **Text** is trimmed and its line breaks normalized before comparing.
- **Polling:** text assertions re-read for up to 10 s, every 200 ms; type and attribute assertions for
  5 s; visibility waits for 25 s. After a hover or click over an element, the step pauses 1.5 s.

### Registering the steps

```ts
import { Given, Then, When } from '@cucumber/cucumber'
import { createStepContext, registerSteps } from '@camperoni/zucchini'

registerSteps(
  { Given, When, Then },
  {
    context: createStepContext({ driver, testIdAttribute: 'data-testid' }),
    projectSteps, // the project's own steps, defined the same way
  }
)
```

`driver` implements `click(element)`, `hover(element)` and `setGeolocation(permission, latitude, longitude)`
for the runner in use. The test-id attribute defaults to `data-testid`.

## Step catalog

`zucchini catalog` writes every available step (keyword, wording, parameter types, meaning, example, and
whether it comes from the library or the project) as `steps.json` and a readable `steps.md` in the config's
`catalog` folder. It runs on Node's built-in TypeScript support, without a browser:

```sh
zucchini catalog [--out <dir>] [--project-steps <module>] [--command <text>] [--check]
```

`--out` and `--project-steps` override the config's `catalog` and `projectSteps`. `--check` writes nothing
and exits 1 when the committed files differ from what the definitions produce; `--command` is the command
the files, the error message and the linter tell people to run (stored as the catalog's `generatedBy`).

In Camperoni the catalog is committed in `docs/zucchini/`; `npm run zucchini:catalog` regenerates it,
and CI runs `npm run zucchini:catalog:check`.

## Contract linter

`zucchini lint` parses every `*.feature` in the config's `contracts` folder with the official Gherkin parser,
checks it against the catalog in the config's `catalog` folder, and reports, as
`file:line: message`:

- a step that matches no step in the catalog, or more than one (outline steps are checked with their
  Examples values filled in);
- a `@story:` tag or `story` value naming a story that isn't in the matching story file;
- a scenario with no story binding, or with two;
- a feature file with no story file beside it, or one that doesn't parse.

It then lists the stories without a contract, and exits 1 if there was any problem.

The linter checks steps against the committed catalog, not the step definitions, so a step that was just
added to the code but not yet to the catalog shows up as unknown. Unknown- and ambiguous-step errors name the
catalog file and the command that regenerates it (the catalog's `generatedBy`): if you just added or changed
a step definition, run it.

```sh
zucchini lint [--catalog <steps.json>] [--root <dir>]
```

`--catalog` names the catalog file to check against and `--root` the folder of contracts, overriding the
config.

Story names come from Storybook's CSF reader, an internal Storybook API; `src/contracts/stories.ts` is the
only module that uses it. In Camperoni, `npm run zucchini:lint` lints `src/` and runs in CI.

## Running the contracts

The runner renders each story with Storybook's Vitest add-on, in Vitest's browser mode, and runs the scenarios
bound to it with [`@lotun/vitest-cucumber`](https://github.com/lotun-io/vitest-cucumber), pinned to an exact
version. Everything runner-specific lives in `src/runner/`; the steps only see the driver.

- **One project per browser and device,** named `contracts-<browser>-<device>`: Chromium, Firefox and
  WebKit, each on `desktop` (Playwright's default 1280x720 context) and `mobile` (its iPhone 13; Firefox has
  no mobile emulation, so it gets the same size, touch and user agent without `isMobile`).
- **Bindings first.** Before anything runs, the runner binds every pickle to its story, as the linter does,
  and stops on a problem. A pickle tagged with a device (`@desktop`, `@mobile`, usually on an Examples block)
  runs only on that device. Only the story files with a contract beside them run.
- **Per story.** A project-level `afterEach` (`runStoryContracts`) runs exactly the lines bound to the story
  that just rendered, by handing Cucumber `file:line:line`. The first scenario uses that render; each further
  one gets a fresh mount (`renderToCanvas()`). Before each scenario the mouse is parked in a corner and the
  geolocation fake is reset, so nothing carries over. A story test fails with the first failing
  scenario's error, pointing at the feature file's lines.
- **Results.** An `After` hook records each pickle's run in the [results file](#the-results-file), with
  `name`, `browser` (e.g. `webkit-mobile`) and `hash`. A run replaces all of its own browser and device's
  entries and keeps the others', so one file gathers every browser that ran, and a story that crashed before
  its scenarios ran doesn't keep an old pass. (A run limited to some story files therefore leaves the other
  stories "not run yet" on that browser and device.)
- **Driver.** Clicks and hovers go through Vitest's `userEvent`, and the mouse reset through a Vitest command
  that moves Playwright's mouse in Node. Geolocation is a fake of the page's `navigator.geolocation`: with
  `allow`, its location requests get the scenario's location; with `deny`, they fail as when a visitor blocks
  them (code 1, `PERMISSION_DENIED`). Playwright's permissions don't fit, since the stories share one page:
  WebKit still allowed after they were cleared, and Firefox answered "denied" after they were granted. The
  contracts check how a component handles the answer, the same way in every browser, not whether a browser
  grants it.
- **Settings** come from the project config: `contracts`, `projectSteps`, `results` and `testIdAttribute`.

Wiring, as in Camperoni:

```ts
// vitest.zucchini.config.mts: the app's Vite config plus the contract projects
export default mergeConfig(viteConfig, defineConfig({ test: { projects: await zucchiniProjects({ port: 5173 }) } }))

// .storybook/preview.ts
afterEach: runStoryContracts,
parameters: { viewport: { options: { ...INITIAL_VIEWPORTS, ...contractViewports } } },
```

`runStoryContracts` does nothing outside a contract run, so the normal Storybook is unaffected and doesn't
bundle the runner. `zucchiniProjects()` takes the browsers, devices, port, extra context options (Camperoni
passes its time zone) and the per-story timeout (300 s by default; Storybook's own 15 s is too short for a story
with 11 scenarios).

Run it with `zucchini contracts`, which runs the projects one after the other (they all serve on the same port),
keeps going after a failure (Ctrl-C stops it), prints each run's result and time, and exits 1 if any failed.
Arguments after the options go to Vitest, e.g. a story file to run only that one:

```sh
zucchini contracts --config vitest.zucchini.config.mts [--browser chromium,firefox,webkit] [--device desktop,mobile]
```

The browser defaults to `chromium`, the devices to both. In Camperoni: `npm run zucchini:contracts`, with
`-- --browser webkit` to pick others. Each browser needs `npx playwright install <browser>`.

`zucchini merge-results` merges results files, such as one per browser from separate CI jobs, into the config's
results file (or `--out`); the latest run of a pickle on a browser wins:

```sh
zucchini merge-results <results.json>... [--out <file>]
```

In Camperoni's CI, `.github/workflows/contracts.yml` runs `npm run zucchini:contracts -- --browser <browser>`
in one job per browser and uploads each job's results file. `ci.yml` calls it in the E2E jobs' tiers: Chromium on
every PR, Firefox and WebKit on release PRs. The Storybook deploy doesn't run the contracts again. Merges are
fast-forwards, so it downloads the results of the CI runs for the commit it deploys and merges them with
`npm run zucchini:merge-results` before `build-storybook`. The deployed docs then show the results for the
commit they were built from.

**Quirks the runner handles,** so a change in the runner, Vitest or Storybook touches `src/runner/` only:

- `@lotun/vitest-cucumber` and its browser entry stay out of Vite's pre-bundling (it can't follow the
  plugin's virtual module), and `@cucumber/cucumber-expressions` is pre-bundled up front, so the page doesn't
  reload under the tests when the steps first load.
- The plugin reads Cucumber's config file from the working directory; the runner points it at its own empty
  `cucumber.json` through `CUCUMBER_OPTIONS`, so a project's `cucumber.js` (Camperoni's E2E) stays out.
- Storybook's Vitest add-on renders stories at 1200x900 unless a `viewport` global picks a size, hence
  `contractViewports` and an outer page larger than any story: Playwright can't click inside the scaled-down
  iframe Vitest would otherwise use.
- `runCucumber()` passes no `tags`; device filtering happens in the bindings instead.
- Vitest 5 reads a browser project's port from `test.api`. A key restricted by referrer (Camperoni's Google
  Maps key accepts `localhost:5173` and `localhost:6006`) needs a fixed one.

## Deliberate-break check

A contract that passes whatever the component does tests nothing. The deliberate-break (mutation) check proves
the passes are real: it applies a fixed list of breaks one at a time, each changing one expectation in a contract
to a wrong one, runs the contracts of that story file, and checks that the broken scenario or Examples row
failed.

```sh
zucchini mutation --config <vitest config> --breaks <module> \
  [--browser chromium,firefox,webkit] [--device desktop,mobile] [--break <name>]...
```

- `--breaks` names a module that exports `breaks: Break[]`. A break has a `name`, what it `checks`, the
  contract `file`, and the text to `find` (its first occurrence) and `replace`; `devices` limits it to the
  devices its pickle runs on. A changed Examples row must fail itself; a changed step must fail a pickle of
  its scenario.
- The browser defaults to `chromium` and the device to `desktop`: one cheap run per break. `--break` (repeatable)
  checks only the breaks named.
- Every break is reverted after its run, even when the run fails or is interrupted with Ctrl-C, and the
  results file is put back as it was, so nothing leaks into the working tree or the spec view.
- It prints each break as `caught` (with the failure it caused), `MISSED` (the broken pickles still passed),
  `NOT RUN` (none of them ran) or `ERROR` (its text is gone from the contract), plus any failure the break
  doesn't explain, and exits 1 on any of those.

**When to run it:** by hand, after changing the step library, the runner or the DOM rules, after upgrading
Vitest, Storybook or `@lotun/vitest-cucumber`, and when adding a kind of step or contract the breaks don't
cover yet (add a break for it). It isn't part of CI. A `MISSED` break means a contract can pass without
checking what it says; fix the step or the contract before trusting its passes.

In Camperoni, `npm run zucchini:mutation` runs it with the breaks in `zucchini.breaks.mts`: the
spike's 8, one per kind of step plus two after map interactions. It takes about 4 minutes on Chromium. Pass
options after `--`, e.g. `npm run zucchini:mutation -- --break map-zoom` or `-- --browser webkit`.

## Spec view in Storybook

Each component's docs page shows its contracts after the default autodocs blocks: every scenario with the
stories it runs on (linked), its steps, its Examples, and its last result (passed, failed, changed since its last run, or not run yet).
A `#` comment line among a scenario's steps starts a named, collapsible group of the steps after it, up to
the next comment or blank line. A component without a contract shows a short "no contract" note. The
overview page (`src/storybook/Overview.mdx`, "Living Spec/Contracts") lists every contract and the stories
without one.

- `src/view/viewModel.ts` turns a parsed feature, its bindings and optional results into the view model.
- `src/storybook/vitePlugin.ts` builds the view models in Node and serves them as the virtual module
  `virtual:zucchini/contracts`, in dev and in the build. It reads `contracts` and `results` from the
  config at its `root` (the working directory by default); its `dir` and `results` options override them. It uses only `resolveId`, `load` and
  `addWatchFile`, which are stable across Vite 5 to 8.
- `src/storybook/ContractsDocsPage.tsx` is the docs page: Storybook's `DocsPage` followed by the contracts.

Wiring, as in Camperoni's `.storybook/`:

```ts
// main.ts
stories: [..., '../node_modules/@camperoni/zucchini/src/storybook/*.mdx'],
viteFinal: (config) => ({
  ...config,
  plugins: [...(config.plugins ?? []), zucchiniPlugin()],
}),

// preview.ts
parameters: { docs: { page: ContractsDocsPage } }
```

### The results file

The results file (the config's `results`) is optional; without it every scenario shows "not run yet". The
contract runner writes it as:

```json
{
  "ranAt": "2026-11-02T10:00:00Z",
  "scenarios": [
    {
      "file": "src/components/Badge/Badge.feature",
      "line": 12,
      "name": "Shows 3 on Default",
      "browser": "webkit-mobile",
      "hash": "8dbcc9a65455",
      "status": "failed",
      "durationMs": 840,
      "error": "Expected \"3\" to equal \"4\"",
      "ranAt": "2026-11-02T10:05:00Z"
    }
  ]
}
```

Each entry is one run of one pickle (a scenario, or one Examples row of an outline) on one browser:

- `file`: the feature file, relative to the project root.
- `line`: the line of the scenario, or of the Examples row for an outline.
- `status`: Cucumber's status, lower-case (`passed`, `failed`, `skipped`, `pending`, `undefined`,
  `ambiguous`...). Anything but passed, skipped or pending counts as a failure.
- `name` (optional): Cucumber's pickle name, that is the scenario's name with an outline row's values in its
  `<placeholders>`, as `@cucumber/gherkin`'s `compile()` names it. When it isn't the name of the pickle now at
  `file` and `line` (the scenario moved, or was renamed), the view ignores the entry, so the scenario shows
  "not run yet" instead of borrowing another scenario's result. An entry without `name` is matched by `file`
  and `line` alone.
- `browser` (optional): a free label for the browser and device, such as `webkit-mobile`. A failed scenario
  or row shows the distinct labels it failed on, e.g. "Failed on webkit-mobile, firefox-desktop".
- `hash` (optional): the pickle's content hash when it ran (see below). When it is no longer the hash of the
  pickle at `file` and `line`, the scenario was edited since without changing its name: the entry is stale,
  and the scenario or row shows "changed since last run", which looks different from both "not run yet" and
  failed. A stale entry's failure and browsers aren't shown. An entry without `hash` is taken as current.
- `durationMs`, `error` and `ranAt` (all optional): how long it took, the failure's message, and when it ran
  (defaulting to the file's `ranAt`).

A pickle with several entries (one per browser) has passed once all of them passed, and failed when any
failed. Current entries outweigh stale ones; a pickle with only stale entries is "changed since last run".

#### The content hash

`pickleHash(content)`, exported from the package, computes it with Web Crypto, so the view (in Node) and the
runner (in the browser) get the same value. It covers:

1. `name`: the pickle's name, as above;
2. `steps`: every step the pickle runs, in order, Background steps first, each as its keyword as written
   (`Given`, `When`, `Then`, `And`, `But` or `*`, without surrounding spaces) and its text with the Examples
   row's values filled in;
3. `values`: the Examples row's cells in column order, or none for a plain scenario.

Doc strings and data tables are not covered. The hash is the first 12 hex digits of the SHA-256 of the UTF-8
JSON array `[name, [[keyword, text], ...], [value, ...]]`, for example:

```json
[
  "Shows 3 on Default",
  [["Then", "I should assert that the element with id \"badge\" has an exact value of \"3\""]],
  ["Default", "3"]
]
```

hashes to `8dbcc9a65455` (`JSON.stringify` without spaces is what's hashed; the spaces here are for reading).
