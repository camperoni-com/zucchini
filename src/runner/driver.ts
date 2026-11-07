// The step library's Driver over Vitest's browser mode (browser side): real clicks and hovers through
// `userEvent`, and browser-context actions through the runner's commands, which run in Node (see commands.ts).
import { commands, userEvent } from 'vitest/browser'

import type { Driver } from '../steps/types.ts'
import type { ScenarioResult } from '../view/viewModel.ts'

declare module 'vitest/browser' {
  interface BrowserCommands {
    livingSpecRecord: (result: ScenarioResult) => Promise<void>
    livingSpecResetPointer: () => Promise<void>
    livingSpecSetGeolocation: (permission: string, latitude: string, longitude: string) => Promise<void>
  }
}

export const vitestDriver: Driver = {
  click: async (element) => {
    await userEvent.click(element)
  },
  hover: async (element) => {
    await userEvent.hover(element)
  },
  setGeolocation: (permission, latitude, longitude) =>
    commands.livingSpecSetGeolocation(permission, latitude, longitude),
}
