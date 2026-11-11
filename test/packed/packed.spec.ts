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
        "import { defineConfig, librarySteps, type StepDefinition, type ZucchiniConfig } from '@camperoni/zucchini'",
        "import { contractViewports, runStoryContracts } from '@camperoni/zucchini/runner/preview'",
        "import { zucchiniProjects, type ZucchiniProjectsOptions } from '@camperoni/zucchini/runner'",
        "import { ContractsDocsPage, ContractsOverview } from '@camperoni/zucchini/storybook'",
        "import { zucchiniPlugin } from '@camperoni/zucchini/vite'",
        '',
        "const config: ZucchiniConfig = defineConfig({ contracts: 'src' })",
        'const steps: readonly StepDefinition[] = librarySteps',
        'const options: ZucchiniProjectsOptions = { browsers: ["chromium"] }',
        'export const used = [config, steps, options, contractViewports, runStoryContracts, zucchiniProjects, zucchiniPlugin]',
        'export const pages = [<ContractsDocsPage key="docs" />, <ContractsOverview key="overview" />]',
        '',
      ].join('\n')
    )
    expect(() => run('npx', ['tsc', '-p', '.'], project)).not.toThrow()
  })
})
