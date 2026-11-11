// Builds the published package into dist/: ESM with type declarations. Dependencies and peer dependencies stay
// imports; the runner's own browser-side modules (setup, support) are entries of their own, because the runner
// hands their paths to Vitest and Cucumber at run time.
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    storybook: 'src/storybook/index.ts',
    vite: 'src/storybook/vitePlugin.ts',
    'runner/vitest': 'src/runner/vitest.ts',
    'runner/preview': 'src/runner/preview.ts',
    'runner/setup': 'src/runner/setup.ts',
    'runner/support': 'src/runner/support.ts',
    cli: 'src/cli/zucchini.ts',
  },
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  dts: true,
  clean: true,
  // The runner's virtual modules exist only inside a contract run.
  deps: { neverBundle: [/^virtual:zucchini\//, /^node:/] },
  copy: [{ from: 'src/runner/cucumber.json', to: 'dist/runner' }],
})
