# Reference

The details behind the [README](../README.md): the config, the contract format, the steps, the commands, the
runner and the living spec.

- [Project config](#project-config)
- [Contracts](#contracts)
- [Steps](#steps)
- [Step catalog](#step-catalog)
- [Contract linter](#contract-linter)
- [Running the contracts](#running-the-contracts)
- [The living spec in Storybook](#the-living-spec-in-storybook)
- [The results file](#the-results-file)
- [The mutation check](mutation.md) (experimental)

## Project config

One file at the project root holds the project's settings: `zucchini.config.ts`, or `zucchini.config.mts` in a
project whose `package.json` isn't `"type": "module"` (Node then loads it as an ES module without a warning).
The commands and the Storybook plugin read it from the working directory; command-line flags and plugin options
override it. Without a config file, the defaults apply. Paths are relative to the project root.

```ts
// zucchini.config.ts
import { defineConfig } from '@camperoni/zucchini'

export default defineConfig({
  contracts: 'src', // the folder holding the contracts and their stories
  catalog: 'docs/zucchini', // where `zucchini catalog` writes steps.json and steps.md
  projectSteps: 'test/projectSteps.ts', // optional: a module exporting `projectSteps`
  results: 'test-results/zucchini.json', // the results file the runner writes and the living spec reads
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

A project's own steps are defined the same way as the library's (see [Steps](#steps)), in a module that exports
them as `projectSteps`:

```ts
// test/projectSteps.ts
import type { StepDefinition } from '@camperoni/zucchini'

export const projectSteps: StepDefinition[] = [
  {
    keyword: 'Given',
    wording: 'I am signed in as {string}',
    meaning: 'Signs in as the given test user.',
    example: 'I am signed in as "ada"',
    run: async (context, user) => {
      /* ... */
    },
  },
]
```

Name that module in the config's `projectSteps` and regenerate the catalog: the steps appear in it marked as
project steps, the linter accepts them, and the runner registers them next to the library's.

## Contracts

A component's contract is a Gherkin feature file beside its stories:

- `<Component>.feature` sits beside `<Component>.stories.tsx` and covers the story file whose title ends in
  `<Component>`;
- a `@story:Story_Name` tag binds a scenario to one story (`_` stands for a space, since Gherkin tags can't
  contain one);
- a `story` column in an outline's Examples binds each row to the story it names, so one scenario can run on
  several stories;
- a `@desktop` or `@mobile` tag runs a scenario (or an Examples block) on that device only;
- a `#` comment line among a scenario's steps starts a named group of the steps after it, up to the next
  comment or blank line; the living spec shows it as a collapsible section;
- scenario titles are free text.

```gherkin
Feature: Badge

    @story:With_Count
    Scenario: Shows the count after the label
        Then I should assert that the element with id "badge" contains "Unread"
        And I should assert that the element with id "badge-count" has an exact value of "3"

    Scenario Outline: The tone follows the badge's meaning
        Then I should assert that the element with id "badge" has an attribute "data-tone" with value "<tone>"

        Examples:
            | story      | tone    |
            | Success    | success |
            | With Count | warning |
```

## Steps

Each step is data: a keyword, its wording (a
[Cucumber expression](https://github.com/cucumber/cucumber-expressions)), a one-line meaning, an example and a
run function. Run functions query the DOM by test id and act through an injected driver (click, hover,
geolocation), so they don't depend on a browser runner. The generated catalog lists every step with its meaning
and an example.

A step can be marked `discouraged: { reason, instead? }`: the catalog shows the reason, and the linter warns
about each use without failing. `I wait for "N" seconds` is discouraged: a fixed sleep hides timing bugs and slows
every run, and the steps that check the page already wait for it.

The DOM rules:

- **Visible** means a non-empty bounding box and not `visibility: hidden`.
- **Strict lookups:** an element a step acts on, or checks the type or an attribute of, must be the only match.
  The two text steps read the first match.
- **Text** is trimmed and its line breaks normalized before comparing.
- **Polling:** text assertions re-read for up to 10 s, every 200 ms; type and attribute assertions for 5 s;
  visibility waits for 25 s. After a hover or click over an element, the step pauses 1.5 s.

### Registering the steps yourself

The runner registers the library's and the project's steps. To use them with another Cucumber setup:

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

`driver` implements `click(element)`, `hover(element)` and `setGeolocation(permission, latitude, longitude)` for
the runner in use.

## Step catalog

`zucchini catalog` writes every available step (keyword, wording, parameter types, meaning, example, whether
it's discouraged, and whether it comes from the library or the project) as `steps.json`, for tools and agents,
and a readable `steps.md`, in the config's `catalog` folder. It runs in Node, without a browser.

```sh
zucchini catalog [--out <dir>] [--project-steps <module>] [--command <text>] [--check]
```

`--out` and `--project-steps` override the config. `--check` writes nothing and exits 1 when the committed files
differ from what the step definitions produce; run it in CI. `--command` is the command the files, the error
message and the linter tell people to run, such as `npm run catalog`.

## Contract linter

`zucchini lint` parses every `*.feature` in the config's `contracts` folder with the official Gherkin parser,
checks it against the catalog, and reports, as `file:line: message`:

- a step that matches no step in the catalog, or more than one (outline steps are checked with their Examples
  values filled in);
- a `@story:` tag or `story` value naming a story that isn't in the matching story file;
- a scenario with no story binding, or with two;
- a feature file with no story file beside it, or one that doesn't parse;
- as a warning, which doesn't fail the lint: a discouraged step.

It then lists the stories without a contract, and exits 1 if there was any problem.

The linter checks steps against the committed catalog, not the step definitions, so a step that was just added to
the code but not yet to the catalog shows up as unknown. Unknown- and ambiguous-step errors name the catalog file
and the command that regenerates it.

```sh
zucchini lint [--catalog <steps.json>] [--root <dir>]
```

Story names come from Storybook's CSF reader, an internal Storybook API used in one module of Zucchini.

## Running the contracts

The runner renders each story with Storybook's Vitest add-on, in Vitest's browser mode, and runs the scenarios
bound to it with [`@lotun/vitest-cucumber`](https://github.com/lotun-io/vitest-cucumber), pinned to an exact
version.

- **One project per browser and device,** named `contracts-<browser>-<device>`: Chromium, Firefox and WebKit,
  each on `desktop` (Playwright's default 1280x720 context) and `mobile` (its iPhone 13; Firefox has no mobile
  emulation, so it gets the same size, touch and user agent without `isMobile`).
- **Bindings first.** Before anything runs, the runner binds every scenario to its story, as the linter does,
  and stops on a problem. Only the story files with a contract beside them run.
- **Per story.** A project-level `afterEach` (`runStoryContracts`) runs exactly the scenarios bound to the story
  that just rendered. The first uses that render; each further one gets a fresh mount. Before each scenario the
  mouse is parked in a corner and the geolocation fake is reset, so nothing carries over. A story test fails
  with the first failing scenario's error, pointing at the feature file's lines.
- **Results.** Each scenario's run is recorded in the [results file](#the-results-file), with its name, browser
  (e.g. `webkit-mobile`) and content hash. A run replaces its own browser and device's entries and keeps the
  others', so one file gathers every browser that ran.
- **Driver.** Clicks and hovers go through Vitest's `userEvent`. Geolocation is a fake of the page's
  `navigator.geolocation`: with `allow`, its location requests get the scenario's location; with `deny`, they
  fail as when a visitor blocks them (code 1, `PERMISSION_DENIED`). The contracts check how a component handles
  the answer, the same way in every browser, not whether a browser grants it.

Wiring:

```ts
// vitest.zucchini.config.ts: your Vite config plus the contract projects
import { zucchiniProjects } from '@camperoni/zucchini/runner'
import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config.ts'

export default mergeConfig(viteConfig, defineConfig({ test: { projects: await zucchiniProjects() } }))
```

```ts
// .storybook/preview.ts
import { contractViewports, runStoryContracts } from '@camperoni/zucchini/runner/preview'

// ...
afterEach: runStoryContracts,
parameters: { viewport: { options: { ...INITIAL_VIEWPORTS, ...contractViewports } } },
```

`runStoryContracts` does nothing outside a contract run, so your normal Storybook is unaffected. `zucchiniProjects()`
takes:

| Option           | Default               | What it sets                                                                                                                                                                            |
| ---------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `root`           | the working directory | Where the Zucchini config lives.                                                                                                                                                        |
| `configDir`      | `.storybook`          | Storybook's config folder.                                                                                                                                                              |
| `browsers`       | all three             | `chromium`, `firefox`, `webkit`.                                                                                                                                                        |
| `devices`        | both                  | `desktop`, `mobile`.                                                                                                                                                                    |
| `port`           | `63315`               | The port the browser tests are served on, and only that one: an API key restricted by referrer accepts only known ports. Vitest's own browser port, clear of a Vite dev server on 5173. |
| `contextOptions` | none                  | Added to every browser context, e.g. `{ timezoneId }`.                                                                                                                                  |
| `testTimeout`    | 300 s                 | Per story test, which runs every scenario bound to the story.                                                                                                                           |

Run them with `zucchini contracts`, which runs the projects one after the other (they share a port), keeps going
after a failure (Ctrl-C stops it), prints each run's result and time, and exits 1 if any failed. Arguments after
`--` go to Vitest, e.g. a story file to run only that one. Each browser needs `npx playwright install <browser>`.

```sh
zucchini contracts --config vitest.zucchini.config.ts [--browser chromium,firefox,webkit] [--device desktop,mobile]
```

The browser defaults to `chromium`, the devices to both.

`zucchini merge-results` merges results files, such as one per browser from separate CI jobs, into the config's
results file (or `--out`); the latest run of a scenario on a browser wins:

```sh
zucchini merge-results <results.json>... [--out <file>]
```

## The living spec in Storybook

Each component's docs page shows its contracts after Storybook's default docs: every scenario with the stories it
runs on (linked), its steps and groups, its Examples, its last result (passed, failed, changed since its last
run, or not run yet) and the browsers and devices it ran on. A failed scenario names the browsers it failed on. A
component without a contract shows a short note. The overview page lists every contract and the stories without
one.

Zucchini's Vite plugin builds this in Node and serves it to the docs pages as a virtual module, in dev and in the
build. It reads `contracts` and `results` from the config; its `dir` and `results` options override them.

```ts
// .storybook/main.ts
import { zucchiniPlugin } from '@camperoni/zucchini/vite'

// ...
viteFinal: (config) => ({ ...config, plugins: [...(config.plugins ?? []), zucchiniPlugin()] }),
```

```ts
// .storybook/preview.ts
import { ContractsDocsPage } from '@camperoni/zucchini/storybook'

// ...
parameters: { docs: { page: ContractsDocsPage } },
```

```mdx
{/* src/Contracts.mdx: the overview page */}
import { Meta } from '@storybook/addon-docs/blocks'
import { ContractsOverview } from '@camperoni/zucchini/storybook'

<Meta title="Living Spec/Contracts" />

<ContractsOverview />
```

In CI, run the contracts before building Storybook (or merge the results from your contract jobs into the
results file), so the published Storybook shows the results for the commit it was built from.

## The results file

The results file (the config's `results`) is optional; without it every scenario shows "not run yet". The
runner writes it as:

```json
{
  "ranAt": "2026-11-02T10:00:00Z",
  "scenarios": [
    {
      "file": "src/Badge/Badge.feature",
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
  `<placeholders>`. When it isn't the name of the pickle now at `file` and `line` (the scenario moved, or was
  renamed), the entry is ignored, so the scenario shows "not run yet" instead of borrowing another scenario's
  result. An entry without `name` is matched by `file` and `line` alone.
- `browser` (optional): a free label for the browser and device, such as `webkit-mobile`.
- `hash` (optional): the pickle's content hash when it ran (see below). When it is no longer the hash of the
  pickle at `file` and `line`, the scenario was edited since: the entry is stale, and the scenario or row shows
  "changed since last run". An entry without `hash` is taken as current.
- `durationMs`, `error` and `ranAt` (all optional): how long it took, the failure's message, and when it ran
  (defaulting to the file's `ranAt`).

A pickle with several entries (one per browser) has passed once all of them passed, and failed when any failed.
Current entries outweigh stale ones; a pickle with only stale entries is "changed since last run".

### The content hash

`pickleHash(content)`, exported from the package, computes it with Web Crypto, so the view (in Node) and the
runner (in the browser) get the same value. It covers:

1. `name`: the pickle's name, as above;
2. `steps`: every step the pickle runs, in order, Background steps first, each as its keyword as written (`Given`,
   `When`, `Then`, `And`, `But` or `*`, without surrounding spaces) and its text with the Examples row's values
   filled in;
3. `values`: the Examples row's cells in column order, or none for a plain scenario.

Doc strings and data tables are not covered. The hash is the first 12 hex digits of the SHA-256 of the UTF-8 JSON
array `[name, [[keyword, text], ...], [value, ...]]`.
