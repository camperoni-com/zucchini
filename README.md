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
whether it comes from the library or the project) as `steps.json` and a readable `steps.md`. It runs on
Node's built-in TypeScript support, without a browser:

```sh
node packages/living-spec/bin/catalog.ts --out <dir> [--project-steps <module>] [--command <text>] [--check]
```

A `--project-steps` module exports `projectSteps`, an array of step definitions. `--check` writes nothing
and exits 1 when the files in `<dir>` differ from what the definitions produce; `--command` is the command
the files and the error message tell people to run.

In Camperoni the catalog is committed in `docs/living-spec/`; `npm run living-spec:catalog` regenerates it,
and CI runs `npm run living-spec:catalog:check`.

## Contract linter

`bin/lint.ts` parses every `*.feature` under `--root` with the official Gherkin parser and reports, as
`file:line: message`:

- a step that matches no step in the catalog, or more than one (outline steps are checked with their
  Examples values filled in);
- a `@story:` tag or `story` value naming a story that isn't in the matching story file;
- a scenario with no story binding, or with two;
- a feature file with no story file beside it, or one that doesn't parse.

It then lists the stories without a contract, and exits 1 if there was any problem.

```sh
node packages/living-spec/bin/lint.ts --catalog <steps.json> [--root <dir>]
```

Story names come from Storybook's CSF reader, an internal Storybook API; `src/contracts/stories.ts` is the
only module that uses it. In Camperoni, `npm run living-spec:lint` lints `src/` and runs in CI.

## Spec view in Storybook

Each component's docs page shows its contracts after the default autodocs blocks: every scenario with the
stories it runs on (linked), its steps, its Examples, and its last result (passed, failed, or not run yet).
A `#` comment line among a scenario's steps starts a named, collapsible group of the steps after it, up to
the next comment or blank line. A component without a contract shows a short "no contract" note. The
overview page (`src/storybook/Overview.mdx`, "Living Spec/Contracts") lists every contract and the stories
without one.

- `src/view/viewModel.ts` turns a parsed feature, its bindings and optional results into the view model.
- `src/storybook/vitePlugin.ts` builds the view models in Node and serves them as the virtual module
  `virtual:living-spec/contracts`, in dev and in the build. It uses only `resolveId`, `load` and
  `addWatchFile`, which are stable across Vite 5 to 8.
- `src/storybook/ContractsDocsPage.tsx` is the docs page: Storybook's `DocsPage` followed by the contracts.

Wiring, as in Camperoni's `.storybook/`:

```ts
// main.ts
stories: [..., '../packages/living-spec/src/storybook/*.mdx'],
viteFinal: (config) => ({
  ...config,
  plugins: [...(config.plugins ?? []), livingSpecPlugin({ dir: 'src', results: 'test-results/living-spec.json' })],
}),

// preview.ts
parameters: { docs: { page: ContractsDocsPage } }
```

The results file is optional; without it every scenario shows "not run yet". The contract runner will write
it as `{ "ranAt": "<ISO time>", "scenarios": [{ "file", "line", "status", "durationMs", "error" }] }`, where
`file` is the feature path relative to the project root and `line` is the line of the scenario, or of the
Examples row for an outline.
