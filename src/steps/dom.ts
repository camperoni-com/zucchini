// DOM rules shared by the steps. They reproduce what the old Playwright steps did:
// - visible means a non-empty bounding box and not `visibility: hidden` (Playwright's definition);
// - an element a step acts on must be the only match (Playwright's strict mode);
// - text is normalized the same way on both sides before comparing;
// - assertions poll until they hold or their budget runs out.
import type { Budgets, Driver, StepContext } from './types.ts'

export const DEFAULT_TEST_ID_ATTRIBUTE = 'data-testid'

export const DEFAULT_BUDGETS: Budgets = {
  assertionMs: 10000,
  pollMs: 200,
  expectMs: 5000,
  visibilityMs: 25000,
  settleMs: 1500,
}

export const createStepContext = ({
  driver,
  testIdAttribute = DEFAULT_TEST_ID_ATTRIBUTE,
  budgets = {},
  document = globalThis.document,
}: {
  driver: Driver
  testIdAttribute?: string
  budgets?: Partial<Budgets>
  document?: Document
}): StepContext => ({ driver, testIdAttribute, budgets: { ...DEFAULT_BUDGETS, ...budgets }, document })

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** A CSS string literal, so any value can sit inside an attribute selector. */
const cssString = (value: string) => `"${value.replace(/["\\]/g, '\\$&').replace(/\n/g, '\\a ')}"`

export const attributeSelector = (attribute: string, value: string) => `[${attribute}=${cssString(value)}]`

export const testIdSelector = (context: StepContext, testId: string) =>
  attributeSelector(context.testIdAttribute, testId)

export const queryAll = (context: StepContext, selector: string) =>
  Array.from(context.document.querySelectorAll<HTMLElement>(selector))

export const byTestId = (context: StepContext, testId: string) => queryAll(context, testIdSelector(context, testId))

export const isVisible = (element: Element) => {
  const box = element.getBoundingClientRect()
  const view = element.ownerDocument.defaultView
  const visibility = view ? view.getComputedStyle(element).visibility : ''
  return box.width > 0 && box.height > 0 && visibility !== 'hidden'
}

export const normalizeReceived = (text: string | null | undefined) =>
  (text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()

// Same as the old steps: drops a literal `\r` written in the feature file, then trims.
export const normalizeExpected = (value: string) => value.replace(/\\r/g, '').replace(/\n/g, '\n').trim()

/** Reads until `ok` holds or `timeout` runs out, and returns the last value read. */
export const readUntil = async <T>(
  context: StepContext,
  read: () => T,
  ok: (value: T) => boolean,
  timeout = context.budgets.assertionMs
) => {
  const deadline = Date.now() + timeout
  let value = read()
  while (!ok(value) && Date.now() < deadline) {
    await sleep(context.budgets.pollMs)
    value = read()
  }
  return value
}

/** Waits for exactly one visible match, like Playwright's `locator.waitFor({ state: 'visible' })`. */
export const waitForVisible = async (context: StepContext, selector: string) => {
  const element = await readUntil(
    context,
    () => {
      const all = queryAll(context, selector)
      if (all.length > 1) {
        throw new Error(`strict mode violation: ${selector} resolved to ${all.length} elements`)
      }
      return all[0]
    },
    (found) => Boolean(found && isVisible(found)),
    context.budgets.visibilityMs
  )
  if (!element || !isVisible(element)) {
    throw new Error(`${selector} did not become visible`)
  }
  return element
}

/** Waits until no match is visible (absent counts), like Playwright's `state: 'hidden'`. */
export const waitForHidden = async (context: StepContext, selector: string) => {
  const hidden = await readUntil(
    context,
    () => queryAll(context, selector).every((element) => !isVisible(element)),
    (ok) => ok,
    context.budgets.visibilityMs
  )
  if (!hidden) {
    throw new Error(`${selector} is still visible`)
  }
}
