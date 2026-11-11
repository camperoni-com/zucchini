import { describe, expect, test } from 'vitest'

import { bindFeature, parseFeature } from '../contracts/bindings.ts'
import type { StoryFile } from '../contracts/stories.ts'
import { describeRuns } from './describeRuns.ts'
import { pickleHash } from './pickleHash.ts'
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

const parse = (lines: string[]) => {
  const text = ['Feature: Badge', '', ...lines, ''].join('\n')
  const { doc } = parseFeature(text, FILE)
  if (!doc) {
    throw new Error('fixture does not parse')
  }
  return { text, doc, binding: bindFeature(doc, storyFile) }
}

const view = async (lines: string[], results?: Results | null) => {
  const { text, doc, binding } = parse(lines)
  return buildContractView({ file: FILE, doc, text, binding, storyFile, results })
}

/** The content hash of each pickle of a contract, in order, as the runner would record it. */
const hashesOf = (lines: string[]) => Promise.all(parse(lines).binding.pickles.map((b) => pickleHash(b.content)))

const groupsOf = async (lines: string[]) =>
  (await view(['    @story:Default', '    Scenario: Grouped', ...lines])).scenarios[0].groups.map((group) => ({
    title: group.title,
    steps: group.steps.map((step) => `${step.keyword} ${step.text}`),
  }))

describe('# comment groups', () => {
  test('a comment names the steps after it, up to the next comment', async () => {
    expect(
      await groupsOf([
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

  test('a blank line ends a group, and steps before any comment are ungrouped', async () => {
    expect(
      await groupsOf([
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

  test('a comment followed by a blank line names nothing', async () => {
    expect(
      await groupsOf(['        # A note about the scenario', '', '        When I click on the element with id "card"'])
    ).toEqual([{ title: undefined, steps: ['When I click on the element with id "card"'] }])
  })

  test("a data table's rows keep its step in the group", async () => {
    const groups = await groupsOf([
      '        # Fill in',
      '        When I click on the element with id "card"',
      '            | a | b |',
      '        And I wait for "1" seconds',
    ])
    expect(groups.map((group) => [group.title, group.steps.length])).toEqual([['Fill in', 2]])
  })

  test('comments outside the steps are not groups', async () => {
    const contract = await view([
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
  test('a tagged scenario runs on its one story', async () => {
    const contract = await view([
      '    @story:With_Label',
      '    Scenario: Shows its label',
      '        When I wait for "1" seconds',
    ])
    expect(contract.scenarios[0].stories).toEqual([{ name: 'With Label', id: 'fixtures-components-badge--with-label' }])
  })

  test('an outline with a story column runs on each story it names, once each', async () => {
    const scenario = (await view(OUTLINE)).scenarios[0]
    expect(scenario.stories.map((s) => s.name)).toEqual(['Default', 'With Label'])
    expect(scenario.examples[0].header).toEqual(['story', 'count'])
    expect(scenario.examples[0].rows.map((row) => [row.cells, row.story?.id])).toEqual([
      [['Default', '3'], 'fixtures-components-badge--default'],
      [['With Label', '4'], 'fixtures-components-badge--with-label'],
      [['Default', '5'], 'fixtures-components-badge--default'],
    ])
  })

  test('a story that does not exist is not linked', async () => {
    const contract = await view(['    @story:Nope', '    Scenario: Broken', '        When I wait for "1" seconds'])
    expect(contract.scenarios[0].stories).toEqual([])
  })

  test('the contract knows its story file and component id', async () => {
    expect(await view(OUTLINE)).toMatchObject({
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

  test('every scenario is "not run yet" without results', async () => {
    const contract = await view(both, null)
    expect(contract.scenarios.map((s) => s.status)).toEqual(['not-run', 'not-run'])
    expect(contract.scenarios[1].examples[0].rows.map((r) => r.status)).toEqual(['not-run', 'not-run', 'not-run'])
    expect(contract.status).toBe('not-run')
    expect(contract.scenarios[0].ranAt).toBeUndefined()
  })

  test('passed when every run passed, with when it ran', async () => {
    const contract = await view(both, {
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

  test('failed when any run failed, with its error, and per row', async () => {
    const contract = await view(both, {
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

  test('not run yet while some of its rows have no result, and results of other files are ignored', async () => {
    const contract = await view(both, {
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
  const rowStatuses = async (scenarios: Results['scenarios']) =>
    (await view(NAMED, { ranAt: '2026-11-02T10:00:00Z', scenarios })).scenarios[0].examples[0].rows.map((r) => r.status)

  test("a result named as the row's pickle, with its values filled in, counts", async () => {
    expect(
      await rowStatuses([
        { file: FILE, line: 8, name: 'Shows 3 on Default', status: 'passed' },
        { file: FILE, line: 9, name: 'Shows 4 on With Label', status: 'failed' },
      ])
    ).toEqual(['passed', 'failed'])
  })

  test('a result whose name is not the pickle at its line is ignored, so the row has not run', async () => {
    // The rows were swapped since the run: line 8 is now "Shows 3 on Default".
    expect(
      await rowStatuses([
        { file: FILE, line: 8, name: 'Shows 4 on With Label', status: 'failed' },
        { file: FILE, line: 9, name: 'Shows 3 on Default', status: 'passed' },
      ])
    ).toEqual(['not-run', 'not-run'])
  })

  test('a result without a name is matched by its line', async () => {
    expect(await rowStatuses([{ file: FILE, line: 8, status: 'passed' }])).toEqual(['passed', 'not-run'])
  })
})

describe('failing browsers', () => {
  // The outline's rows are on lines 8, 9 and 10.
  test('a failed scenario and each failed row list the browsers they failed on, once each', async () => {
    const scenario = (
      await view(OUTLINE, {
        ranAt: '2026-11-02T10:00:00Z',
        scenarios: [
          { file: FILE, line: 8, status: 'passed', browser: 'chromium-desktop' },
          { file: FILE, line: 8, status: 'failed', browser: 'webkit-mobile' },
          { file: FILE, line: 9, status: 'failed', browser: 'firefox-desktop' },
          { file: FILE, line: 9, status: 'failed', browser: 'webkit-mobile' },
          { file: FILE, line: 10, status: 'passed', browser: 'webkit-mobile' },
          { file: FILE, line: 10, status: 'passed', browser: 'firefox-desktop' },
        ],
      })
    ).scenarios[0]
    expect(scenario.status).toBe('failed')
    expect(scenario.failedOn).toEqual(['webkit-mobile', 'firefox-desktop'])
    expect(scenario.examples[0].rows.map((r) => [r.status, r.failedOn])).toEqual([
      ['failed', ['webkit-mobile']],
      ['failed', ['firefox-desktop', 'webkit-mobile']],
      ['passed', []],
    ])
  })

  test('none without browser labels, or when nothing failed', async () => {
    const failed = await view(OUTLINE, {
      ranAt: '2026-11-02T10:00:00Z',
      scenarios: [{ file: FILE, line: 8, status: 'failed' }],
    })
    expect(failed.scenarios[0].failedOn).toEqual([])
    const passed = await view(OUTLINE, {
      ranAt: '2026-11-02T10:00:00Z',
      scenarios: [{ file: FILE, line: 8, status: 'passed', browser: 'webkit-mobile' }],
    })
    expect(passed.scenarios[0].failedOn).toEqual([])
  })
})

describe('browsers it ran on', () => {
  test('a scenario lists every browser and device its current results came from, once each, in order', async () => {
    const scenario = (
      await view(OUTLINE, {
        ranAt: '2026-11-02T10:00:00Z',
        scenarios: [
          { file: FILE, line: 8, status: 'passed', browser: 'webkit-mobile' },
          { file: FILE, line: 9, status: 'passed', browser: 'chromium-desktop' },
          { file: FILE, line: 10, status: 'failed', browser: 'webkit-mobile' },
          { file: FILE, line: 10, status: 'passed', browser: 'firefox-desktop' },
        ],
      })
    ).scenarios[0]
    expect(scenario.ranOn).toEqual(['chromium-desktop', 'firefox-desktop', 'webkit-mobile'])
  })

  test('none without results or browser labels', async () => {
    expect((await view(OUTLINE, null)).scenarios[0].ranOn).toEqual([])
    const unlabelled = await view(OUTLINE, {
      ranAt: '2026-11-02T10:00:00Z',
      scenarios: [{ file: FILE, line: 8, status: 'passed' }],
    })
    expect(unlabelled.scenarios[0].ranOn).toEqual([])
  })
})

describe('describeRuns', () => {
  test('every browser on every device reads as two lists', () => {
    const all = ['chromium', 'firefox', 'webkit'].flatMap((b) => [`${b}-desktop`, `${b}-mobile`])
    expect(describeRuns(all)).toBe('Chromium, Firefox and WebKit, desktop and mobile')
    expect(describeRuns(['chromium-desktop', 'chromium-mobile'])).toBe('Chromium, desktop and mobile')
    expect(describeRuns(['firefox-mobile', 'webkit-mobile'])).toBe('Firefox and WebKit, mobile')
  })

  test('a partial mix, or labels of its own, are listed as they are', () => {
    expect(describeRuns(['chromium-desktop', 'webkit-mobile'])).toBe('chromium-desktop and webkit-mobile')
    expect(describeRuns(['ci', 'local'])).toBe('ci and local')
  })

  test('nothing for no runs', () => {
    expect(describeRuns([])).toBe('')
  })
})

describe('results for an edited scenario', () => {
  const RAN_AT = '2026-11-02T10:00:00Z'
  // Scenario on line 4.
  const TAGGED = ['    @story:Default', '    Scenario: Waits', '        When I wait for "1" seconds']
  const EDITED = ['    @story:Default', '    Scenario: Waits', '        When I wait for "2" seconds']

  test('a result with the current hash counts', async () => {
    const [hash] = await hashesOf(TAGGED)
    const contract = await view(TAGGED, {
      ranAt: RAN_AT,
      scenarios: [{ file: FILE, line: 4, name: 'Waits', hash, status: 'passed' }],
    })
    expect(contract.scenarios[0].status).toBe('passed')
  })

  test('a changed step text, under the same name, shows "changed since last run" with when it ran', async () => {
    const [hash] = await hashesOf(TAGGED)
    const contract = await view(EDITED, {
      ranAt: RAN_AT,
      scenarios: [
        { file: FILE, line: 4, name: 'Waits', hash, status: 'failed', browser: 'webkit-mobile', error: 'old' },
      ],
    })
    // The stale failure is neither shown as a failure nor as not run.
    expect(contract.scenarios[0]).toMatchObject({ status: 'changed', ranAt: RAN_AT, failedOn: [], error: undefined })
    expect(contract.status).toBe('changed')
  })

  test('a changed Examples value shows its row, and so its scenario, as changed', async () => {
    // The outline's rows are on lines 8, 9 and 10; the second row's count goes from 4 to 6.
    const hashes = await hashesOf(OUTLINE)
    const edited = OUTLINE.map((line) => line.replace('| With Label | 4     |', '| With Label | 6     |'))
    const scenario = (
      await view(edited, {
        ranAt: RAN_AT,
        scenarios: [8, 9, 10].map((line, i) => ({
          file: FILE,
          line,
          name: 'Shows the count',
          hash: hashes[i],
          status: 'passed',
        })),
      })
    ).scenarios[0]
    expect(scenario.examples[0].rows.map((r) => r.status)).toEqual(['passed', 'changed', 'passed'])
    expect(scenario.status).toBe('changed')
  })

  test('a result without a hash is taken as current', async () => {
    const contract = await view(EDITED, {
      ranAt: RAN_AT,
      scenarios: [{ file: FILE, line: 4, name: 'Waits', status: 'passed' }],
    })
    expect(contract.scenarios[0].status).toBe('passed')
  })

  test('a result whose name does not match is still ignored, whatever its hash', async () => {
    const [hash] = await hashesOf(TAGGED)
    const contract = await view(EDITED, {
      ranAt: RAN_AT,
      scenarios: [{ file: FILE, line: 4, name: 'Sleeps', hash, status: 'passed' }],
    })
    expect(contract.scenarios[0].status).toBe('not-run')
  })

  test('a current result outweighs a stale one for the same pickle', async () => {
    const [hash] = await hashesOf(EDITED)
    const contract = await view(EDITED, {
      ranAt: RAN_AT,
      scenarios: [
        { file: FILE, line: 4, name: 'Waits', hash: 'aaaaaaaaaaaa', status: 'failed', browser: 'firefox-desktop' },
        { file: FILE, line: 4, name: 'Waits', hash, status: 'passed', browser: 'webkit-mobile' },
      ],
    })
    expect(contract.scenarios[0]).toMatchObject({ status: 'passed', failedOn: [] })
  })
})
