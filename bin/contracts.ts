// Runs the component contracts: one Vitest project per browser and device (see src/runner/vitest.ts), one
// after the other, since they all serve on the same port. Each run adds its results to the config's results
// file, replacing that browser and device's earlier ones. Keeps going after a failure, prints how each run went
// and how long it took, and exits 1 if any failed. Runs on Node's built-in TypeScript support.
//
//   node packages/living-spec/bin/contracts.ts --config <vitest config> [--browser chromium,firefox,webkit]
//     [--device desktop,mobile] [-- <more vitest arguments>]
//
// The browser defaults to chromium, the devices to both.
import { spawn } from 'node:child_process'
import { parseArgs } from 'node:util'

import { type Browser, BROWSERS, type Device, DEVICES, projectName } from '../src/runner/devices.ts'

const { values, positionals } = parseArgs({
  options: {
    config: { type: 'string' },
    browser: { type: 'string', default: 'chromium' },
    device: { type: 'string', default: DEVICES.join(',') },
  },
  allowPositionals: true,
})

const listOf = <T extends string>(value: string, known: readonly T[], what: string): T[] =>
  value.split(',').map((item) => {
    if (!known.includes(item as T)) {
      process.stderr.write(`Unknown ${what} "${item}". Known: ${known.join(', ')}\n`)
      process.exit(2)
    }
    return item as T
  })

if (!values.config) {
  process.stderr.write('Name the Vitest config that defines the contract projects: --config <file>\n')
  process.exit(2)
}
const browsers = listOf<Browser>(values.browser, BROWSERS, 'browser')
const devices = listOf<Device>(values.device, DEVICES, 'device')

// Ctrl-C reaches the Vitest run in progress, which stops; the runs after it don't start.
let interrupted = false
process.on('SIGINT', () => {
  interrupted = true
})

const vitest = (args: string[]) =>
  new Promise<number | null>((resolve) => {
    spawn('npx', ['vitest', ...args], { stdio: 'inherit' }).on('close', resolve)
  })

const runs: { project: string; ok: boolean; seconds: number }[] = []
for (const browser of browsers) {
  for (const device of devices) {
    if (interrupted) {
      break
    }
    const project = projectName(browser, device)
    const started = performance.now()
    const status = await vitest(['run', '--config', values.config, '--project', project, ...positionals])
    runs.push({ project, ok: status === 0, seconds: (performance.now() - started) / 1000 })
  }
}

process.stdout.write('\nContract runs:\n')
for (const run of runs) {
  process.stdout.write(`  ${run.ok ? 'passed' : 'FAILED'}  ${run.project}  ${run.seconds.toFixed(1)} s\n`)
}
if (interrupted) {
  process.stdout.write('  Interrupted.\n')
  process.exit(130)
}
process.exit(runs.every((run) => run.ok) ? 0 : 1)
