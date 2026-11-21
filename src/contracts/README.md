# Contracts

## Overview

Reads contract `.feature` files, binds each scenario to the Storybook story it runs on, and lints the contracts.
The binding convention (`bindings.ts` header comment):

- `<Component>.feature` sits beside the story file whose title's last segment is `<Component>` (so
  `Cards/Badge`, not `Cards/MyBadge`) and holds its contracts.
- A `@story:Story_Name` tag binds a scenario to one story. `_` stands for a space, since Gherkin tags can't contain
  one.
- A `story` column in a Scenario Outline's Examples binds each row to the story it names.
- Scenario titles are free text.

The runner (`src/runner/bindings.ts`), the living spec (`src/view`), the mutation check (`src/mutation`) and the
`zucchini lint` and `zucchini mutation` commands (`src/cli`) all use this directory, so they agree on which
scenario runs on which story.

## Interface

- `bindings.ts`: parsing and binding.
  - `STORY_TAG` (`'@story:'`), `STORY_COLUMN` (`'story'`), `storyFromTag(tag)`, `tagForStory(name)`.
  - `componentOf(title)`: the last `/` segment of a story title, which names the feature file.
  - `Problem`: `{ file, line, message }`.
  - `parseFeature(text, file)`: returns `{ doc?, problems }`; a file that doesn't parse returns problems at the
    parser's lines and no `doc`.
  - `scenariosOf(doc)`: the scenarios of a feature, including those inside a `Rule`.
  - `stepsById(doc)`: every step by id, Background steps included.
  - `BoundPickle`: `{ pickle, scenario, row?, line, story?, content }`, where `content` is the `PickleContent`
    from `src/view/pickleHash.ts`.
  - `FeatureBinding`: `{ pickles, problems }`.
  - `bindFeature(doc, storyFile)`: compiles the feature into pickles and binds each to a story of `storyFile`, or
    reports why it can't.
  - `dedupe(problems)`: drops repeats of the same file, line and message.
- `lint.ts`: the contract linter.
  - `ContractFile` (`{ file, text }`), `UncoveredStories`, `CatalogSource` (`{ file, command }`), `LintResult`
    (`{ problems, warnings, uncovered, scenarios, stories }`).
  - `storyFileFor(featureFile, storyFiles)`: the story file in the same folder whose title's last `/` segment
    equals the feature file's name; when several do, the first in `storyFiles` order.
  - `lintContracts({ features, storyFiles, steps, catalog? })`: checks every step against the catalog's steps and
    every scenario's story binding, and lists the stories no contract covers.
  - `formatLintResult(result, featureCount)`: the linter's text report.
- `load.ts`: `STORY_FILE_PATTERN` (`'**/*.stories.{ts,tsx,js,jsx,mjs}'`) and `findContracts({ root?, dir })`, which
  reads every `**/*.feature` file and story file under `dir`. Node only.
- `stories.ts`: `Story` (`{ name, id }`), `StoryFile` (`{ file, title, stories }`), and `readStoryFile(file)`,
  which reads a story file's title and stories with Storybook's CSF reader.

None of these are exported from the package entry (`src/index.ts`); they are internal to Zucchini.

## Invariants

- A pickle binds to at most one story. `bindFeature` reports a problem when a scenario has more than one
  `@story:` tag, has both a tag and a `story` column, names no story, or names a story that isn't in the story file
  (that message lists the file's stories). A bound pickle gets `story` only when the binding is valid and a story
  file was found.
- For an unknown story, the problem points at the scenario line for a tag and at the Examples row for a column.
- Each step of a contract must match exactly one catalog step. No match is an `unknown step` problem and more than
  one is an `ambiguous step` problem; both end with a hint to regenerate the catalog.
- A step marked `discouraged` is a warning, not a problem: it doesn't fail the lint.
- A feature file with no story file beside it whose title's last segment is its name is a problem at line 1. A
  feature file that doesn't parse gets only its parse problems: no story-file check and no step matching.
- Problems and warnings are deduplicated (same file, line and message) and sorted by file, then line. An Examples
  table repeats its steps per row, so a step whose text doesn't change between rows is reported once.
- `LintResult.scenarios` counts scenarios, not pickles: an outline counts once, however many rows it has.
- `findContracts` returns paths as given: relative to `root` for a relative `dir`, absolute for an absolute one.
  Results are sorted.
- `stories.ts` is the only module that imports Storybook's internal CSF reader (`storybook/internal/csf-tools`),
  so a change in that API touches this file alone.
- A story's `name` falls back to its id when the CSF reader gives no name; a missing title becomes `''`.

## Side Effects

- `load.ts` reads the file system: `fs.globSync` under `dir` (relative to `root`, which defaults to
  `process.cwd()`) and `fs.readFileSync` for each feature file.
- `stories.ts` reads each story file from disk through `readCsf`.
- `bindings.ts` and `lint.ts` are pure: they work on text and parsed documents and return values.

## Verification

- Run: `npm test` (all unit tests), or `npx vitest run src/contracts` for this directory's tests only. The tests
  read the story file in `fixtures/Badge`.
