// The packed-install test: builds, packs and installs the package into a throwaway project. Slow, so it runs on
// its own (npm run test:packed), not with the unit tests.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/packed/**/*.spec.ts'],
    testTimeout: 120_000,
    hookTimeout: 600_000,
  },
})
