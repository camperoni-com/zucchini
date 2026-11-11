import { defineConfig } from '@camperoni/zucchini'

export default defineConfig({
  // The contracts sit beside their stories under src/.
  contracts: 'src',
  // The step catalog, committed so people and agents can read it.
  catalog: 'docs/zucchini',
})
