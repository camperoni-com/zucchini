// Reads story names from a CSF story file. Storybook's CSF reader is an internal API, so this is the only
// module that imports it: a change there touches this file alone.
import { readCsf } from 'storybook/internal/csf-tools'

export interface Story {
  /** The display name a contract binds to, for example "Map View Default". */
  name: string
  /** Storybook's story id, for example "camperoni-components-mapviewcomponent--map-view-default". */
  id: string
}

export interface StoryFile {
  file: string
  title: string
  stories: Story[]
}

export const readStoryFile = async (file: string): Promise<StoryFile> => {
  const csf = (await readCsf(file, { makeTitle: (title?: string) => title ?? '' })).parse()
  return {
    file,
    title: csf.meta.title ?? '',
    stories: csf.stories.map((story) => ({ name: story.name ?? story.id, id: story.id })),
  }
}
