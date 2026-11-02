/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { createStepContext, DEFAULT_BUDGETS } from './dom.ts'
import {
  attributeValue,
  clickByAttribute,
  clickByTestId,
  elementType,
  hoverOrClick,
  librarySteps,
  setGeolocation,
  textContains,
  textEquals,
  visibility,
  waitSeconds,
} from './library.ts'
import type { Driver, StepContext } from './types.ts'

const fakeDriver = () => ({
  click: vi.fn<Driver['click']>(async () => undefined),
  hover: vi.fn<Driver['hover']>(async () => undefined),
  setGeolocation: vi.fn<Driver['setGeolocation']>(async () => undefined),
})

// Small budgets keep the failing cases fast; the polling spec below uses the real ones.
const SMALL = { assertionMs: 40, pollMs: 5, expectMs: 40, visibilityMs: 40, settleMs: 0 }

let driver: ReturnType<typeof fakeDriver>
let context: StepContext

// jsdom lays nothing out, so every box is empty: give the elements we want visible a size.
const show = (element: Element) => {
  element.getBoundingClientRect = () => ({ width: 20, height: 10 }) as DOMRect
}

const html = (markup: string) => {
  document.body.innerHTML = markup
}

const el = (testId: string, attribute = 'data-testid') =>
  document.querySelector<HTMLElement>(`[${attribute}="${testId}"]`) as HTMLElement

beforeEach(() => {
  driver = fakeDriver()
  context = createStepContext({ driver, budgets: SMALL })
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('the step library', () => {
  test('holds the 10 v1 steps, with the old E2E wording', () => {
    expect(librarySteps.map((step) => `${step.keyword} ${step.wording}`)).toEqual([
      'Then I should assert that the element with id {string} contains {string}',
      'Then I should assert that the element with id {string} has an exact value of {string}',
      'Then I should assert that the element with id {string} is of type {string}',
      'Then I should assert that the element with id {string} has an attribute {string} with value {string}',
      'Then I should assert that the {string} element {string} visible',
      'When I click on the element with id {string}',
      'When I click on the element which has an attribute {string} with value {string}',
      'When I {string} over the element with id {string}',
      'When I wait for {string} seconds',
      'When I {string} geolocation and set the location to {string}, {string}',
    ])
  })

  test('gives every step a meaning and an example', () => {
    for (const step of librarySteps) {
      expect(step.meaning, step.wording).not.toBe('')
      expect(step.example, step.wording).not.toBe('')
    }
  })
})

describe('text contains', () => {
  test('passes when the text contains the value', async () => {
    html('<p data-testid="label">  Full day camp </p>')
    await expect(textContains.run(context, 'label', 'Full day')).resolves.toBeUndefined()
  })

  test('fails with both texts when it does not', async () => {
    html('<p data-testid="label">Half day</p>')
    await expect(textContains.run(context, 'label', 'Full day')).rejects.toThrow(
      'Expected "Half day" to include "Full day"'
    )
  })

  test('fails on a missing element', async () => {
    await expect(textContains.run(context, 'label', 'Full day')).rejects.toThrow('Expected "" to include "Full day"')
  })

  test('reads the first match, like the old step', async () => {
    html('<p data-testid="label">first</p><p data-testid="label">second</p>')
    await expect(textContains.run(context, 'label', 'first')).resolves.toBeUndefined()
    await expect(textContains.run(context, 'label', 'second')).rejects.toThrow()
  })
})

describe('text has an exact value', () => {
  test('passes on the exact text, trimmed', async () => {
    html('<p data-testid="ages">\n  5-17 years old  \n</p>')
    await expect(textEquals.run(context, 'ages', '5-17 years old')).resolves.toBeUndefined()
  })

  test('fails on a partial match', async () => {
    html('<p data-testid="ages">5-17 years old</p>')
    await expect(textEquals.run(context, 'ages', '5-17')).rejects.toThrow('Expected "5-17 years old" to equal "5-17"')
  })

  test('normalizes line breaks on both sides', async () => {
    html('<p data-testid="dates"></p>')
    el('dates').textContent = 'May 1\r\nMay 5\rMay 9'
    // A literal \r written in a feature file is dropped from the expected value.
    await expect(textEquals.run(context, 'dates', 'May 1\\r\nMay 5\nMay 9')).resolves.toBeUndefined()
  })
})

describe('element is of type', () => {
  test('passes on the tag name', async () => {
    html('<a data-testid="link" href="#">Go</a>')
    await expect(elementType.run(context, 'link', 'a')).resolves.toBeUndefined()
  })

  test('fails on another tag name', async () => {
    html('<button data-testid="link">Go</button>')
    await expect(elementType.run(context, 'link', 'a')).rejects.toThrow('Expected <a>, got <button>')
  })

  test('is strict: two matches fail', async () => {
    html('<a data-testid="link"></a><a data-testid="link"></a>')
    await expect(elementType.run(context, 'link', 'a')).rejects.toThrow(
      'Expected exactly one [data-testid="link"], found 2'
    )
  })

  test('fails when nothing matches', async () => {
    await expect(elementType.run(context, 'link', 'a')).rejects.toThrow('found 0')
  })
})

describe('element has an attribute with a value', () => {
  test('passes on the exact value', async () => {
    html('<div data-testid="map" data-map-zoom="6"></div>')
    await expect(attributeValue.run(context, 'map', 'data-map-zoom', '6')).resolves.toBeUndefined()
  })

  test('fails on another value', async () => {
    html('<div data-testid="map" data-map-zoom="7"></div>')
    await expect(attributeValue.run(context, 'map', 'data-map-zoom', '6')).rejects.toThrow(
      'Expected [data-testid="map"] data-map-zoom="6", got "7"'
    )
  })

  test('fails on a missing attribute', async () => {
    html('<div data-testid="map"></div>')
    await expect(attributeValue.run(context, 'map', 'data-map-zoom', '6')).rejects.toThrow('got "null"')
  })

  test('is strict: two matches fail', async () => {
    html('<div data-testid="map" data-map-zoom="6"></div><div data-testid="map" data-map-zoom="6"></div>')
    await expect(attributeValue.run(context, 'map', 'data-map-zoom', '6')).rejects.toThrow('got "<2 elements>"')
  })
})

describe('element is visible or not visible', () => {
  test('is_visible passes on an element with a box', async () => {
    html('<span data-testid="icon"></span>')
    show(el('icon'))
    await expect(visibility.run(context, 'icon', 'is_visible')).resolves.toBeUndefined()
  })

  test('is_visible fails on an empty box', async () => {
    html('<span data-testid="icon"></span>')
    await expect(visibility.run(context, 'icon', 'is_visible')).rejects.toThrow(
      '[data-testid="icon"] did not become visible'
    )
  })

  test('is_visible fails on visibility: hidden, even with a box', async () => {
    html('<span data-testid="icon" style="visibility: hidden"></span>')
    show(el('icon'))
    await expect(visibility.run(context, 'icon', 'is_visible')).rejects.toThrow('did not become visible')
  })

  test('is_visible fails on a missing element', async () => {
    await expect(visibility.run(context, 'icon', 'is_visible')).rejects.toThrow('did not become visible')
  })

  test('is_visible is strict: two matches fail', async () => {
    html('<span data-testid="icon"></span><span data-testid="icon"></span>')
    await expect(visibility.run(context, 'icon', 'is_visible')).rejects.toThrow(
      'strict mode violation: [data-testid="icon"] resolved to 2 elements'
    )
  })

  test('is_not_visible passes on a missing or hidden element', async () => {
    await expect(visibility.run(context, 'icon', 'is_not_visible')).resolves.toBeUndefined()
    html('<span data-testid="icon" style="visibility: hidden"></span>')
    show(el('icon'))
    await expect(visibility.run(context, 'icon', 'is_not_visible')).resolves.toBeUndefined()
  })

  test('is_not_visible fails on a visible element', async () => {
    html('<span data-testid="icon"></span>')
    show(el('icon'))
    await expect(visibility.run(context, 'icon', 'is_not_visible')).rejects.toThrow(
      '[data-testid="icon"] is still visible'
    )
  })

  test('rejects any other state', async () => {
    await expect(visibility.run(context, 'icon', 'visible')).rejects.toThrow('Invalid value for elementExist: visible')
  })
})

describe('click the element with a test id', () => {
  test('clicks it through the driver', async () => {
    html('<button data-testid="locate"></button>')
    show(el('locate'))
    await clickByTestId.run(context, 'locate')
    expect(driver.click).toHaveBeenCalledWith(el('locate'))
  })

  test('fails without clicking when it is not visible', async () => {
    html('<button data-testid="locate"></button>')
    await expect(clickByTestId.run(context, 'locate')).rejects.toThrow('did not become visible')
    expect(driver.click).not.toHaveBeenCalled()
  })

  test('is strict: two matches fail', async () => {
    html('<button data-testid="locate"></button><button data-testid="locate"></button>')
    await expect(clickByTestId.run(context, 'locate')).rejects.toThrow('strict mode violation')
    expect(driver.click).not.toHaveBeenCalled()
  })
})

describe('click the element with an attribute value', () => {
  test('clicks it through the driver', async () => {
    html('<button aria-label="Zoom in"></button>')
    const button = document.querySelector('button') as HTMLElement
    show(button)
    await clickByAttribute.run(context, 'aria-label', 'Zoom in')
    expect(driver.click).toHaveBeenCalledWith(button)
  })

  test('matches a value with quotes in it', async () => {
    html(`<button aria-label='Say "hi"'></button>`)
    const button = document.querySelector('button') as HTMLElement
    show(button)
    await clickByAttribute.run(context, 'aria-label', 'Say "hi"')
    expect(driver.click).toHaveBeenCalledWith(button)
  })

  test('fails when nothing matches', async () => {
    await expect(clickByAttribute.run(context, 'aria-label', 'Zoom in')).rejects.toThrow(
      '[aria-label="Zoom in"] did not become visible'
    )
  })
})

describe('hover or click over an element', () => {
  beforeEach(() => {
    html('<label data-testid="combinable"></label>')
    show(el('combinable'))
  })

  test('hovers through the driver', async () => {
    await hoverOrClick.run(context, 'hover', 'combinable')
    expect(driver.hover).toHaveBeenCalledWith(el('combinable'))
    expect(driver.click).not.toHaveBeenCalled()
  })

  test('clicks through the driver', async () => {
    await hoverOrClick.run(context, 'click', 'combinable')
    expect(driver.click).toHaveBeenCalledWith(el('combinable'))
  })

  test('rejects any other action', async () => {
    await expect(hoverOrClick.run(context, 'tap', 'combinable')).rejects.toThrow(
      'Invalid action: tap. Expected "hover" or "click".'
    )
  })

  test('lets the UI settle afterwards', async () => {
    vi.useFakeTimers()
    const settled = vi.fn()
    void hoverOrClick.run(createStepContext({ driver }), 'hover', 'combinable').then(settled)
    await vi.advanceTimersByTimeAsync(DEFAULT_BUDGETS.settleMs - 1)
    expect(settled).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(settled).toHaveBeenCalled()
  })
})

describe('wait some seconds', () => {
  test('waits the given number of seconds', async () => {
    vi.useFakeTimers()
    const done = vi.fn()
    void waitSeconds.run(context, '2').then(done)
    await vi.advanceTimersByTimeAsync(1999)
    expect(done).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(done).toHaveBeenCalled()
  })
})

describe('set geolocation', () => {
  test('hands permission and location to the driver', async () => {
    await setGeolocation.run(context, 'allow', '51.50', '-0.12')
    expect(driver.setGeolocation).toHaveBeenCalledWith('allow', '51.50', '-0.12')
  })

  test('passes a denial with empty coordinates', async () => {
    await setGeolocation.run(context, 'deny', '', '')
    expect(driver.setGeolocation).toHaveBeenCalledWith('deny', '', '')
  })
})

describe('polling', () => {
  test('an assertion passes as soon as the page catches up', async () => {
    html('<p data-testid="label">Loading</p>')
    setTimeout(() => {
      el('label').textContent = 'Full day'
    }, 15)
    await expect(textEquals.run(context, 'label', 'Full day')).resolves.toBeUndefined()
  })

  test('a text assertion keeps reading for 10 s, every 200 ms, before it fails', async () => {
    vi.useFakeTimers()
    html('<p data-testid="label">Half day</p>')
    const reads = vi.spyOn(document, 'querySelectorAll')
    const outcome = vi.fn()
    textEquals.run(createStepContext({ driver }), 'label', 'Full day').then(
      () => outcome('passed'),
      () => outcome('failed')
    )
    await vi.advanceTimersByTimeAsync(9999)
    expect(outcome).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(200)
    expect(outcome).toHaveBeenCalledWith('failed')
    expect(reads).toHaveBeenCalledTimes(1 + 10000 / 200)
  })

  test('a visibility wait gives up after its own budget', async () => {
    vi.useFakeTimers()
    const outcome = vi.fn()
    visibility.run(createStepContext({ driver }), 'icon', 'is_visible').then(
      () => outcome('passed'),
      () => outcome('failed')
    )
    await vi.advanceTimersByTimeAsync(DEFAULT_BUDGETS.visibilityMs - 1)
    expect(outcome).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(DEFAULT_BUDGETS.pollMs)
    expect(outcome).toHaveBeenCalledWith('failed')
  })
})

describe('a custom test-id attribute', () => {
  test('is used for every lookup by test id', async () => {
    context = createStepContext({ driver, budgets: SMALL, testIdAttribute: 'data-qa' })
    html('<a data-qa="link" data-testid="other">Directions</a>')
    show(el('link', 'data-qa'))
    await expect(textEquals.run(context, 'link', 'Directions')).resolves.toBeUndefined()
    await expect(elementType.run(context, 'link', 'a')).resolves.toBeUndefined()
    await clickByTestId.run(context, 'link')
    expect(driver.click).toHaveBeenCalledWith(el('link', 'data-qa'))
    await expect(textEquals.run(context, 'other', 'Directions')).rejects.toThrow()
  })

  test('defaults to data-testid', () => {
    expect(createStepContext({ driver }).testIdAttribute).toBe('data-testid')
  })
})
