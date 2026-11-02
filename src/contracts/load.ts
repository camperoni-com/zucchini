// Finds the contract feature files and story files under a folder. Node only.
import fs from 'node:fs'
import path from 'node:path'

import type { ContractFile } from './lint.ts'
import { readStoryFile, type StoryFile } from './stories.ts'

export const STORY_FILE_PATTERN = '**/*.stories.{ts,tsx,js,jsx,mjs}'

/**
 * Reads every `*.feature` and story file under `dir`. Paths come back as given: relative to `root` for a
 * relative `dir`, absolute for an absolute one.
 */
export const findContracts = async ({ root = process.cwd(), dir }: { root?: string; dir: string }) => {
  const glob = (pattern: string) => fs.globSync(path.join(dir, pattern), { cwd: root }).sort()
  const features: ContractFile[] = glob('**/*.feature').map((file) => ({
    file,
    text: fs.readFileSync(path.resolve(root, file), 'utf8'),
  }))
  const storyFiles: StoryFile[] = await Promise.all(
    glob(STORY_FILE_PATTERN).map(async (file) => ({ ...(await readStoryFile(path.resolve(root, file))), file }))
  )
  return { features, storyFiles }
}
