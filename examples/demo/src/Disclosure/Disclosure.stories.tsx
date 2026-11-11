import type { Meta, StoryObj } from '@storybook/react-vite'

import { Disclosure } from './Disclosure'

const meta = {
  title: 'Demo/Disclosure',
  component: Disclosure,
  args: {
    summary: 'What does Zucchini check?',
    children: 'What each component promises, in every browser, on desktop and mobile.',
  },
} satisfies Meta<typeof Disclosure>

export default meta
type Story = StoryObj<typeof meta>

export const Closed: Story = {}

export const Open: Story = {
  args: { defaultOpen: true },
}
