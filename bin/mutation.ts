// The deliberate-break check, run by hand: applies each break (see src/mutation/mutation.ts) on its own, runs
// the contracts it concerns, and checks they caught it: a contract break's scenario or row failed, or a code
// break's contracts failed somewhere. Every break is reverted after
// its run, even when the run fails or is interrupted (Ctrl-C), and the results file is put back as it was.
// Exits 1, naming them, when a break stayed green, didn't run, couldn't be applied, or a run failed elsewhere.
// Runs on Node's built-in TypeScript support.
//
//   node bin/mutation.ts --config <vitest config> --breaks <module exporting `breaks`>
//     [--browser chromium,firefox,webkit] [--device desktop,mobile] [--break <name>]...
//
// The browser defaults to chromium, the device to desktop: one cheap run per break.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

import { loadConfig } from '../src/config/load.ts'
import { storyFileFor } from '../src/contracts/lint.ts'
import { findContracts } from '../src/contracts/load.ts'
import { applyBreak, type Break, contractsOf, isFailure, judge, type Verdict } from '../src/mutation/mutation.ts'
import { readResults } from '../src/runner/results.ts'

const { values } = parseArgs({
  options: {
    config: { type: 'string' },
    breaks: { type: 'string' },
    browser: { type: 'string', default: 'chromium' },
    device: { type: 'string', default: 'desktop' },
    break: { type: 'string', multiple: true },
  },
})
if (!values.config || !values.breaks) {
  process.stderr.write('Usage: mutation.ts --config <vitest config> --breaks <module> [--browser ...] [--device ...]\n')
  process.exit(2)
}

const loaded: { breaks?: Break[] } = await import(pathToFileURL(path.resolve(values.breaks)).href)
const all = loaded.breaks ?? []
const picked = values.break?.length ? all.filter((b) => values.break?.includes(b.name)) : all
const unknown = (values.break ?? []).filter((name) => !all.some((b) => b.name === name))
if (unknown.length || !picked.length) {
  process.stderr.write(`Unknown break ${unknown.join(', ')}. The breaks: ${all.map((b) => b.name).join(', ')}\n`)
  process.exit(2)
}
const devices = values.device.split(',')

const { config } = await loadConfig()
const resultsFile = path.resolve(config.results)
const savedResults = fs.existsSync(resultsFile) ? fs.readFileSync(resultsFile) : null
const { storyFiles } = await findContracts({ dir: config.contracts })

// Ctrl-C reaches the contract run too, which stops; this process then reverts the break and reports.
let interrupted = false
process.on('SIGINT', () => {
  interrupted = true
})

const runContracts = (args: string[]) =>
  new Promise<void>((resolve) => {
    spawn('node', [path.join(import.meta.dirname, 'contracts.ts'), ...args], { stdio: 'inherit' }).on('close', () =>
      resolve()
    )
  })

const outcomes: { brk: Break; verdict?: Verdict; skipped?: string; error?: string }[] = []
try {
  for (const brk of picked) {
    if (interrupted) {
      break
    }
    const onDevices = devices.filter((d) => !brk.devices || brk.devices.includes(d))
    if (!onDevices.length) {
      outcomes.push({ brk, skipped: `runs on ${brk.devices?.join(', ')} only` })
      continue
    }
    const original = fs.readFileSync(brk.file, 'utf8')
    let broken
    try {
      broken = applyBreak(original, brk)
    } catch (error) {
      outcomes.push({ brk, error: (error as Error).message })
      continue
    }
    // The story files of the contracts the break must fail: its own contract, or a code break's contracts.
    const toRun = contractsOf(broken.target).map((contract) => storyFileFor(contract, storyFiles)?.file ?? contract)
    process.stdout.write(`\n=== ${brk.name}: ${brk.file}:${broken.target.line} (${brk.checks})\n`)
    fs.rmSync(resultsFile, { force: true })
    try {
      fs.writeFileSync(brk.file, broken.text)
      await runContracts([
        '--config',
        values.config,
        '--browser',
        values.browser,
        '--device',
        onDevices.join(','),
        ...toRun,
      ])
    } finally {
      fs.writeFileSync(brk.file, original)
    }
    if (interrupted) {
      break
    }
    outcomes.push({ brk, verdict: judge(broken.target, readResults(resultsFile)?.scenarios ?? []) })
  }
} finally {
  if (savedResults) {
    fs.writeFileSync(resultsFile, savedResults)
  } else {
    fs.rmSync(resultsFile, { force: true })
  }
}

const out = (line: string) => process.stdout.write(`${line}\n`)
out(`\nDeliberate-break check on ${values.browser} ${devices.join(', ')}:`)
let problems = 0
for (const { brk, verdict, skipped, error } of outcomes) {
  const label = `${brk.name} (${brk.file}, ${brk.checks})`
  if (skipped) {
    out(`  skipped  ${label}: ${skipped}`)
    continue
  }
  if (error || !verdict) {
    problems += 1
    out(`  ERROR    ${label}: ${error}`)
    continue
  }
  if (verdict.kind === 'caught') {
    out(`  caught   ${label}`)
    for (const f of verdict.failures) {
      out(`             ${f.browser} line ${f.line}: ${(f.error ?? f.status).slice(0, 140)}`)
    }
  } else {
    problems += 1
    out(
      verdict.kind === 'missed'
        ? `  MISSED   ${label}: ${brk.contracts?.length ? `${brk.contracts.join(', ')} still passed` : 'the broken pickles still passed'}`
        : `  NOT RUN  ${label}: none of the broken pickles ran`
    )
  }
  for (const f of verdict.unexplained.filter(isFailure)) {
    problems += 1
    out(`  UNEXPLAINED failure while checking ${brk.name}: ${f.file}:${f.line} ${f.browser}: ${f.error ?? f.status}`)
  }
}
const notReached = picked.length - outcomes.length
if (interrupted) {
  problems += 1
  out(`  Interrupted: ${notReached} break(s) not checked. Every applied break was reverted.`)
}
const caught = outcomes.filter((o) => o.verdict?.kind === 'caught').length
const checked = outcomes.filter((o) => !o.skipped).length
out(`${caught} of ${checked} breaks caught${problems ? `; ${problems} problem(s) above` : ''}.`)
process.exit(problems ? 1 : 0)
