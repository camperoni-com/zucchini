// Installs the demo (examples/demo) the way a user would: its own dependencies from its lockfile, plus Zucchini
// from a freshly packed tarball, not from the repo's sources.
//
//   npm run demo:install
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const repo = path.resolve(import.meta.dirname, '..')
const demo = path.join(repo, 'examples', 'demo')

for (const old of fs.readdirSync(demo).filter((name) => name.endsWith('.tgz'))) {
  fs.rmSync(path.join(demo, old))
}
// npm pack builds first (prepack).
const [packed] = JSON.parse(
  execFileSync('npm', ['pack', '--json', '--pack-destination', demo], { cwd: repo, encoding: 'utf8' })
)

const npm = (...args) => execFileSync('npm', [...args, '--no-audit', '--no-fund'], { cwd: demo, stdio: 'inherit' })
npm(fs.existsSync(path.join(demo, 'package-lock.json')) ? 'ci' : 'install')
npm('install', '--no-save', `./${packed.filename}`)
process.stdout.write(`The demo runs ${packed.name}@${packed.version} from ${packed.filename}.\n`)
