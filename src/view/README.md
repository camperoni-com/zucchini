# view

## Overview

Turns contracts and their recorded results into the living spec's view model: the data the Storybook doc
blocks in [`../storybook`](../storybook/README.md) render. It reads each `.feature` contract, binds it to its
stories, matches the results the contract runner recorded to each scenario and Examples row, and works out a
status for every row, scenario and contract.

`specData.ts` runs in Node, called by the Vite plugin. `viewModel.ts` holds the types and the pure
transformation. `pickleHash.ts` and `describeRuns.ts` import nothing, so they also run in the browser: the
runner hashes pickles in the browser, and the doc blocks call `describeRuns`.

## Interface

- `buildSpecData({ root?, dir, results? }) => Promise<{ spec: SpecData; files: string[] }>`
  (`specData.ts`): builds everything the spec view shows, and lists the files it depends on so the Vite plugin
  can watch them. `dir` and `results` are relative to `root`, which defaults to `process.cwd()`.
- `SpecData` (`specData.ts`): `{ contracts: ContractView[]; uncovered: UncoveredView[]; ranAt: string | null }`.
- `UncoveredView` (`specData.ts`): `{ title; componentId?; stories: StoryLink[] }`, the stories in a story file
  that no contract covers.
- `buildContractView({ file, doc, text, binding, storyFile?, results? }) => Promise<ContractView>`
  (`viewModel.ts`): the view model for one contract. `doc` is a `GherkinDocument` from `@cucumber/messages`,
  `binding` a `FeatureBinding` from `../contracts/bindings.ts`, `storyFile` a `StoryFile` from
  `../contracts/stories.ts`.
- `groupSteps({ steps, after, comments, lines }) => StepGroupView[]` (`viewModel.ts`): splits a scenario's
  steps into groups at blank lines and comment lines.
- View model types (`viewModel.ts`): `Status`, `ContractView`, `ScenarioView`, `ExamplesView`,
  `ExampleRowView`, `StepGroupView`, `StepView`, `StoryLink`.
- Results file types (`viewModel.ts`): `Results` (`{ ranAt; scenarios: ScenarioResult[] }`) and
  `ScenarioResult` (`{ file; line; name?; browser?; hash?; status; durationMs?; error?; ranAt? }`). The runner
  (`../runner`), the mutation check (`../mutation`) and `zucchini merge-results` (`../cli`) use these too.
- `pickleHash(content: PickleContent) => Promise<string>`, `PickleContent` and `PICKLE_HASH_LENGTH`
  (`pickleHash.ts`): a short content hash of a pickle. Re-exported from the package root (`src/index.ts`).
- `describeRuns(labels: readonly string[]) => string` (`describeRuns.ts`): says in words which browsers and
  devices a scenario ran on.

## Invariants

- `Status` is exactly `'passed' | 'failed' | 'changed' | 'not-run'`.
- A result belongs to a pickle when its `file` and `line` match and its `name` is missing or equals the
  pickle's name. A result whose `hash` differs from `pickleHash` of the pickle's current content is stale; a
  result without a `hash` counts as current.
- A result fails when its `status` is anything other than `passed`, `skipped` or `pending`, so `undefined`,
  `ambiguous` and unknown strings count as failures.
- A pickle's status: from its current results, any failure gives `failed`, all `passed` gives `passed`,
  anything else gives `not-run`. With only stale results it is `changed`; with none, `not-run`.
- Scenarios and contracts roll up the same way: any `failed` gives `failed`; a non-empty list that is all
  `passed` gives `passed`; otherwise any `changed` gives `changed`; else `not-run`. A scenario passes only
  when every Examples row has passed.
- `failedOn` keeps the browser labels of failing current results, in the order first seen; stale failures are
  left out. `ranOn` lists current browser labels, sorted. A scenario's `error` is the first current failure's
  message. A scenario's `ranAt` is the latest `ranAt` over its current and stale results, each falling back to
  the results file's `ranAt`.
- Stories are deduplicated by id, keeping first-seen order. `componentId` is the part of the first story's id
  before `--`.
- In `groupSteps`, a comment line not followed by a blank line starts a titled group (the comment without its
  `#`); a blank line starts an untitled group.
- `buildSpecData` leaves out a feature that doesn't parse (the linter reports it). A story file appears in
  `uncovered` only if at least one of its stories is in no scenario. `files` lists every feature, then every
  story file, then the results file only if it was read.
- `pickleHash` is the first 12 lower-case hex digits (`PICKLE_HASH_LENGTH`) of the SHA-256 of the UTF-8 JSON
  `[name, [[keyword, text], ...], values]`. Doc strings and data tables are not covered. The runner and the
  view must compute it identically, so changing the input or length makes every recorded result stale.
- `pickleHash.ts` and `describeRuns.ts` must keep importing nothing, since they run in the browser.
- `describeRuns` reads as "Chromium and WebKit, desktop and mobile" only when every label matches
  `<chromium|firefox|webkit>-<desktop|mobile>` and the labels cover every browser on every device. Otherwise it
  lists the labels as given ("a, b and c"); an empty list gives `''`.

## Side Effects

- `buildSpecData` finds contracts and story files through `findContracts` (`../contracts/load.ts`), which
  globs and reads them under `dir`.
- `buildSpecData` reads the results file with `fs.existsSync` and `fs.readFileSync`, and parses it with
  `JSON.parse` without catching errors, so a malformed results file throws. A missing file means no results.
- `pickleHash` uses `globalThis.crypto.subtle` and `TextEncoder`. It is deterministic.
- `buildContractView`, `groupSteps` and `describeRuns` do no I/O.

## Verification

- Run: `npm test` (unit tests in `viewModel.spec.ts` and `pickleHash.spec.ts`)
