import { contractViewports, runStoryContracts } from '@camperoni/zucchini/runner/preview'
import { ContractsDocsPage } from '@camperoni/zucchini/storybook'
import type { Preview } from '@storybook/react-vite'
import { INITIAL_VIEWPORTS } from 'storybook/viewport'

const preview: Preview = {
  tags: ['autodocs'],
  parameters: {
    // Zucchini's two devices come after the usual ones.
    viewport: { options: { ...INITIAL_VIEWPORTS, ...contractViewports } },
    // Each component's docs page: Storybook's default docs, then the component's contracts.
    docs: { page: ContractsDocsPage },
  },
  // In a contract run (npm run contracts), runs the contracts bound to each story once it has rendered.
  // Anywhere else, it does nothing.
  afterEach: runStoryContracts,
}

export default preview
