import type { Meta, StoryObj } from '@storybook/react-vite'

import { UseMyLocation } from './UseMyLocation'

const meta = {
  title: 'Demo/UseMyLocation',
  component: UseMyLocation,
} satisfies Meta<typeof UseMyLocation>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
