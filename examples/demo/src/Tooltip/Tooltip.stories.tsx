import type { Meta, StoryObj } from '@storybook/react-vite'

import { Tooltip } from './Tooltip'

const meta = {
  title: 'Demo/Tooltip',
  component: Tooltip,
  args: { text: 'Contracts run in Chromium, Firefox and WebKit.', children: 'Which browsers?' },
  decorators: [
    // Somewhere else on the page, for the pointer to move to.
    (Story) => (
      <div style={{ display: 'flex', gap: '2rem', alignItems: 'start', minHeight: '6rem' }}>
        <Story />
        <p data-testid="elsewhere">Some text beside it.</p>
      </div>
    ),
  ],
} satisfies Meta<typeof Tooltip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
