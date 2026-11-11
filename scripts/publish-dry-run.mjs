// Checks publishing without publishing:
//  1. the maintainer's first publish (npm run release:first), as a dry run: it builds, and goes out public
//     under the `latest` tag;
//  2. a prerelease version goes out under the `next` tag, as the release workflow publishes it in
//     prerelease mode.
//
//   npm run release:dry-run
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const repo = path.resolve(import.meta.dirname, '..')
const { name, version } = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'))

/** Runs npm and returns everything it printed: it writes its publish report to stderr. */
const npm = (args, cwd) => {
  try {
    return execFileSync('sh', ['-c', 'npm "$@" 2>&1', 'npm', ...args], { cwd, encoding: 'utf8' })
  } catch (error) {
    throw new Error(`npm ${args.join(' ')} failed:\n${error.stdout ?? ''}`, { cause: error })
  }
}

const expectIn = (report, text, what) => {
  if (!report.includes(text)) {
    throw new Error(`${what}: expected "${text}" in npm's report:\n${report}`)
  }
}

// 1. The first publish, as the maintainer runs it.
const first = npm(['run', 'release:first', '--', '--dry-run'], repo)
expectIn(first, 'with tag latest and public access (dry-run)', 'first publish')
expectIn(first, `+ ${name}@${version}`, 'first publish')
expectIn(first, 'dist/cli.js', 'first publish')
// npm "corrects" a manifest it dislikes while publishing, warning that it removed what it couldn't use. 0.1.0's
// bin path started with "./", and npm warned that it removed the `zucchini` bin. That time the published
// package kept it, but a publish shouldn't depend on it, and npm pack doesn't show these warnings at all.
if (first.includes('auto-corrected')) {
  throw new Error(`first publish: npm would change package.json while publishing:\n${first}`)
}
process.stdout.write(`First publish: ${name}@${version}, public, tag latest, with dist/ (dry run).\n`)

// 2. A prerelease, from the packed tarball with a prerelease version.
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'zucchini-prerelease-'))
try {
  const report = npm(['pack', '--json', '--pack-destination', work], repo)
  const [packed] = JSON.parse(report.slice(report.indexOf('[')))
  execFileSync('tar', ['-xzf', packed.filename], { cwd: work })
  const unpacked = path.join(work, 'package')
  const manifestFile = path.join(unpacked, 'package.json')
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
  manifest.version = `${version.split('-')[0]}-next.0`
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2))
  const prerelease = npm(['publish', '--dry-run', '--ignore-scripts', '--tag', 'next'], unpacked)
  expectIn(prerelease, 'with tag next and public access (dry-run)', 'prerelease')
  process.stdout.write(`Prerelease: ${name}@${manifest.version}, public, tag next (dry run).\n`)
} finally {
  fs.rmSync(work, { recursive: true, force: true })
}
