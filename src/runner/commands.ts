// The runner's Vitest commands: the parts of a scenario that need Node and Playwright's browser context.
// Node only.
//
// The empty import types Playwright's `page` and `context` on the command context.
import type {} from '@vitest/browser-playwright'
import type { BrowserCommand } from 'vitest/node'

import type { ScenarioResult } from '../view/viewModel.ts'
import { appendResult } from './results.ts'

const playwrightOnly = (name: string, provider: string) => {
  if (provider !== 'playwright') {
    throw new Error(`${name} needs Vitest's Playwright provider, not ${provider}`)
  }
}

export const createCommands = ({ resultsFile }: { resultsFile: string }) => {
  const livingSpecRecord: BrowserCommand<[ScenarioResult]> = async (_ctx, result) => {
    appendResult(resultsFile, result)
  }

  // Several scenarios share one page, so the real mouse stays where the last one left it, and a story mounted
  // under it gets hovered (a tooltip opens by itself). Park it in the outer page's corner before each scenario.
  const livingSpecResetPointer: BrowserCommand<[]> = async (ctx) => {
    playwrightOnly('livingSpecResetPointer', ctx.provider.name)
    await ctx.page.mouse.move(0, 0)
  }

  return { livingSpecRecord, livingSpecResetPointer }
}
