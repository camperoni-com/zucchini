// The deliberate breaks for `npm run mutation` (experimental). Each changes the first occurrence of `find` in
// its file, runs the contracts, and expects them to fail:
//  * a contract break makes a contract expect something the component doesn't do. That scenario (or Examples
//    row) must fail: the steps really check what they claim.
//  * a code break puts a realistic bug in a component. The contracts it names must fail somewhere: they would
//    catch that regression.
import type { Break } from '@camperoni/zucchini'

export const breaks: Break[] = [
  // Badge
  {
    name: 'contract-badge-count',
    checks: 'the exact-value check reads the count',
    file: 'src/Badge/Badge.feature',
    find: 'has an exact value of "3"',
    replace: 'has an exact value of "4"',
  },
  {
    name: 'code-badge-default-tone',
    checks: 'a badge with no tone defaults to the wrong colour',
    file: 'src/Badge/Badge.tsx',
    find: "tone = 'neutral'",
    replace: "tone = 'success'",
    contracts: ['src/Badge/Badge.feature'],
  },
  {
    name: 'code-badge-link-not-a-link',
    checks: 'a badge with a link renders as plain text',
    file: 'src/Badge/Badge.tsx',
    find: 'return href ? (',
    replace: 'return false ? (',
    contracts: ['src/Badge/Badge.feature'],
  },

  // Disclosure
  {
    name: 'contract-disclosure-starts-expanded',
    checks: 'the attribute check reads aria-expanded',
    file: 'src/Disclosure/Disclosure.feature',
    find: 'with value "false"',
    replace: 'with value "true"',
  },
  {
    name: 'code-disclosure-never-closes',
    checks: 'a second click leaves the panel open',
    file: 'src/Disclosure/Disclosure.tsx',
    find: 'onClick={() => setOpen(!open)}',
    replace: 'onClick={() => setOpen(true)}',
    contracts: ['src/Disclosure/Disclosure.feature'],
  },

  // Tooltip
  {
    name: 'contract-tooltip-text',
    checks: 'the contains check reads the tip',
    file: 'src/Tooltip/Tooltip.feature',
    find: 'contains "Chromium, Firefox and WebKit"',
    replace: 'contains "Chromium and Firefox"',
  },
  {
    name: 'code-tooltip-sticks',
    checks: 'the tip stays after the pointer leaves (desktop)',
    file: 'src/Tooltip/Tooltip.tsx',
    find: 'onMouseLeave={() => setOpen(false)}',
    replace: 'onMouseLeave={() => undefined}',
    contracts: ['src/Tooltip/Tooltip.feature'],
  },
  // A known blind spot, found by this check: a tip that opens only on hover still passes the mobile scenario,
  // because Playwright's mobile emulation sends mouse events with a tap. The contract can't tell a tap from a
  // hover, so no break here claims it can.

  // UseMyLocation
  {
    name: 'contract-location-rounding',
    checks: 'the exact-value check reads the shown location',
    file: 'src/UseMyLocation/UseMyLocation.feature',
    find: '| 51.50, -0.12   |',
    replace: '| 51.5, -0.12    |',
  },
  {
    name: 'code-location-one-decimal',
    checks: 'the latitude is rounded to one decimal',
    file: 'src/UseMyLocation/UseMyLocation.tsx',
    find: 'state.latitude.toFixed(2)',
    replace: 'state.latitude.toFixed(1)',
    contracts: ['src/UseMyLocation/UseMyLocation.feature'],
  },
  {
    name: 'code-location-blocked-silently',
    checks: 'a blocked request shows nothing',
    file: 'src/UseMyLocation/UseMyLocation.tsx',
    find: "() => setState({ kind: 'blocked' })",
    replace: '() => undefined',
    contracts: ['src/UseMyLocation/UseMyLocation.feature'],
  },
]
