#!/usr/bin/env node
// The zucchini command: `zucchini <command> [options]`. Each command is a module that reads its own options
// from process.argv and sets its exit code, so the dispatcher hands it the arguments after the command's name
// and loads it.
import { fileURLToPath } from 'node:url'

const COMMANDS: Record<string, { summary: string; load: () => Promise<unknown> }> = {
  catalog: {
    summary: 'write the step catalog, or check it is up to date (--check)',
    load: () => import('./catalog.ts'),
  },
  lint: {
    summary: 'check the contracts against the catalog and their stories',
    load: () => import('./lint.ts'),
  },
  contracts: {
    summary: 'run the contracts in the browser, per browser and device',
    load: () => import('./contracts.ts'),
  },
  'merge-results': {
    summary: "merge several runs' results into one file for the living spec",
    load: () => import('./merge-results.ts'),
  },
  mutation: {
    summary: '(experimental) check that deliberate bugs make the contracts fail',
    load: () => import('./mutation.ts'),
  },
}

const usage = () =>
  [
    'Usage: zucchini <command> [options]',
    '',
    'Commands:',
    ...Object.entries(COMMANDS).map(([name, { summary }]) => `  ${name.padEnd(14)} ${summary}`),
    '',
  ].join('\n')

const [name, ...args] = process.argv.slice(2)

if (name === '--help' || name === '-h' || name === 'help') {
  process.stdout.write(usage())
} else if (!name || !Object.hasOwn(COMMANDS, name)) {
  process.stderr.write(`${name ? `Unknown command "${name}".\n\n` : ''}${usage()}`)
  process.exitCode = 1
} else {
  // A command that starts another one (mutation runs contracts) starts this file again.
  process.env.ZUCCHINI_CLI = fileURLToPath(import.meta.url)
  process.argv = [process.argv[0], `zucchini ${name}`, ...args]
  await COMMANDS[name].load()
}
