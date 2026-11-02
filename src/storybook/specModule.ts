// The data the Vite plugin provides (see vitePlugin.ts), typed.
import data from 'virtual:living-spec/contracts'

import type { SpecData } from '../view/specData.ts'

export const spec = data as SpecData
