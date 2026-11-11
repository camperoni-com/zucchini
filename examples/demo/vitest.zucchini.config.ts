// The contract runs: one Vitest browser project per browser and device (contracts-<browser>-<device>).
// `npm run contracts` runs them one after the other and writes the results the living spec shows.
import { zucchiniProjects } from '@camperoni/zucchini/runner'
import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config.ts'

export default mergeConfig(viteConfig, defineConfig({ test: { projects: await zucchiniProjects() } }))
