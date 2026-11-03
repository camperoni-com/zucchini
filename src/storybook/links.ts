import type { Status } from '../view/viewModel.ts'

// Links from a docs page go to the manager (target="_top"), which then shows the story or docs page.
export const storyHref = (storyId: string) => `./?path=/story/${storyId}`
export const docsHref = (componentId: string) => `./?path=/docs/${componentId}--docs`

export const STATUS_LABEL: Record<Status, string> = {
  passed: 'Passed',
  failed: 'Failed',
  changed: 'Changed since last run',
  'not-run': 'Not run yet',
}

export const formatTime = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export const plural = (n: number, noun: string, nouns = `${noun}s`) => `${n} ${n === 1 ? noun : nouns}`
