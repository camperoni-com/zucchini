import path from 'node:path'

import { beforeAll, describe, expect, test } from 'vitest'

import { librarySteps } from '../steps/library.ts'
import { formatLintResult, lintContracts } from './lint.ts'
import { readStoryFile, type StoryFile } from './stories.ts'

const dir = path.join(__dirname, 'fixtures', 'Badge')
const featureFile = path.join(dir, 'Badge.feature')

let badge: StoryFile

beforeAll(async () => {
  badge = await readStoryFile(path.join(dir, 'Badge.stories.ts'))
})

const lint = (
  text: string,
  { file = featureFile, steps = librarySteps }: { file?: string; steps?: readonly { wording: string }[] } = {}
) => lintContracts({ features: [{ file, text }], storyFiles: [badge], steps })

const feature = (...lines: string[]) => ['Feature: Badge', '', ...lines, ''].join('\n')

const VALID = feature(
  '    @story:With_Label',
  '    Scenario: Shows its label',
  '        Then I should assert that the element with id "badge" contains "New"',
  '',
  '    Scenario Outline: Shows the count',
  '        Then I should assert that the element with id "badge-count" has an exact value of "<count>"',
  '',
  '        Examples:',
  '            | story   | count |',
  '            | Default | 3     |'
)

describe('reading story files', () => {
  test('gives the title and the display name of each story', () => {
    expect(badge.title).toBe('Fixtures/Components/Badge')
    expect(badge.stories.map((s) => s.name)).toEqual(['Default', 'With Label', 'Empty'])
    expect(badge.stories[1].id).toBe('fixtures-components-badge--with-label')
  })
})

describe('lintContracts', () => {
  test('finds no problem in a contract bound by tag and by story column', () => {
    expect(lint(VALID).problems).toEqual([])
    expect(lint(VALID).scenarios).toBe(2)
  })

  test('reports an unknown step with its file and line', () => {
    const result = lint(
      feature(
        '    @story:Default',
        '    Scenario: Shows its label',
        '        Then I should assert that the element with id "badge" contains "New"',
        '        And I should see the badge'
      )
    )
    expect(result.problems).toEqual([
      { file: featureFile, line: 6, message: 'unknown step "And I should see the badge"' },
    ])
  })

  test('checks outline steps with the Examples values filled in, once per line', () => {
    const result = lint(
      feature(
        '    Scenario Outline: Shows the count',
        '        Then I should assert that the element with id "badge" <check> "3"',
        '',
        '        Examples:',
        '            | story   | check                 |',
        '            | Default | has an exact value of |',
        '            | Empty   | is shown as           |',
        '            | Default | is shown as           |'
      )
    )
    expect(result.problems).toEqual([
      {
        file: featureFile,
        line: 4,
        message: 'unknown step "Then I should assert that the element with id "badge" is shown as "3""',
      },
    ])
  })

  test('reports a step that matches more than one step definition', () => {
    const steps = [...librarySteps, { wording: 'I wait for {string} {word}' }]
    const result = lint(feature('    @story:Default', '    Scenario: Waits', '        When I wait for "2" seconds'), {
      steps,
    })
    expect(result.problems).toEqual([
      {
        file: featureFile,
        line: 5,
        message:
          'ambiguous step "When I wait for "2" seconds" matches 2 steps: "I wait for {string} seconds", "I wait for {string} {word}"',
      },
    ])
  })

  test('reports a @story: tag naming a story that does not exist, at the scenario', () => {
    const result = lint(
      feature('    @story:With_Lable', '    Scenario: Shows its label', '        When I wait for "1" seconds')
    )
    expect(result.problems).toEqual([
      {
        file: featureFile,
        line: 4,
        message: 'story "With Lable" is not in Fixtures/Components/Badge. Its stories: Default, With Label, Empty',
      },
    ])
  })

  test('reports a story column value naming a story that does not exist, at its row', () => {
    const result = lint(
      feature(
        '    Scenario Outline: Waits',
        '        When I wait for "<seconds>" seconds',
        '',
        '        Examples:',
        '            | story   | seconds |',
        '            | Default | 1       |',
        '            | Defualt | 2       |'
      )
    )
    expect(result.problems).toEqual([
      {
        file: featureFile,
        line: 9,
        message: 'story "Defualt" is not in Fixtures/Components/Badge. Its stories: Default, With Label, Empty',
      },
    ])
  })

  test('reports a scenario with no story binding', () => {
    const result = lint(feature('    Scenario: Waits', '        When I wait for "1" seconds'))
    expect(result.problems).toEqual([
      {
        file: featureFile,
        line: 3,
        message: '"Waits" names no story: add a @story:<Story_Name> tag or a "story" column',
      },
    ])
  })

  test('reports a scenario bound both by tag and by column, and one with two tags', () => {
    const result = lint(
      feature(
        '    @story:Default',
        '    Scenario Outline: Waits',
        '        When I wait for "1" seconds',
        '',
        '        Examples:',
        '            | story |',
        '            | Empty |',
        '',
        '    @story:Default @story:Empty',
        '    Scenario: Waits again',
        '        When I wait for "1" seconds'
      )
    )
    expect(result.problems.map((p) => `${p.line}: ${p.message}`)).toEqual([
      '4: "Waits" has both a @story: tag and a "story" column; use one',
      '12: "Waits again" has more than one @story: tag (Default, Empty)',
    ])
  })

  test('reports a feature file with no story file beside it', () => {
    const result = lint(VALID, { file: path.join(dir, 'Button.feature') })
    expect(result.problems).toEqual([
      {
        file: path.join(dir, 'Button.feature'),
        line: 1,
        message: 'no story file beside it has a title ending in "Button"',
      },
    ])
  })

  test('reports a feature file that does not parse, with its line', () => {
    const result = lint(
      feature('    Scenario: Waits', '        When I wait for "1" seconds', '    this is not Gherkin')
    )
    expect(result.problems).toHaveLength(1)
    expect(result.problems[0]).toMatchObject({ file: featureFile, line: 5 })
  })

  test('lists the stories no contract covers', () => {
    expect(lint(VALID).uncovered).toEqual([{ title: badge.title, file: badge.file, stories: ['Empty'] }])
  })
})

describe('formatLintResult', () => {
  test('prints each problem as file:line, then the uncovered stories and a summary', () => {
    const result = lint(feature('    Scenario: Waits', '        When I wait for "1" seconds'))
    expect(formatLintResult(result, 1)).toBe(
      [
        `${featureFile}:3: "Waits" names no story: add a @story:<Story_Name> tag or a "story" column`,
        '',
        'Stories without a contract: 3 of 3',
        `  Fixtures/Components/Badge (${badge.file}): Default, With Label, Empty`,
        '',
        '1 problem in 1 contract files.',
        '',
      ].join('\n')
    )
  })

  test('says so when there is no problem', () => {
    expect(formatLintResult(lint(VALID), 1)).toContain('1 contract files, 2 scenarios: no problems.')
  })
})
