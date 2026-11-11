// Checks publishing without publishing, from the packed package (npm pack builds it first, as npm publish does):
//  1. the next release goes out public, under the `latest` tag, with dist/, and with package.json as written;
//  2. a prerelease goes out under the `next` tag, as the release workflow publishes it in prerelease mode.
// The packed package gets an unpublished version for each, since npm refuses a dry run over a published one.
//
//   npm run release:dry-run
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const repo = path.resolve(import.meta.dirname, '..')
const { name, version } = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'))
const [major, minor, patch] = version.split('-')[0].split('.').map(Number)

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

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'zucchini-publish-'))
try {
  const report = npm(['pack', '--json', '--pack-destination', work], repo)
  const [packed] = JSON.parse(report.slice(report.indexOf('[')))

  /** Unpacks the tarball into its own folder, with `newVersion` in its package.json. */
  const unpackAs = (newVersion) => {
    const dir = path.join(work, newVersion)
    fs.mkdirSync(dir)
    execFileSync('tar', ['-xzf', path.join(work, packed.filename), '-C', dir])
    const manifestFile = path.join(dir, 'package', 'package.json')
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
    fs.writeFileSync(manifestFile, JSON.stringify({ ...manifest, version: newVersion }, null, 2))
    return path.join(dir, 'package')
  }

  // 1. The next release.
  const next = `${major}.${minor}.${patch + 1}`
  const release = npm(['publish', '--dry-run', '--ignore-scripts'], unpackAs(next))
  expectIn(release, 'with tag latest and public access (dry-run)', 'release')
  expectIn(release, `+ ${name}@${next}`, 'release')
  expectIn(release, 'dist/cli.js', 'release')
  // npm "corrects" a manifest it dislikes while publishing, warning that it removed what it couldn't use. With
  // 0.1.0's bin path ("./dist/cli.js") it warned that it removed the `zucchini` bin; that time the published
  // package kept it, but a publish shouldn't depend on it, and npm pack shows no such warning.
  if (release.includes('auto-corrected')) {
    throw new Error(`release: npm would change package.json while publishing:\n${release}`)
  }
  process.stdout.write(`Release: ${name}@${next}, public, tag latest, with dist/, package.json as written (dry run).\n`)

  // 2. A prerelease.
  const pre = `${major}.${minor}.${patch + 1}-next.0`
  const prerelease = npm(['publish', '--dry-run', '--ignore-scripts', '--tag', 'next'], unpackAs(pre))
  expectIn(prerelease, 'with tag next and public access (dry-run)', 'prerelease')
  process.stdout.write(`Prerelease: ${name}@${pre}, public, tag next (dry run).\n`)
} finally {
  fs.rmSync(work, { recursive: true, force: true })
}
