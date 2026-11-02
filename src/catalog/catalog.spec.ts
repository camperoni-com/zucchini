import { describe, expect, test } from 'vitest'

import type { StepDefinition } from '../steps/types.ts'
import { buildCatalog, catalogToJson, catalogToMarkdown } from './catalog.ts'

const run = async () => undefined

const library: StepDefinition[] = [
  {
    keyword: 'Then',
    wording: 'the {string} badge shows {int} items',
    meaning: 'Checks a badge.',
    example: 'the "cart" badge shows 3 items',
    run,
  },
  { keyword: 'When', wording: 'I reload the page', meaning: 'Reloads.', example: 'I reload the page', run },
]

const project: StepDefinition[] = [
  {
    keyword: 'Given',
    wording: 'I am in the {string} metro',
    meaning: 'Picks a metro.',
    example: 'I am in the "Bay Area" metro',
    run,
  },
]

const generatedBy = 'npm run catalog'

describe('buildCatalog', () => {
  test('lists each step with its wording, parameter types, meaning, example and source', () => {
    expect(buildCatalog({ library, project, generatedBy })).toEqual({
      generatedBy,
      steps: [
        {
          keyword: 'Then',
          wording: 'the {string} badge shows {int} items',
          parameters: ['string', 'int'],
          meaning: 'Checks a badge.',
          example: 'the "cart" badge shows 3 items',
          source: 'library',
        },
        {
          keyword: 'When',
          wording: 'I reload the page',
          parameters: [],
          meaning: 'Reloads.',
          example: 'I reload the page',
          source: 'library',
        },
        {
          keyword: 'Given',
          wording: 'I am in the {string} metro',
          parameters: ['string'],
          meaning: 'Picks a metro.',
          example: 'I am in the "Bay Area" metro',
          source: 'project',
        },
      ],
    })
  })

  test('refuses an example that its own wording does not match', () => {
    const wrong = [{ ...library[1], example: 'I reload the pages' }]
    expect(() => buildCatalog({ library: wrong, generatedBy })).toThrow(
      `The example of "I reload the page" doesn't match its wording: "I reload the pages"`
    )
  })
})

describe('catalog files', () => {
  const catalog = buildCatalog({ library, project, generatedBy })

  test('JSON is the catalog, pretty-printed with a final newline', () => {
    const json = catalogToJson(catalog)
    expect(JSON.parse(json)).toEqual(catalog)
    expect(json.endsWith('}\n')).toBe(true)
  })

  test('Markdown lists library and project steps in their own sections', () => {
    expect(catalogToMarkdown(catalog)).toBe(
      [
        '# Step catalog',
        '',
        "Every step a contract can use. Generated from the step definitions by `npm run catalog`; don't edit it by hand.",
        '',
        '3 steps: 2 from the library, 1 from the project.',
        '',
        '## Library steps',
        '',
        '### Then the {string} badge shows {int} items',
        '',
        'Checks a badge.',
        '',
        '- Parameters: `string`, `int`',
        '- Example: `Then the "cart" badge shows 3 items`',
        '',
        '### When I reload the page',
        '',
        'Reloads.',
        '',
        '- Parameters: none',
        '- Example: `When I reload the page`',
        '',
        '## Project steps',
        '',
        '### Given I am in the {string} metro',
        '',
        'Picks a metro.',
        '',
        '- Parameters: `string`',
        '- Example: `Given I am in the "Bay Area" metro`',
        '',
      ].join('\n')
    )
  })

  test('Markdown says when there are no project steps', () => {
    expect(catalogToMarkdown(buildCatalog({ library, generatedBy }))).toContain('## Project steps\n\nNone.\n')
  })
})
