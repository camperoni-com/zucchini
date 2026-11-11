// Prints the CHANGELOG.md section of the version in package.json, for the GitHub release.
//
//   node scripts/release-notes.mjs
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/** The section of `changelog` under `## <version>`, up to the next version's heading. */
export const notesFor = (changelog, version) => {
  const lines = changelog.split('\n')
  const start = lines.findIndex((line) => line.trim() === `## ${version}`)
  if (start < 0) {
    throw new Error(`CHANGELOG.md has no section for ${version}`)
  }
  const end = lines.findIndex((line, i) => i > start && /^## /.test(line))
  return lines
    .slice(start + 1, end < 0 ? undefined : end)
    .join('\n')
    .trim()
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const repo = path.resolve(import.meta.dirname, '..')
  const { version } = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'))
  process.stdout.write(`${notesFor(fs.readFileSync(path.join(repo, 'CHANGELOG.md'), 'utf8'), version)}\n`)
}
