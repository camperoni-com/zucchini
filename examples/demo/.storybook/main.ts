import { zucchiniPlugin } from '@camperoni/zucchini/vite'
import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: { name: '@storybook/react-vite', options: {} },
  // The contracts beside the stories, and the results of the last contract run, reach the docs pages through
  // Zucchini's Vite plugin.
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    plugins: [...(viteConfig.plugins ?? []), zucchiniPlugin()],
  }),
}

export default config
