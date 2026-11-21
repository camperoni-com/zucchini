# Steps

## Overview

The step library: the generic Gherkin steps a contract can use, written as plain data. Each step is a
`StepDefinition` with a keyword, its wording (a Cucumber expression), a one-line meaning, an example, and a `run`
function. Run functions read the DOM directly and act through an injected `Driver`, so this directory never imports a
browser runner or a particular Cucumber implementation. The runner (`src/runner`) supplies the driver and Cucumber's
`Given`/`When`/`Then`; the catalog (`src/catalog`) and the linter (`src/contracts`) read the same definitions.

## Interface

- `types.ts`: the public types, re-exported from the package entry (`src/index.ts`).
  - `StepKeyword`: `'Given' | 'When' | 'Then'`.
  - `Driver`: `click(element)`, `hover(element)`, `setGeolocation(permission, latitude, longitude)`, all returning
    `Promise<void>`. Implemented by the runner (`src/runner/driver.ts`).
  - `Budgets`: `assertionMs`, `pollMs`, `expectMs`, `visibilityMs`, `settleMs`, in milliseconds.
  - `StepContext`: `{ driver, testIdAttribute, budgets, document }`.
  - `Discouraged`: `{ reason, instead? }`.
  - `StepDefinition`: `{ keyword, wording, meaning, example, discouraged?, run(context, ...args) }`.
- `dom.ts`: DOM rules shared by the steps.
  - `DEFAULT_TEST_ID_ATTRIBUTE` (`'data-testid'`) and `DEFAULT_BUDGETS` (`assertionMs: 10000`, `pollMs: 200`,
    `expectMs: 5000`, `visibilityMs: 25000`, `settleMs: 1500`). Both are exported from the package.
  - `createStepContext({ driver, testIdAttribute?, budgets?, document? })`: fills in the defaults; `budgets` is
    merged over `DEFAULT_BUDGETS`, and `document` defaults to `globalThis.document`. Exported from the package.
  - Helpers: `sleep`, `attributeSelector`, `testIdSelector`, `queryAll`, `byTestId`, `isVisible`,
    `normalizeReceived`, `normalizeExpected`, `readUntil`, `waitForVisible`, `waitForHidden`.
- `library.ts`: the steps themselves and `librarySteps`, the list in catalog order: `textContains`, `textEquals`,
  `elementType`, `attributeValue`, `visibility`, `clickByTestId`, `clickByAttribute`, `hoverOrClick`, `waitSeconds`
  (discouraged), `setGeolocation`. `librarySteps` is exported from the package.
- `register.ts`: `registerSteps(cucumber, { context, projectSteps? })` registers the library's steps and then the
  project's with the given `CucumberDefiners` (a `Record<StepKeyword, DefineStep>`), and returns the combined list.
  `registerSteps`, `CucumberDefiners` and `DefineStep` are exported from the package.
- `expressions.ts`: `compileWording(wording, registry?)` returns `{ parameterTypes, matches(text) }` for a Cucumber
  expression without a runner; `compileSteps(steps)` compiles a list against one shared `ParameterTypeRegistry`;
  `CompiledStep<T>` is the result type. Used by the catalog, the linter and `register.ts`.

## Invariants

- The wording of the library's steps is the old end-to-end steps' wording, character for character
  (`library.ts` header comment). The project freezes step wording until a planned redesign: don't rename or reword
  an existing step. A step meant to be replaced gets a `discouraged` entry instead, as `waitSeconds` has.
- Every wording must be unique across library and project steps: `registerSteps` throws
  `Step defined twice: "<wording>"` on a repeat.
- `registerSteps` sets each step function's `length` to the number of parameters in its wording
  (`compileWording(...).parameterTypes.length`), because Cucumber checks the arity of step functions.
- A step's `example` must match its `wording`; `buildCatalog` in `src/catalog` throws when it doesn't.
- Run functions never import a browser runner. They read through `context.document` and act through
  `context.driver` (`types.ts` header comment).
- Visibility follows Playwright's definition: a non-empty bounding box and computed `visibility` not `hidden`
  (`isVisible`).
- An element a step acts on must be the only match: `waitForVisible` throws
  `strict mode violation: <selector> resolved to <n> elements` when more than one element matches.
- Text is compared after normalizing both sides: `normalizeReceived` turns `\r\n` and `\r` into `\n` and trims;
  `normalizeExpected` drops a literal `\r` written in the feature file and trims.
- Assertions poll until they hold or their budget runs out (`readUntil`, pausing `pollMs` between reads). Text
  steps use `assertionMs`, tag-name and attribute steps use `expectMs`, and visibility waits use `visibilityMs`.
- `visibility` accepts only `"is_visible"` or `"is_not_visible"`, and `hoverOrClick` only `"hover"` or `"click"`;
  anything else throws. For `"is_not_visible"`, an absent element counts as hidden (`waitForHidden`).
- `textContains` and `textEquals` read the first element with the test id; `elementType` and `attributeValue`
  require exactly one.

## Side Effects

- Reads the DOM of `context.document` (`querySelectorAll`, `getBoundingClientRect`, `getComputedStyle`).
- Acts on the page only through `context.driver` (`click`, `hover`, `setGeolocation`).
- `visibility` with `"is_visible"` scrolls the element into view (`scrollIntoView({ block: 'nearest' })`).
- Timers: `sleep` (`setTimeout`) between polls, after a hover or click (`settleMs`), and in `waitSeconds`.
- `registerSteps` calls the given Cucumber definers once per step; this registration is the only state it changes.

## Verification

- Run: `npm test` (all unit tests), or `npx vitest run src/steps` for this directory's tests only.
