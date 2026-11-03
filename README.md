# living-spec (working name)

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

One file at the project root holds the project's settings: `living-spec.config.ts`, or
`living-spec.config.mts` in a project whose `package.json` isn't `"type": "module"` (Node then loads it as
an ES module without a warning). The catalog command, the contract linter and the Storybook plugin read it
from the working directory; command-line flags and plugin options override it. Without a config file, the
defaults apply. Paths are relative to the project root.

```ts
// living-spec.config.ts
import { defineConfig } from 'living-spec'

export default defineConfig({
  contracts: 'src', // the folder holding the contracts and their stories
  catalog: 'docs/living-spec', // where the catalog command writes steps.json and steps.md
  projectSteps: 'test/projectSteps.ts', // optional: a module exporting `projectSteps`
  results: 'test-results/living-spec.json', // the results file the runner writes and the spec view reads
  testIdAttribute: 'data-testid', // the attribute the steps look elements up by
})
```

| Setting           | Default                         | Read by                        | Overridden by                                        |
| ----------------- | ------------------------------- | ------------------------------ | ---------------------------------------------------- |
| `contracts`       | `src`                           | linter, Storybook plugin       | `lint.ts --root`, plugin option `dir`                |
| `catalog`         | `docs/living-spec`              | catalog command, linter        | `catalog.ts --out`, `lint.ts --catalog <steps.json>` |
| `projectSteps`    | none                            | catalog command                | `catalog.ts --project-steps`                         |
| `results`         | `test-results/living-spec.json` | Storybook plugin (runner soon) | plugin option `results`                              |
| `testIdAttribute` | `data-testid`                   | the runner (not yet built)     |                                                      |

An unknown setting, or one that isn't a string, is an error.

### Project steps

A project's own steps are defined the same way as the library's (see [Steps](#steps)), in a module that
exports them as `projectSteps`:

```ts
// test/projectSteps.ts
import type { StepDefinition } from 'living-spec'

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
`bin/fixtures/project/` is a small project set up this way.

Camperoni's config is `living-spec.config.mts` at the repo root. It has no project steps yet, so it leaves
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

### The contracts aren't run yet

The contracts beside the stories are linted but not executed. They will run as Vitest browser tests once
the repo is on Vite 7 and Vitest 4 (the runner slice of PRD #1428). Until then, the old Storybook E2E
scenarios in `e2e/features` keep running unchanged.

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
import { createStepContext, registerSteps } from 'living-spec'

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

`bin/catalog.ts` writes every available step (keyword, wording, parameter types, meaning, example, and
whether it comes from the library or the project) as `steps.json` and a readable `steps.md` in the config's
`catalog` folder. It runs on Node's built-in TypeScript support, without a browser:

```sh
node packages/living-spec/bin/catalog.ts [--out <dir>] [--project-steps <module>] [--command <text>] [--check]
```

`--out` and `--project-steps` override the config's `catalog` and `projectSteps`. `--check` writes nothing
and exits 1 when the committed files differ from what the definitions produce; `--command` is the command
the files, the error message and the linter tell people to run (stored as the catalog's `generatedBy`).

In Camperoni the catalog is committed in `docs/living-spec/`; `npm run living-spec:catalog` regenerates it,
and CI runs `npm run living-spec:catalog:check`.

## Contract linter

`bin/lint.ts` parses every `*.feature` in the config's `contracts` folder with the official Gherkin parser,
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
node packages/living-spec/bin/lint.ts [--catalog <steps.json>] [--root <dir>]
```

`--catalog` names the catalog file to check against and `--root` the folder of contracts, overriding the
config.

Story names come from Storybook's CSF reader, an internal Storybook API; `src/contracts/stories.ts` is the
only module that uses it. In Camperoni, `npm run living-spec:lint` lints `src/` and runs in CI.

## Spec view in Storybook

Each component's docs page shows its contracts after the default autodocs blocks: every scenario with the
stories it runs on (linked), its steps, its Examples, and its last result (passed, failed, changed since its last run, or not run yet).
A `#` comment line among a scenario's steps starts a named, collapsible group of the steps after it, up to
the next comment or blank line. A component without a contract shows a short "no contract" note. The
overview page (`src/storybook/Overview.mdx`, "Living Spec/Contracts") lists every contract and the stories
without one.

- `src/view/viewModel.ts` turns a parsed feature, its bindings and optional results into the view model.
- `src/storybook/vitePlugin.ts` builds the view models in Node and serves them as the virtual module
  `virtual:living-spec/contracts`, in dev and in the build. It reads `contracts` and `results` from the
  config at its `root` (the working directory by default); its `dir` and `results` options override them. It uses only `resolveId`, `load` and
  `addWatchFile`, which are stable across Vite 5 to 8.
- `src/storybook/ContractsDocsPage.tsx` is the docs page: Storybook's `DocsPage` followed by the contracts.

Wiring, as in Camperoni's `.storybook/`:

```ts
// main.ts
stories: [..., '../packages/living-spec/src/storybook/*.mdx'],
viteFinal: (config) => ({
  ...config,
  plugins: [...(config.plugins ?? []), livingSpecPlugin()],
}),

// preview.ts
parameters: { docs: { page: ContractsDocsPage } }
```

### The results file

The results file (the config's `results`) is optional; without it every scenario shows "not run yet". The
contract runner will write it as:

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
