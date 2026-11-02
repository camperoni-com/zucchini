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

| Step                                                                                                    |
| ------------------------------------------------------------------------------------------------------- |
| `Then I should assert that the element with id {string} contains {string}`                              |
| `Then I should assert that the element with id {string} has an exact value of {string}`                 |
| `Then I should assert that the element with id {string} is of type {string}`                            |
| `Then I should assert that the element with id {string} has an attribute {string} with value {string}` |
| `Then I should assert that the {string} element {string} visible`                                       |
| `When I click on the element with id {string}`                                                          |
| `When I click on the element which has an attribute {string} with value {string}`                       |
| `When I {string} over the element with id {string}`                                                     |
| `When I wait for {string} seconds`                                                                      |
| `When I {string} geolocation and set the location to {string}, {string}`                                |

The wording is the old E2E steps' wording, unchanged, so scenarios move over word for word.

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
