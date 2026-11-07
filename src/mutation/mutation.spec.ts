import { describe, expect, test } from 'vitest'

import type { ScenarioResult } from '../view/viewModel.ts'
import { applyBreak, type Break, contractsOf, judge, type Target } from './mutation.ts'

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

const result = (line: number, status: string, inFile = file): ScenarioResult => ({
  file: inFile,
  line,
  status,
  browser: 'chromium-desktop',
})

describe('applyBreak', () => {
  test('breaking an Examples row targets that row', () => {
    const { text, target } = applyBreak(feature, brk('| Empty   | 2     |', '| Empty   | 3     |'))
    expect(text).toContain('| Empty   | 3     |')
    expect(target).toEqual({ kind: 'contract', file, line: 9, pickleLines: [9] })
  })

  test('breaking a step targets every pickle of its scenario', () => {
    const { target } = applyBreak(feature, brk('contains "<value>"', 'contains "x<value>"'))
    expect(target).toEqual({ kind: 'contract', file, line: 4, pickleLines: [8, 9] })
  })

  test('refuses a break whose text is gone', () => {
    expect(() => applyBreak(feature, brk('| Missing |', '| x |'))).toThrow('no longer contains')
  })

  describe('a code break', () => {
    const code = ['export const label = (n: number) =>', "  n > 1 ? 'camps' : 'camp'", ''].join('\n')
    const codeBreak: Break = {
      name: 'plural',
      checks: 'the plural',
      file: 'src/libs/text.ts',
      find: 'n > 1',
      replace: 'n >= 1',
      contracts: [file],
    }

    test('changes the code and targets the contracts it names', () => {
      const { text, target } = applyBreak(code, codeBreak)
      expect(text).toContain("n >= 1 ? 'camps'")
      expect(target).toEqual({ kind: 'code', file: 'src/libs/text.ts', line: 2, contracts: [file] })
      expect(contractsOf(target)).toEqual([file])
    })

    test('must name its contracts', () => {
      expect(() => applyBreak(code, { ...codeBreak, contracts: [] })).toThrow('must name the contracts')
    })
  })
})

describe('judge', () => {
  const target: Target = { kind: 'contract', file, line: 9, pickleLines: [9] }

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

  describe('for a code break', () => {
    const other = 'src/Other/Other.feature'
    const code: Target = { kind: 'code', file: 'src/libs/text.ts', line: 2, contracts: [file] }

    test('any failure in its contracts catches it', () => {
      expect(judge(code, [result(8, 'passed'), result(9, 'failed')]).kind).toBe('caught')
    })

    test('its contracts all passing misses it', () => {
      expect(judge(code, [result(8, 'passed'), result(9, 'passed')]).kind).toBe('missed')
    })

    test('a failure in another contract is unexplained', () => {
      const verdict = judge(code, [result(8, 'passed'), result(3, 'failed', other)])
      expect(verdict.kind).toBe('missed')
      expect(verdict.unexplained).toEqual([result(3, 'failed', other)])
    })
  })
})
