// The library's generic steps, keyed on test ids. Their wording is the old E2E steps' wording,
// character for character, so scenarios move over unchanged and a pass means what it meant before.
import {
  attributeSelector,
  byTestId,
  normalizeExpected,
  normalizeReceived,
  readUntil,
  sleep,
  testIdSelector,
  waitForHidden,
  waitForVisible,
} from './dom.ts'
import type { StepContext, StepDefinition } from './types.ts'

const readText = (context: StepContext, testId: string) => normalizeReceived(byTestId(context, testId)[0]?.textContent)

export const textContains: StepDefinition = {
  keyword: 'Then',
  wording: 'I should assert that the element with id {string} contains {string}',
  meaning: 'The text of the first element with this test id contains the value.',
  example: 'I should assert that the element with id "day-length-label" contains "Full day"',
  run: async (context, testId: string, value: string) => {
    const expected = normalizeExpected(value)
    const received = await readUntil(
      context,
      () => readText(context, testId),
      (text) => text.includes(expected)
    )
    if (!received.includes(expected)) {
      throw new Error(`Expected "${received}" to include "${expected}"`)
    }
  },
}

export const textEquals: StepDefinition = {
  keyword: 'Then',
  wording: 'I should assert that the element with id {string} has an exact value of {string}',
  meaning: 'The text of the first element with this test id is exactly the value.',
  example: 'I should assert that the element with id "ages-label" has an exact value of "5-17 years old"',
  run: async (context, testId: string, value: string) => {
    const expected = normalizeExpected(value)
    const received = await readUntil(
      context,
      () => readText(context, testId),
      (text) => text === expected
    )
    if (received !== expected) {
      throw new Error(`Expected "${received}" to equal "${expected}"`)
    }
  },
}

export const elementType: StepDefinition = {
  keyword: 'Then',
  wording: 'I should assert that the element with id {string} is of type {string}',
  meaning: 'The one element with this test id has this tag name (for example "a" or "button").',
  example: 'I should assert that the element with id "map-marker-card-directions-link" is of type "a"',
  run: async (context, testId: string, tagName: string) => {
    const found = await readUntil(
      context,
      () => byTestId(context, testId),
      (all) => all.length === 1,
      context.budgets.expectMs
    )
    if (found.length !== 1) {
      throw new Error(`Expected exactly one ${testIdSelector(context, testId)}, found ${found.length}`)
    }
    const actual = found[0].tagName.toLowerCase()
    if (actual !== tagName) {
      throw new Error(`Expected <${tagName}>, got <${actual}>`)
    }
  },
}

export const attributeValue: StepDefinition = {
  keyword: 'Then',
  wording: 'I should assert that the element with id {string} has an attribute {string} with value {string}',
  meaning: 'The one element with this test id has the attribute set to exactly the value.',
  example:
    'I should assert that the element with id "map-view-component" has an attribute "data-map-zoom" with value "6"',
  run: async (context, testId: string, attribute: string, expected: string) => {
    const read = () => {
      const all = byTestId(context, testId)
      return all.length === 1 ? all[0].getAttribute(attribute) : `<${all.length} elements>`
    }
    const received = await readUntil(context, read, (value) => value === expected, context.budgets.expectMs)
    if (received !== expected) {
      throw new Error(
        `Expected ${testIdSelector(context, testId)} ${attribute}="${expected}", got "${String(received)}"`
      )
    }
  },
}

export const visibility: StepDefinition = {
  keyword: 'Then',
  wording: 'I should assert that the {string} element {string} visible',
  meaning:
    'With "is_visible", the one element with this test id becomes visible; with "is_not_visible", none is visible.',
  example: 'I should assert that the "favorite-icon-camp-id-0" element "is_visible" visible',
  run: async (context, testId: string, state: string) => {
    const selector = testIdSelector(context, testId)
    if (state === 'is_visible') {
      const element = await waitForVisible(context, selector)
      element.scrollIntoView?.({ block: 'nearest' })
    } else if (state === 'is_not_visible') {
      await waitForHidden(context, selector)
    } else {
      throw new Error(`Invalid value for elementExist: ${state}`)
    }
  },
}

export const clickByTestId: StepDefinition = {
  keyword: 'When',
  wording: 'I click on the element with id {string}',
  meaning: 'Clicks the one element with this test id, once it is visible.',
  example: 'I click on the element with id "user-location-button"',
  run: async (context, testId: string) => {
    await context.driver.click(await waitForVisible(context, testIdSelector(context, testId)))
  },
}

export const clickByAttribute: StepDefinition = {
  keyword: 'When',
  wording: 'I click on the element which has an attribute {string} with value {string}',
  meaning: 'Clicks the one element whose attribute has exactly this value, once it is visible.',
  example: 'I click on the element which has an attribute "aria-label" with value "Zoom in"',
  run: async (context, attribute: string, value: string) => {
    await context.driver.click(await waitForVisible(context, attributeSelector(attribute, value)))
  },
}

export const hoverOrClick: StepDefinition = {
  keyword: 'When',
  wording: 'I {string} over the element with id {string}',
  meaning: 'With "hover" or "click", hovers or clicks the one element with this test id, then lets the UI settle.',
  example: 'I "hover" over the element with id "combinable-camp-id-0-label"',
  run: async (context, action: string, testId: string) => {
    const element = await waitForVisible(context, testIdSelector(context, testId))
    if (action === 'hover') {
      await context.driver.hover(element)
    } else if (action === 'click') {
      await context.driver.click(element)
    } else {
      throw new Error(`Invalid action: ${action}. Expected "hover" or "click".`)
    }
    await sleep(context.budgets.settleMs)
  },
}

export const waitSeconds: StepDefinition = {
  keyword: 'When',
  wording: 'I wait for {string} seconds',
  meaning: 'Pauses for the given number of seconds.',
  example: 'I wait for "2" seconds',
  run: async (_context, seconds: string) => {
    await sleep(Number(seconds) * 1000)
  },
}

export const setGeolocation: StepDefinition = {
  keyword: 'When',
  wording: 'I {string} geolocation and set the location to {string}, {string}',
  meaning: 'With "allow" or "deny", grants or denies the geolocation permission and sets the reported location.',
  example: 'I "allow" geolocation and set the location to "51.50", "-0.12"',
  run: async (context, permission: string, latitude: string, longitude: string) => {
    await context.driver.setGeolocation(permission, latitude, longitude)
  },
}

/** The library's steps, in catalog order. */
export const librarySteps: readonly StepDefinition[] = [
  textContains,
  textEquals,
  elementType,
  attributeValue,
  visibility,
  clickByTestId,
  clickByAttribute,
  hoverOrClick,
  waitSeconds,
  setGeolocation,
]
