// The browsers and devices the contracts run on. Browser-safe: Storybook's preview imports the viewports below.
//
// A pickle tagged with a device's name (`@desktop`, `@mobile`, usually on an Examples block) runs only on that
// device; an untagged one runs on every device.

export const BROWSERS = ['chromium', 'firefox', 'webkit'] as const
export type Browser = (typeof BROWSERS)[number]

export type Device = 'desktop' | 'mobile'

export const DEVICES: readonly Device[] = ['desktop', 'mobile']

/** The story's size on each device: Playwright's default desktop context, and its iPhone 13 descriptor. */
export const DEVICE_VIEWPORTS: Record<Device, { width: number; height: number }> = {
  desktop: { width: 1280, height: 720 },
  mobile: { width: 390, height: 664 },
}

/** The Storybook viewport each device selects through the `viewport` global. */
export const viewportKey = (device: Device) => `livingSpec${device[0].toUpperCase()}${device.slice(1)}`

/**
 * Storybook viewport options for the devices, to merge into the preview's `parameters.viewport.options`.
 * Storybook's Vitest add-on renders every story at 1200x900 unless a `viewport` global picks one of these.
 */
export const contractViewports = Object.fromEntries(
  DEVICES.map((device) => [
    viewportKey(device),
    {
      name: `Contracts ${device}`,
      styles: { width: `${DEVICE_VIEWPORTS[device].width}px`, height: `${DEVICE_VIEWPORTS[device].height}px` },
      type: device,
    },
  ])
)

/** The label a result carries for a browser and device, such as `webkit-mobile`. */
export const browserLabel = (browser: string, device: Device) => `${browser}-${device}`

/** The Vitest project that runs the contracts on one browser and device, such as `contracts-webkit-mobile`. */
export const projectName = (browser: string, device: Device) => `contracts-${browserLabel(browser, device)}`
