import { describe, expect, test } from 'vitest'

import { notesFor } from './release-notes.mjs'

const CHANGELOG = [
  '# @camperoni/zucchini',
  '',
  '## 0.2.0',
  '',
  '### Minor Changes',
  '',
  '- abc1234: A new step.',
  '',
  '## 0.1.0',
  '',
  '### Minor Changes',
  '',
  '- def5678: First release.',
  '',
].join('\n')

describe('notesFor', () => {
  test("gives the version's section, without its heading", () => {
    expect(notesFor(CHANGELOG, '0.1.0')).toBe('### Minor Changes\n\n- def5678: First release.')
  })

  test('stops at the next version', () => {
    expect(notesFor(CHANGELOG, '0.2.0')).toBe('### Minor Changes\n\n- abc1234: A new step.')
  })

  test('throws for a version the changelog does not have', () => {
    expect(() => notesFor(CHANGELOG, '0.3.0')).toThrow('CHANGELOG.md has no section for 0.3.0')
  })
})
