// A Vitest setup file (browser): publishes the runner for Storybook's `afterEach` (preview.ts), which can't
// import the runner itself because a normal Storybook build must not bundle it.
import { runCucumber } from '@lotun/vitest-cucumber/browser'
import { settings } from 'virtual:living-spec/runner'

import { publishRuntime, type RunCucumber } from './runtime.ts'

publishRuntime(settings, runCucumber as RunCucumber)
