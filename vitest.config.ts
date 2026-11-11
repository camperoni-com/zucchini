// The unit tests. The packed-install test has its own config (vitest.packed.config.ts).
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'test/packed/**'],
  },
})
