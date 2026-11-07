// What the browser side of the runner shares through globalThis. Browser-safe, and free of runner imports, so
// Storybook's preview can import it in a normal Storybook too, where nothing is published and the contracts
// don't run.
//
// The story test (Storybook's preview) and the Cucumber support code (loaded by @lotun/vitest-cucumber) run in
// the same page but may get separate copies of a module, so they meet on globalThis rather than in a module.
import type { StoryRun } from './bindings.ts'
import type { Device } from './devices.ts'

/** The settings the runner's Vite plugin hands the browser (see vitest.ts). */
export interface RunnerSettings {
  /** The project root, absolute. */
  root: string
  device: Device
  /** The browser and device label results carry, such as `webkit-mobile`. */
  browser: string
  testIdAttribute: string
  /** By Storybook story id. */
  stories: Record<string, StoryRun>
}

/** What @lotun/vitest-cucumber's browser `runCucumber()` returns, as far as the runner reads it. */
export type RunCucumber = (options: {
  id: string
  config?: { worldParameters?: Record<string, unknown> }
}) => Promise<{ results: { status: string; error?: Error }[] }>

/** The story a scenario runs on, as Storybook's `afterEach` receives it. */
export interface StoryHandle {
  id: string
  /** Mounts the story afresh. */
  renderToCanvas?: () => Promise<void> | void
}

/** A story being run, keyed for the scenarios' World. */
export interface StoryEntry {
  story: StoryHandle
  /** The feature file, relative to the project root. */
  file: string
  /** How many of its scenarios have started. */
  started: number
}

interface Runtime {
  settings: RunnerSettings
  runCucumber: RunCucumber
  stories: Map<string, StoryEntry>
}

const globalRef = globalThis as { __livingSpecRunner__?: Runtime }

/** Called once per test file by the runner's setup file. */
export const publishRuntime = (settings: RunnerSettings, runCucumber: RunCucumber) => {
  globalRef.__livingSpecRunner__ ??= { settings, runCucumber, stories: new Map() }
}

/** The runner, or undefined outside a contract run. */
export const runtime = () => globalRef.__livingSpecRunner__

/** The World parameters that tie a scenario to the story it runs on. */
export interface WorldParameters {
  storyKey?: string
}
