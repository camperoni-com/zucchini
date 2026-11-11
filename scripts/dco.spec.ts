import { describe, expect, test } from 'vitest'

import { unsignedCommits } from './dco.mjs'

const commit = (
  overrides: Partial<{ sha: string; author: string; email: string; message: string; parents: number }>
) => ({
  sha: 'abc1234',
  author: 'Ada Lovelace',
  email: 'ada@example.com',
  message: 'feat: something\n\nSigned-off-by: Ada Lovelace <ada@example.com>\n',
  parents: 1,
  ...overrides,
})

describe('unsignedCommits', () => {
  test('accepts a commit signed off by its author', () => {
    expect(unsignedCommits([commit({})])).toEqual([])
  })

  test('flags a commit with no sign-off', () => {
    expect(unsignedCommits([commit({ message: 'feat: something\n' })])).toEqual([
      { sha: 'abc1234', reason: 'no Signed-off-by line for Ada Lovelace <ada@example.com>' },
    ])
  })

  test("flags a sign-off by someone other than the commit's author", () => {
    const signedByOther = commit({ message: 'fix: x\n\nSigned-off-by: Bob <bob@example.com>\n' })
    expect(unsignedCommits([signedByOther])).toEqual([
      { sha: 'abc1234', reason: 'no Signed-off-by line for Ada Lovelace <ada@example.com>' },
    ])
  })

  test('matches the email without regard to case, among other trailers', () => {
    const message = 'fix: x\n\nCo-Authored-By: Someone <s@example.com>\nSigned-off-by: Ada L. <ADA@example.com>\n'
    expect(unsignedCommits([commit({ message })])).toEqual([])
  })

  test('skips merge commits and commits by bots', () => {
    expect(
      unsignedCommits([
        commit({ message: 'Merge branch main', parents: 2 }),
        commit({
          author: 'github-actions[bot]',
          email: '41898282+github-actions[bot]@users.noreply.github.com',
          message: 'Version packages\n',
        }),
      ])
    ).toEqual([])
  })
})
