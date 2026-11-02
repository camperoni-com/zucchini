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

## The contracts aren't run yet

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
