// The Developer Certificate of Origin check: every commit in a range must carry a `Signed-off-by:` line for
// its author (git commit -s). Merge commits and commits by bots (such as the Changesets "Version packages"
// commit) are skipped.
//
//   node scripts/dco.mjs <base>..<head>
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

/**
 * @param {{ sha: string, author: string, email: string, message: string, parents: number }[]} commits
 * @returns {{ sha: string, reason: string }[]} the commits that aren't signed off by their author
 */
export const unsignedCommits = (commits) =>
  commits
    .filter((commit) => commit.parents < 2 && !commit.email.endsWith('[bot]@users.noreply.github.com'))
    .filter((commit) => {
      const signOffs = [...commit.message.matchAll(/^Signed-off-by: .* <([^>]+)>\s*$/gim)]
      return !signOffs.some(([, email]) => email.toLowerCase() === commit.email.toLowerCase())
    })
    .map((commit) => ({ sha: commit.sha, reason: `no Signed-off-by line for ${commit.author} <${commit.email}>` }))

const readCommits = (range) =>
  execFileSync('git', ['log', '--format=%H%x00%an%x00%ae%x00%P%x00%B%x1e', range], { encoding: 'utf8' })
    .split('\x1e')
    .map((record) => record.replace(/^\n/, ''))
    .filter(Boolean)
    .map((record) => {
      const [sha, author, email, parents, message] = record.split('\0')
      return { sha: sha.slice(0, 7), author, email, message, parents: parents.split(' ').filter(Boolean).length }
    })

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [range] = process.argv.slice(2)
  if (!range) {
    process.stderr.write('Usage: node scripts/dco.mjs <base>..<head>\n')
    process.exit(2)
  }
  const commits = readCommits(range)
  const unsigned = unsignedCommits(commits)
  for (const { sha, reason } of unsigned) {
    process.stderr.write(`${sha}: ${reason}\n`)
  }
  if (unsigned.length) {
    process.stderr.write(
      '\nEvery commit needs a Developer Certificate of Origin sign-off: commit with `git commit -s`.\n' +
        'To sign off the commits already on this branch: git rebase --signoff <base branch>, then push with --force-with-lease.\n' +
        'See CONTRIBUTING.md.\n'
    )
    process.exit(1)
  }
  process.stdout.write(`All ${commits.length} commits are signed off.\n`)
}
