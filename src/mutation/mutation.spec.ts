import { describe, expect, test } from 'vitest'

import type { ScenarioResult } from '../view/viewModel.ts'
import { applyBreak, type Break, judge } from './mutation.ts'

const file = 'src/Badge/Badge.feature'

const feature = [
  'Feature: Badge', //                                                                       1
  '', //                                                                                     2
  '    Scenario Outline: Shows <value>', //                                                  3
  '        Then I should assert that the element with id "badge" contains "<value>"', //     4
  '', //                                                                                     5
  '        Examples:', //                                                                    6
  '            | story   | value |', //                                                      7
  '            | Default | 1     |', //                                                      8
  '            | Empty   | 2     |', //                                                      9
  '',
].join('\n')

const brk = (find: string, replace: string): Break => ({ name: 'b', checks: 'c', file, find, replace })

const result = (line: number, status: string): ScenarioResult => ({ file, line, status, browser: 'chromium-desktop' })

describe('applyBreak', () => {
  test('breaking an Examples row targets that row', () => {
    const { text, target } = applyBreak(feature, brk('| Empty   | 2     |', '| Empty   | 3     |'))
    expect(text).toContain('| Empty   | 3     |')
    expect(target).toEqual({ file, line: 9, pickleLines: [9] })
  })

  test('breaking a step targets every pickle of its scenario', () => {
    const { target } = applyBreak(feature, brk('contains "<value>"', 'contains "x<value>"'))
    expect(target).toEqual({ file, line: 4, pickleLines: [8, 9] })
  })

  test('refuses a break whose text is gone', () => {
    expect(() => applyBreak(feature, brk('| Missing |', '| x |'))).toThrow('no longer contains')
  })
})

describe('judge', () => {
  const target = { file, line: 9, pickleLines: [9] }

  test('a failure of a targeted pickle catches the break', () => {
    const verdict = judge(target, [result(8, 'passed'), result(9, 'failed')])
    expect(verdict).toEqual({ kind: 'caught', failures: [result(9, 'failed')], unexplained: [] })
  })

  test('a targeted pickle that passed misses it', () => {
    expect(judge(target, [result(9, 'passed')]).kind).toBe('missed')
  })

  test('no run of the targeted pickles proves nothing', () => {
    expect(judge(target, [result(8, 'passed')]).kind).toBe('not-run')
  })

  test('another failure in the run is unexplained', () => {
    expect(judge(target, [result(8, 'failed'), result(9, 'failed')]).unexplained).toEqual([result(8, 'failed')])
  })
})
