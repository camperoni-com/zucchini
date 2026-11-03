import { describe, expect, test } from 'vitest'

import { bindFeature, parseFeature } from '../contracts/bindings.ts'
import type { StoryFile } from '../contracts/stories.ts'
import { buildContractView, type Results } from './viewModel.ts'

const FILE = 'src/Badge/Badge.feature'

const storyFile: StoryFile = {
  file: 'src/Badge/Badge.stories.ts',
  title: 'Fixtures/Components/Badge',
  stories: [
    { name: 'Default', id: 'fixtures-components-badge--default' },
    { name: 'With Label', id: 'fixtures-components-badge--with-label' },
    { name: 'Empty', id: 'fixtures-components-badge--empty' },
  ],
}

const view = (lines: string[], results?: Results | null) => {
  const text = ['Feature: Badge', '', ...lines, ''].join('\n')
  const { doc } = parseFeature(text, FILE)
  if (!doc) {
    throw new Error('fixture does not parse')
  }
  return buildContractView({ file: FILE, doc, text, binding: bindFeature(doc, storyFile), storyFile, results })
}

const groupsOf = (lines: string[]) =>
  view(['    @story:Default', '    Scenario: Grouped', ...lines]).scenarios[0].groups.map((group) => ({
    title: group.title,
    steps: group.steps.map((step) => `${step.keyword} ${step.text}`),
  }))

describe('# comment groups', () => {
  test('a comment names the steps after it, up to the next comment', () => {
    expect(
      groupsOf([
        '        # Open the card',
        '        When I click on the element with id "card"',
        '        And I wait for "1" seconds',
        '        # Check the label',
        '        Then I should assert that the element with id "label" contains "New"',
      ])
    ).toEqual([
      { title: 'Open the card', steps: ['When I click on the element with id "card"', 'And I wait for "1" seconds'] },
      { title: 'Check the label', steps: ['Then I should assert that the element with id "label" contains "New"'] },
    ])
  })

  test('a blank line ends a group, and steps before any comment are ungrouped', () => {
    expect(
      groupsOf([
        '        When I wait for "1" seconds',
        '        # Open the card',
        '        When I click on the element with id "card"',
        '',
        '        Then I should assert that the element with id "label" contains "New"',
      ])
    ).toEqual([
      { title: undefined, steps: ['When I wait for "1" seconds'] },
      { title: 'Open the card', steps: ['When I click on the element with id "card"'] },
      { title: undefined, steps: ['Then I should assert that the element with id "label" contains "New"'] },
    ])
  })

  test('a comment followed by a blank line names nothing', () => {
    expect(
      groupsOf(['        # A note about the scenario', '', '        When I click on the element with id "card"'])
    ).toEqual([{ title: undefined, steps: ['When I click on the element with id "card"'] }])
  })

  test("a data table's rows keep its step in the group", () => {
    expect(
      groupsOf([
        '        # Fill in',
        '        When I click on the element with id "card"',
        '            | a | b |',
        '        And I wait for "1" seconds',
      ]).map((group) => [group.title, group.steps.length])
    ).toEqual([['Fill in', 2]])
  })

  test('comments outside the steps are not groups', () => {
    const contract = view([
      '    # Was: e2e/features/badge.feature:12',
      '    @story:Default',
      '    Scenario: Plain',
      '        When I wait for "1" seconds',
    ])
    expect(contract.scenarios[0].groups).toEqual([
      { steps: [{ keyword: 'When', text: 'I wait for "1" seconds', line: 6 }] },
    ])
  })
})

const OUTLINE = [
  '    Scenario Outline: Shows the count',
  '        Then I should assert that the element with id "badge" has an exact value of "<count>"',
  '',
  '        Examples:',
  '            | story      | count |',
  '            | Default    | 3     |',
  '            | With Label | 4     |',
  '            | Default    | 5     |',
]

describe('bound stories', () => {
  test('a tagged scenario runs on its one story', () => {
    const contract = view([
      '    @story:With_Label',
      '    Scenario: Shows its label',
      '        When I wait for "1" seconds',
    ])
    expect(contract.scenarios[0].stories).toEqual([{ name: 'With Label', id: 'fixtures-components-badge--with-label' }])
  })

  test('an outline with a story column runs on each story it names, once each', () => {
    const scenario = view(OUTLINE).scenarios[0]
    expect(scenario.stories.map((s) => s.name)).toEqual(['Default', 'With Label'])
    expect(scenario.examples[0].header).toEqual(['story', 'count'])
    expect(scenario.examples[0].rows.map((row) => [row.cells, row.story?.id])).toEqual([
      [['Default', '3'], 'fixtures-components-badge--default'],
      [['With Label', '4'], 'fixtures-components-badge--with-label'],
      [['Default', '5'], 'fixtures-components-badge--default'],
    ])
  })

  test('a story that does not exist is not linked', () => {
    const contract = view(['    @story:Nope', '    Scenario: Broken', '        When I wait for "1" seconds'])
    expect(contract.scenarios[0].stories).toEqual([])
  })

  test('the contract knows its story file and component id', () => {
    expect(view(OUTLINE)).toMatchObject({
      file: FILE,
      title: 'Fixtures/Components/Badge',
      componentId: 'fixtures-components-badge',
      name: 'Badge',
    })
  })
})

describe('statuses', () => {
  const TAGGED = ['    @story:Default', '    Scenario: Waits', '        When I wait for "1" seconds', '']
  // The tagged scenario is on line 4; the outline's rows are on lines 12, 13 and 14.
  const both = [...TAGGED, ...OUTLINE]

  test('every scenario is "not run yet" without results', () => {
    const contract = view(both, null)
    expect(contract.scenarios.map((s) => s.status)).toEqual(['not-run', 'not-run'])
    expect(contract.scenarios[1].examples[0].rows.map((r) => r.status)).toEqual(['not-run', 'not-run', 'not-run'])
    expect(contract.status).toBe('not-run')
    expect(contract.scenarios[0].ranAt).toBeUndefined()
  })

  test('passed when every run passed, with when it ran', () => {
    const contract = view(both, {
      ranAt: '2026-11-02T10:00:00Z',
      scenarios: [
        { file: FILE, line: 4, status: 'passed' },
        { file: FILE, line: 12, status: 'passed' },
        { file: FILE, line: 13, status: 'passed', ranAt: '2026-11-02T10:05:00Z' },
        { file: FILE, line: 14, status: 'passed' },
      ],
    })
    expect(contract.scenarios.map((s) => [s.status, s.ranAt])).toEqual([
      ['passed', '2026-11-02T10:00:00Z'],
      ['passed', '2026-11-02T10:05:00Z'],
    ])
    expect(contract.status).toBe('passed')
  })

  test('failed when any run failed, with its error, and per row', () => {
    const contract = view(both, {
      ranAt: '2026-11-02T10:00:00Z',
      scenarios: [
        { file: FILE, line: 4, status: 'passed' },
        { file: FILE, line: 12, status: 'passed' },
        { file: FILE, line: 13, status: 'failed', error: 'Expected "3" to equal "4"' },
        { file: FILE, line: 14, status: 'passed' },
      ],
    })
    const outline = contract.scenarios[1]
    expect(outline.status).toBe('failed')
    expect(outline.error).toBe('Expected "3" to equal "4"')
    expect(outline.examples[0].rows.map((r) => r.status)).toEqual(['passed', 'failed', 'passed'])
    expect(contract.scenarios[0].status).toBe('passed')
    expect(contract.status).toBe('failed')
  })

  test('not run yet while some of its rows have no result, and results of other files are ignored', () => {
    const contract = view(both, {
      ranAt: '2026-11-02T10:00:00Z',
      scenarios: [
        { file: FILE, line: 12, status: 'passed' },
        { file: 'src/Other/Other.feature', line: 13, status: 'failed' },
      ],
    })
    expect(contract.scenarios[1].status).toBe('not-run')
    expect(contract.scenarios[1].examples[0].rows.map((r) => r.status)).toEqual(['passed', 'not-run', 'not-run'])
  })
})

describe('matching results by name', () => {
  // Rows on lines 8 and 9; Cucumber names their pickles "Shows 3 on Default" and "Shows 4 on With Label".
  const NAMED = [
    '    Scenario Outline: Shows <count> on <story>',
    '        Then I should assert that the element with id "badge" has an exact value of "<count>"',
    '',
    '        Examples:',
    '            | story      | count |',
    '            | Default    | 3     |',
    '            | With Label | 4     |',
  ]
  const rowStatuses = (scenarios: Results['scenarios']) =>
    view(NAMED, { ranAt: '2026-11-02T10:00:00Z', scenarios }).scenarios[0].examples[0].rows.map((r) => r.status)

  test("a result named as the row's pickle, with its values filled in, counts", () => {
    expect(
      rowStatuses([
        { file: FILE, line: 8, name: 'Shows 3 on Default', status: 'passed' },
        { file: FILE, line: 9, name: 'Shows 4 on With Label', status: 'failed' },
      ])
    ).toEqual(['passed', 'failed'])
  })

  test('a result whose name is not the pickle at its line is ignored, so the row has not run', () => {
    // The rows were swapped since the run: line 8 is now "Shows 3 on Default".
    expect(
      rowStatuses([
        { file: FILE, line: 8, name: 'Shows 4 on With Label', status: 'failed' },
        { file: FILE, line: 9, name: 'Shows 3 on Default', status: 'passed' },
      ])
    ).toEqual(['not-run', 'not-run'])
  })

  test('a result without a name is matched by its line', () => {
    expect(rowStatuses([{ file: FILE, line: 8, status: 'passed' }])).toEqual(['passed', 'not-run'])
  })
})

describe('failing browsers', () => {
  // The outline's rows are on lines 8, 9 and 10.
  test('a failed scenario and each failed row list the browsers they failed on, once each', () => {
    const scenario = view(OUTLINE, {
      ranAt: '2026-11-02T10:00:00Z',
      scenarios: [
        { file: FILE, line: 8, status: 'passed', browser: 'chromium-desktop' },
        { file: FILE, line: 8, status: 'failed', browser: 'webkit-mobile' },
        { file: FILE, line: 9, status: 'failed', browser: 'firefox-desktop' },
        { file: FILE, line: 9, status: 'failed', browser: 'webkit-mobile' },
        { file: FILE, line: 10, status: 'passed', browser: 'webkit-mobile' },
        { file: FILE, line: 10, status: 'passed', browser: 'firefox-desktop' },
      ],
    }).scenarios[0]
    expect(scenario.status).toBe('failed')
    expect(scenario.failedOn).toEqual(['webkit-mobile', 'firefox-desktop'])
    expect(scenario.examples[0].rows.map((r) => [r.status, r.failedOn])).toEqual([
      ['failed', ['webkit-mobile']],
      ['failed', ['firefox-desktop', 'webkit-mobile']],
      ['passed', []],
    ])
  })

  test('none without browser labels, or when nothing failed', () => {
    const failed = view(OUTLINE, {
      ranAt: '2026-11-02T10:00:00Z',
      scenarios: [{ file: FILE, line: 8, status: 'failed' }],
    })
    expect(failed.scenarios[0].failedOn).toEqual([])
    const passed = view(OUTLINE, {
      ranAt: '2026-11-02T10:00:00Z',
      scenarios: [{ file: FILE, line: 8, status: 'passed', browser: 'webkit-mobile' }],
    })
    expect(passed.scenarios[0].failedOn).toEqual([])
  })
})
