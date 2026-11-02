// The step library's public types. A step is data: its keyword, its wording (a Cucumber expression),
// a one-line meaning, an example and a run function. Run functions never import a browser runner:
// they read the DOM directly and act through the injected Driver.

export type StepKeyword = 'Given' | 'When' | 'Then'

/** User and browser-context actions, implemented by whichever runner executes the steps. */
export interface Driver {
  click(element: HTMLElement): Promise<void>
  hover(element: HTMLElement): Promise<void>
  /** `permission` is "allow" or "deny"; coordinates come straight from the step text. */
  setGeolocation(permission: string, latitude: string, longitude: string): Promise<void>
}

/** How long steps poll or pause, in milliseconds. */
export interface Budgets {
  /** Text assertions keep re-reading this long (readUntil() in the old E2E steps). */
  assertionMs: number
  /** Pause between two reads while polling. */
  pollMs: number
  /** Element-type and attribute assertions (Playwright's default expect timeout). */
  expectMs: number
  /** Waiting for an element to become visible or hidden (within the old 30 s step timeout). */
  visibilityMs: number
  /** Pause after hovering or clicking over an element. */
  settleMs: number
}

export interface StepContext {
  driver: Driver
  /** The attribute that holds test ids, `data-testid` by default. */
  testIdAttribute: string
  budgets: Budgets
  /** Where elements are looked up. */
  document: Document
}

export interface StepDefinition {
  keyword: StepKeyword
  /** A Cucumber expression, matched against the step text after its keyword. */
  wording: string
  /** What the step does or checks, in one line. */
  meaning: string
  /** A real step text (without keyword) that matches `wording`. */
  example: string
  /** Receives the context, then the values of the expression's parameters in order. */
  run(context: StepContext, ...args: unknown[]): Promise<void>
}
