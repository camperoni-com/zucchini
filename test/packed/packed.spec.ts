// Packs Zucchini as npm would publish it, installs the tarball into a throwaway project that has only the peer
// dependencies, and uses it from there. It checks what a user gets from npm, not what the repo has.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, test } from 'vitest'

const repo = path.resolve(import.meta.dirname, '..', '..')
const manifest = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'))

/** The subpaths a user imports in Node, after the package name. */
const NODE_EXPORT_PATHS = ['', '/vite', '/runner', '/runner/preview']
/** Storybook's docs side imports the contracts from the Zucchini Vite plugin's virtual module, so it loads only
 * inside a Storybook build; here it must resolve to built code and type-check. */
const STORYBOOK_EXPORT_PATH = '/storybook'

let work: string
let project: string
let packedFiles: string[]

/** The version installed in the repo, so the throwaway project runs what the repo's tests run. */
const installedVersion = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(repo, 'node_modules', name, 'package.json'), 'utf8')).version as string

const run = (command: string, args: string[], cwd: string) => {
  try {
    return execFileSync(command, args, { cwd, stdio: 'pipe', encoding: 'utf8' })
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: string; stderr?: string }
    throw new Error(`${command} ${args.join(' ')} failed:\n${stdout ?? ''}${stderr ?? ''}`, { cause: error })
  }
}

beforeAll(() => {
  work = fs.mkdtempSync(path.join(os.tmpdir(), 'zucchini-packed-'))
  project = path.join(work, 'project')
  fs.mkdirSync(project)

  // npm pack builds first (prepack), as npm publish does.
  const [packed] = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', work], repo))
  packedFiles = packed.files.map((file: { path: string }) => file.path)

  fs.writeFileSync(
    path.join(project, 'package.json'),
    JSON.stringify({ name: 'packed-check', private: true, type: 'module' }, null, 2)
  )
  const peers = Object.keys(manifest.peerDependencies).map((name) => `${name}@${installedVersion(name)}`)
  const typescript = ['typescript', '@types/react', '@types/node'].map((name) => `${name}@${installedVersion(name)}`)
  run(
    'npm',
    [
      'install',
      path.join(work, packed.filename),
      ...peers,
      ...typescript,
      '--no-audit',
      '--no-fund',
      '--prefer-offline',
    ],
    project
  )
}, 600_000)

afterAll(() => {
  if (work) {
    fs.rmSync(work, { recursive: true, force: true })
  }
})

describe('the published package', () => {
  test('holds the built code, the license and the readme, and no sources, tests or fixtures', () => {
    expect(packedFiles).toEqual(expect.arrayContaining(['LICENSE', 'README.md', 'package.json', 'dist/index.js']))
    const unexpected = packedFiles.filter(
      (file) => !['LICENSE', 'README.md', 'package.json'].includes(file) && !file.startsWith('dist/')
    )
    expect(unexpected).toEqual([])
    expect(packedFiles.filter((file) => /\.spec\.|fixtures/.test(file))).toEqual([])
  })

  test('brings its own runner and Cucumber packages, so the user installs only the peers', () => {
    const userDependencies = Object.keys(
      JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8')).dependencies
    )
    expect(userDependencies.filter((name) => name.startsWith('@cucumber/') || name.startsWith('@lotun/'))).toEqual([])
    for (const name of ['@lotun/vitest-cucumber', '@cucumber/cucumber', '@cucumber/gherkin']) {
      expect(fs.existsSync(path.join(project, 'node_modules', name, 'package.json')), name).toBe(true)
    }
  })

  test.each(NODE_EXPORT_PATHS)('imports @camperoni/zucchini%s in Node', (subpath) => {
    expect(() =>
      run('node', ['--input-type=module', '-e', `await import('@camperoni/zucchini${subpath}')`], project)
    ).not.toThrow()
  })

  test(`resolves @camperoni/zucchini${STORYBOOK_EXPORT_PATH} to built JavaScript`, () => {
    const resolved = run(
      'node',
      ['--input-type=module', '-e', `console.log(import.meta.resolve('@camperoni/zucchini${STORYBOOK_EXPORT_PATH}'))`],
      project
    ).trim()
    expect(resolved).toMatch(/node_modules\/@camperoni\/zucchini\/dist\/storybook\.js$/)
  })

  test("type-checks a TypeScript user's imports of every export path", () => {
    fs.writeFileSync(
      path.join(project, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'bundler',
          jsx: 'react-jsx',
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          types: ['node'],
        },
        include: ['check.tsx'],
      })
    )
    fs.writeFileSync(
      path.join(project, 'check.tsx'),
      [
        'import {',
        '  type Break,',
        '  defineConfig,',
        '  librarySteps,',
        '  type StepDefinition,',
        '  type ZucchiniConfig,',
        "} from '@camperoni/zucchini'",
        "import { contractViewports, runStoryContracts } from '@camperoni/zucchini/runner/preview'",
        "import { zucchiniProjects, type ZucchiniProjectsOptions } from '@camperoni/zucchini/runner'",
        "import { ContractsDocsPage, ContractsOverview } from '@camperoni/zucchini/storybook'",
        "import { zucchiniPlugin } from '@camperoni/zucchini/vite'",
        '',
        "const config: ZucchiniConfig = defineConfig({ contracts: 'src' })",
        'const steps: readonly StepDefinition[] = librarySteps',
        'const options: ZucchiniProjectsOptions = { browsers: ["chromium"] }',
        'export const breaks: Break[] = [',
        "  { name: 'no-label', checks: 'the label is missing', file: 'src/Badge.tsx', find: '{label}', replace: '',",
        "    contracts: ['src/Badge.feature'] },",
        ']',
        'export const used = [config, steps, options, contractViewports, runStoryContracts, zucchiniProjects, zucchiniPlugin]',
        'export const pages = [<ContractsDocsPage key="docs" />, <ContractsOverview key="overview" />]',
        '',
      ].join('\n')
    )
    expect(() => run('npx', ['tsc', '-p', '.'], project)).not.toThrow()
  })
})

describe('the zucchini command, installed', () => {
  // The repo's fixture project, with its type imports pointing at the package instead of the repo's sources.
  beforeAll(() => {
    const fixture = path.join(repo, 'test', 'fixtures', 'project')
    for (const entry of ['zucchini.config.ts', 'contracts', 'steps']) {
      fs.cpSync(path.join(fixture, entry), path.join(project, entry), { recursive: true })
    }
    for (const file of ['zucchini.config.ts', path.join('steps', 'projectSteps.ts')]) {
      const target = path.join(project, file)
      fs.writeFileSync(
        target,
        fs.readFileSync(target, 'utf8').replace(/from '(\.\.\/)+src\/[^']*'/g, "from '@camperoni/zucchini'")
      )
    }
  })

  const zucchini = (...args: string[]) => {
    try {
      const output = execFileSync('npx', ['--no-install', 'zucchini', ...args], { cwd: project, stdio: 'pipe' })
      return { code: 0, output: output.toString() }
    } catch (error) {
      const failed = error as { status: number; stdout: Buffer; stderr: Buffer }
      return { code: failed.status, output: failed.stdout.toString() + failed.stderr.toString() }
    }
  }

  test('without a command, prints the usage and fails', () => {
    const result = zucchini()
    expect(result.code).not.toBe(0)
    expect(result.output).toContain('Usage: zucchini <command>')
  })

  test('catalog writes the catalog with the project step, and --check finds it up to date', () => {
    expect(zucchini('catalog')).toEqual({
      code: 0,
      output: 'Wrote catalog/steps.json and catalog/steps.md (11 steps).\n',
    })
    expect(zucchini('catalog', '--check')).toEqual({ code: 0, output: 'The step catalog is up to date (11 steps).\n' })
  })

  test('lint passes on the project contracts', () => {
    zucchini('catalog')
    const result = zucchini('lint')
    expect(result.code, result.output).toBe(0)
  })

  test('merge-results skips a missing file and leaves the results as they were', () => {
    const result = zucchini('merge-results', 'missing.json')
    expect(result.code).toBe(0)
    expect(result.output).toContain('No results to merge')
  })

  test('contracts asks for the Vitest config that defines the contract projects', () => {
    const result = zucchini('contracts')
    expect(result.code).toBe(2)
    expect(result.output).toContain('--config <file>')
  })

  test('mutation prints its usage without a config and breaks', () => {
    const result = zucchini('mutation')
    expect(result.code).toBe(2)
    expect(result.output).toContain('Usage: zucchini mutation')
  })
})
