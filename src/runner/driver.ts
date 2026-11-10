// The step library's Driver over Vitest's browser mode (browser side): real clicks and hovers through
// `userEvent`, and geolocation through a fake of the page's navigator.geolocation (see geolocation.ts).
import { userEvent } from 'vitest/browser'

import type { Driver } from '../steps/types.ts'
import type { ScenarioResult } from '../view/viewModel.ts'
import { createGeolocationFake } from './geolocation.ts'

declare module 'vitest/browser' {
  interface BrowserCommands {
    livingSpecRecord: (result: ScenarioResult) => Promise<void>
    livingSpecResetPointer: () => Promise<void>
  }
}

/** The page's geolocation fake. The runner resets it before each scenario. */
export const geolocationFake = createGeolocationFake(navigator.geolocation)

export const vitestDriver: Driver = {
  click: async (element) => {
    await userEvent.click(element)
  },
  hover: async (element) => {
    await userEvent.hover(element)
  },
  setGeolocation: async (permission, latitude, longitude) => {
    geolocationFake.set(permission, latitude, longitude)
  },
}
