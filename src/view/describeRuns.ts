// Where a scenario ran, in words for the living spec. Browser-safe: no imports.

const BROWSER_NAMES: Record<string, string> = { chromium: 'Chromium', firefox: 'Firefox', webkit: 'WebKit' }
const DEVICE_ORDER = ['desktop', 'mobile']

const and = (items: readonly string[]) =>
  items.length < 2 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`

/**
 * Every browser on every device reads as "Chromium and WebKit, desktop and mobile". Any other mix, or labels
 * of a project's own, are listed as they are.
 */
export const describeRuns = (labels: readonly string[]) => {
  const parsed = labels.map((label) => /^(chromium|firefox|webkit)-(desktop|mobile)$/.exec(label))
  if (!labels.length || parsed.some((match) => !match)) {
    return and(labels)
  }
  const browsers = [...new Set(parsed.map((match) => match![1]))].sort()
  const devices = DEVICE_ORDER.filter((device) => parsed.some((match) => match![2] === device))
  if (browsers.length * devices.length !== new Set(labels).size) {
    return and(labels)
  }
  return `${and(browsers.map((browser) => BROWSER_NAMES[browser]))}, ${and(devices)}`
}
