import path from 'node:path'

import { describe, expect, test } from 'vitest'

import { zucchiniProjects } from './vitest.ts'

// A Storybook with no stories or contracts yet: the projects are still built. A folder in the repo, not a
// temporary one, because Storybook's Vitest plugin reads its config after the projects are returned.
const root = path.join(import.meta.dirname, '..', '..', 'test', 'fixtures', 'empty-storybook')

const apiOf = async (options: Parameters<typeof zucchiniProjects>[0]) =>
  (await zucchiniProjects({ root, ...options })).map((project) => project.test?.api)

describe('zucchiniProjects', () => {
  test("serves on Vitest's own browser port by default, clear of a Vite dev server on 5173", async () => {
    expect(await apiOf({ browsers: ['chromium'], devices: ['desktop'] })).toEqual([{ port: 63315, strictPort: true }])
  })

  test('serves every project on the port it is given', async () => {
    expect(await apiOf({ browsers: ['chromium', 'webkit'], devices: ['desktop'], port: 5199 })).toEqual([
      { port: 5199, strictPort: true },
      { port: 5199, strictPort: true },
    ])
  })
})
