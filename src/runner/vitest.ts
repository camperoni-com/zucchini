// The contract runner's Vitest side (Node). It builds one Vitest browser project per browser and device that
// renders the stories through Storybook's Vitest add-on and, from the project-level `afterEach` (preview.ts),
// runs the scenarios bound to each story through @lotun/vitest-cucumber. Everything runner-specific lives in
// this folder; the steps only see the Driver.
//
//   // vitest.living-spec.config.mts
//   export default defineConfig({ test: { projects: await livingSpecProjects() } })
//
// Then `vitest run --config vitest.living-spec.config.mts --project contracts-chromium-desktop`, one project
// at a time (they all serve on the same port), or `node packages/living-spec/bin/contracts.ts`, which does that.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { cucumber } from '@lotun/vitest-cucumber'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import { type BrowserContextOptions, devices as playwrightDevices } from 'playwright'
import type { Plugin } from 'vite'
import type { TestProjectInlineConfiguration } from 'vitest/config'

import { loadConfig } from '../config/load.ts'
import { computeRunBindings } from './bindings.ts'
import { createCommands } from './commands.ts'
import {
  type Browser,
  browserLabel,
  BROWSERS,
  type Device,
  DEVICE_VIEWPORTS,
  DEVICES,
  projectName,
  viewportKey,
} from './devices.ts'
import { dropBrowser } from './results.ts'
import type { RunnerSettings } from './runtime.ts'

export const RUNNER_MODULE_ID = 'virtual:living-spec/runner'
const RESOLVED_ID = `\0${RUNNER_MODULE_ID}`

const here = path.dirname(fileURLToPath(import.meta.url))

// @lotun/vitest-cucumber reads Cucumber's own config file from the working directory, merged under its
// options. A project's cucumber.js for other suites (Camperoni's E2E: --require e2e/steps, --parallel 5) must
// not leak into the contract run, so the runner names its own, empty one. CUCUMBER_OPTIONS still works for the
// rest, e.g. --tags.
if (!/(^|\s)(--config|-c)\b/.test(process.env.CUCUMBER_OPTIONS ?? '')) {
  process.env.CUCUMBER_OPTIONS =
    `--config ${JSON.stringify(path.relative(process.cwd(), path.join(here, 'cucumber.json')))} ${process.env.CUCUMBER_OPTIONS ?? ''}`.trim()
}

// Vitest renders the story in an iframe inside its own page and scales the iframe down when that page is
// smaller, and Playwright can't click inside a scaled iframe ("element is outside of the viewport"). So the
// outer page is larger than any story viewport; the story gets its device size from the `viewport` global.
const OUTER_PAGE = { width: 1600, height: 1200 }

const contextOptionsFor = (browser: Browser, device: Device): BrowserContextOptions => {
  if (device === 'desktop') {
    return { viewport: OUTER_PAGE }
  }
  // The old E2E's mobile device. Firefox has no mobile emulation (Playwright rejects `isMobile` there), so it
  // gets the same size, touch and user agent without it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { defaultBrowserType, isMobile, ...iPhone } = playwrightDevices['iPhone 13']
  return { ...iPhone, ...(browser === 'firefox' ? {} : { isMobile }), viewport: OUTER_PAGE, screen: OUTER_PAGE }
}

const runnerPlugin = ({
  settings,
  projectStepsFile,
  resultsFile,
  storyFiles,
}: {
  settings: RunnerSettings
  projectStepsFile?: string
  resultsFile: string
  storyFiles: string[]
}): Plugin => ({
  name: 'living-spec:runner',
  config: () => ({
    optimizeDeps: {
      // Vite's pre-bundler can't follow the runner plugin's virtual module from its browser entry.
      exclude: ['@lotun/vitest-cucumber', '@lotun/vitest-cucumber/browser'],
      // The steps' code is first loaded mid-run, and a dependency found then reloads the page under the tests.
      include: ['@cucumber/cucumber-expressions'],
    },
  }),
  configureVitest({ project }) {
    // Only the story files with a contract beside them run; Storybook's add-on would include every story.
    project.config.include = storyFiles
    // A fresh run of this browser and device replaces its earlier results and keeps the other browsers'.
    dropBrowser(resultsFile, settings.browser)
  },
  resolveId: (id) => (id === RUNNER_MODULE_ID ? RESOLVED_ID : undefined),
  load: (id) =>
    id === RESOLVED_ID
      ? [
          `export const settings = ${JSON.stringify(settings)}`,
          projectStepsFile
            ? `export { projectSteps } from ${JSON.stringify(projectStepsFile)}`
            : 'export const projectSteps = []',
        ].join('\n')
      : undefined,
})

export interface LivingSpecProjectsOptions {
  /** The project root, where the living-spec config lives. Default: the working directory. */
  root?: string
  /** Storybook's config folder, relative to `root`. Default `.storybook`. */
  configDir?: string
  browsers?: readonly Browser[]
  devices?: readonly Device[]
  /** The port the browser tests are served on. Default 5173. */
  port?: number
  /** Added to every browser context, e.g. `{ timezoneId }`. */
  contextOptions?: BrowserContextOptions
  /** Per story test, which runs every scenario bound to the story. Default 300 s. */
  testTimeout?: number
}

/** One Vitest browser project per browser and device, named `contracts-<browser>-<device>`. */
export const livingSpecProjects = async ({
  root = process.cwd(),
  configDir = '.storybook',
  browsers = BROWSERS,
  devices = DEVICES,
  port = 5173,
  contextOptions = {},
  // Storybook's 15 s default is too short: the busiest story runs 11 scenarios, some with fixed waits.
  testTimeout = 300_000,
}: LivingSpecProjectsOptions = {}): Promise<TestProjectInlineConfiguration[]> => {
  const { config } = await loadConfig(root)
  const resultsFile = path.resolve(root, config.results)
  const projectStepsFile = config.projectSteps ? path.resolve(root, config.projectSteps) : undefined

  const projects: TestProjectInlineConfiguration[] = []
  for (const device of devices) {
    const bindings = await computeRunBindings({ root, dir: config.contracts, device })
    if (bindings.problems.length) {
      // A contract bound to no story would silently stop running.
      throw new Error(
        `The contracts don't bind (run the contract linter):\n${bindings.problems
          .map((p) => `  ${p.file}:${p.line}: ${p.message}`)
          .join('\n')}`
      )
    }
    for (const browser of browsers) {
      const settings: RunnerSettings = {
        root,
        device,
        browser: browserLabel(browser, device),
        testIdAttribute: config.testIdAttribute,
        stories: bindings.stories,
      }
      projects.push({
        extends: true,
        plugins: [
          storybookTest({
            configDir: path.resolve(root, configDir),
            initialGlobals: { viewport: { value: viewportKey(device), isRotated: false } },
          }),
          cucumber({ import: [path.relative(root, path.join(here, 'support.ts'))] }),
          runnerPlugin({ settings, projectStepsFile, resultsFile, storyFiles: bindings.storyFiles }),
        ],
        test: {
          name: projectName(browser, device),
          testTimeout,
          setupFiles: [path.join(here, 'setup.ts')],
          // The port the browser tests are served on (Vitest 5 reads a browser project's from `test.api`). A
          // fixed one, since an API key restricted by referrer (Google Maps, for one) accepts only known ones.
          api: { port, strictPort: true },
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({
              // Fail a stuck click with Playwright's reason rather than the step timeout.
              actionTimeout: 20_000,
              contextOptions: { ...contextOptionsFor(browser, device), ...contextOptions },
            }),
            instances: [{ browser }],
            viewport: DEVICE_VIEWPORTS[device],
            commands: createCommands({ resultsFile }),
          },
        },
      })
    }
  }
  return projects
}
