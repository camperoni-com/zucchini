import type { Meta, StoryObj } from '@storybook/react-vite'

import { Badge } from './Badge'

const meta = {
  title: 'Demo/Badge',
  component: Badge,
  args: { label: 'Draft' },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Success: Story = {
  args: { label: 'Published', tone: 'success' },
}

export const WithCount: Story = {
  args: { label: 'Unread', tone: 'warning', count: 3 },
}

export const AsLink: Story = {
  args: { label: 'Changelog', href: '/changelog' },
}
