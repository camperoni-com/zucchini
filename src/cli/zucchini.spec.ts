import { execFileSync } from 'node:child_process'
import path from 'node:path'

import { describe, expect, test } from 'vitest'

const cli = path.join(import.meta.dirname, 'zucchini.ts')

const zucchini = (...args: string[]) => {
  try {
    const output = execFileSync('node', [cli, ...args], { stdio: 'pipe' })
    return { code: 0, output: output.toString() }
  } catch (error) {
    const failed = error as { status: number; stdout: Buffer; stderr: Buffer }
    return { code: failed.status, output: failed.stdout.toString() + failed.stderr.toString() }
  }
}

const COMMANDS = ['catalog', 'lint', 'contracts', 'merge-results', 'mutation']

describe('zucchini', () => {
  test('without a command, prints the usage with every command and fails', () => {
    const result = zucchini()
    expect(result.code).not.toBe(0)
    expect(result.output).toContain('Usage: zucchini <command>')
    for (const command of COMMANDS) {
      expect(result.output).toContain(command)
    }
  })

  test('with an unknown command, names it, prints the usage and fails', () => {
    const result = zucchini('catalogue')
    expect(result.code).not.toBe(0)
    expect(result.output).toContain('Unknown command "catalogue"')
    expect(result.output).toContain('Usage: zucchini <command>')
  })

  test('with --help, prints the usage and succeeds', () => {
    const result = zucchini('--help')
    expect(result.code).toBe(0)
    expect(result.output).toContain('Usage: zucchini <command>')
  })
})
