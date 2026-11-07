import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { computeRunBindings, runsOn } from './bindings.ts'

const fixtureStories = path.join(__dirname, '..', 'contracts', 'fixtures', 'Badge', 'Badge.stories.ts')

let root: string

const writeFeature = (lines: string[]) =>
  fs.writeFileSync(path.join(root, 'src', 'Badge', 'Badge.feature'), [...lines, ''].join('\n'))

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'run-bindings-'))
  fs.mkdirSync(path.join(root, 'src', 'Badge'), { recursive: true })
  fs.copyFileSync(fixtureStories, path.join(root, 'src', 'Badge', 'Badge.stories.ts'))
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('runsOn', () => {
  test('runs an untagged pickle on every device', () => {
    expect(runsOn([], 'desktop')).toBe(true)
    expect(runsOn(['@story:Default'], 'mobile')).toBe(true)
  })

  test("runs a device's pickle only on that device", () => {
    expect(runsOn(['@mobile'], 'mobile')).toBe(true)
    expect(runsOn(['@mobile'], 'desktop')).toBe(false)
  })
})

describe('computeRunBindings', () => {
  test('maps each story id to its feature file and the lines of its pickles on the device', async () => {
    writeFeature([
      'Feature: Badge', //                                  1
      '', //                                                2
      '    @story:With_Label', //                           3
      '    Scenario: Shows its label', //                   4
      '        When I wait for "1" seconds', //             5
      '', //                                                6
      '    Scenario Outline: Shows <value>', //             7
      '        When I wait for "<value>" seconds', //       8
      '', //                                                9
      '        Examples:', //                               10
      '            | story   | value |', //                 11
      '            | Default | 1     |', //                 12
      '            | Empty   | 2     |', //                 13
      '', //                                                14
      '        @mobile', //                                 15
      '        Examples: mobile', //                        16
      '            | story   | value |', //                 17
      '            | Default | 3     |', //                 18
    ])
    const file = path.join('src', 'Badge', 'Badge.feature')
    const desktop = await computeRunBindings({ root, dir: 'src', device: 'desktop' })
    expect(desktop.problems).toEqual([])
    expect(desktop.stories).toEqual({
      'fixtures-components-badge--with-label': { file, lines: [4] },
      'fixtures-components-badge--default': { file, lines: [12] },
      'fixtures-components-badge--empty': { file, lines: [13] },
    })
    expect(desktop.storyFiles).toEqual([path.join('src', 'Badge', 'Badge.stories.ts')])

    const mobile = await computeRunBindings({ root, dir: 'src', device: 'mobile' })
    expect(mobile.stories['fixtures-components-badge--default']).toEqual({ file, lines: [12, 18] })
  })

  test('reports a scenario bound to a story that does not exist', async () => {
    writeFeature([
      'Feature: Badge',
      '',
      '    @story:Missing',
      '    Scenario: Shows nothing',
      '        When I wait for "1" seconds',
    ])
    const { problems, stories } = await computeRunBindings({ root, dir: 'src', device: 'desktop' })
    expect(problems).toEqual([expect.objectContaining({ line: 4, message: expect.stringContaining('"Missing"') })])
    expect(stories).toEqual({})
  })
})
