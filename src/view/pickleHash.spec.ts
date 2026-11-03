import { createHash } from 'node:crypto'

import { describe, expect, test } from 'vitest'

import { type PickleContent, pickleHash } from './pickleHash.ts'

const ROW: PickleContent = {
  name: 'Shows 3 on Default',
  steps: [{ keyword: 'Then', text: 'I should assert that the element with id "badge" has an exact value of "3"' }],
  values: ['Default', '3'],
}

describe('pickleHash', () => {
  test('is the first 12 hex digits of the SHA-256 of the JSON [name, [[keyword, text]...], values]', async () => {
    const json = JSON.stringify([ROW.name, ROW.steps.map((s) => [s.keyword, s.text]), ROW.values])
    expect(await pickleHash(ROW)).toBe(createHash('sha256').update(json).digest('hex').slice(0, 12))
    // Pinned, so a change to what is hashed shows up here and in the README.
    expect(await pickleHash(ROW)).toBe('8dbcc9a65455')
  })

  test('is stable for the same content', async () => {
    expect(await pickleHash({ ...ROW, steps: [...ROW.steps], values: [...ROW.values] })).toBe(await pickleHash(ROW))
  })

  test('changes with the name, a keyword, a step text or a value', async () => {
    const hash = await pickleHash(ROW)
    const step = ROW.steps[0]
    const edits: PickleContent[] = [
      { ...ROW, name: 'Shows 3 on Default!' },
      { ...ROW, steps: [{ ...step, keyword: 'And' }] },
      { ...ROW, steps: [{ ...step, text: `${step.text} ` }] },
      { ...ROW, values: ['Default', '4'] },
      { ...ROW, steps: [...ROW.steps, step] },
    ]
    for (const edit of edits) {
      expect(await pickleHash(edit)).not.toBe(hash)
    }
  })
})
