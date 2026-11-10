import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { createGeolocationFake } from './geolocation.ts'

// Stands in for the browser's Geolocation object: its methods live on the prototype, as the browser's do.
class BrowserGeolocation {
  getCurrentPosition() {
    throw new Error('the real getCurrentPosition ran')
  }

  watchPosition(): number {
    throw new Error('the real watchPosition ran')
  }

  clearWatch() {
    throw new Error('the real clearWatch ran')
  }
}

const setup = () => {
  const geolocation = new BrowserGeolocation() as unknown as Geolocation
  const fake = createGeolocationFake(geolocation)
  const success = vi.fn<PositionCallback>()
  const error = vi.fn<PositionErrorCallback>()
  return { geolocation, fake, success, error }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('allow', () => {
  test("the page's location request gets the given location", async () => {
    const { geolocation, fake, success, error } = setup()
    fake.set('allow', '51.50', '-0.12')
    geolocation.getCurrentPosition(success, error)
    await vi.runAllTimersAsync()
    expect(error).not.toHaveBeenCalled()
    expect(success).toHaveBeenCalledTimes(1)
    expect(success.mock.calls[0][0].coords).toMatchObject({ latitude: 51.5, longitude: -0.12 })
  })

  test('answers later, as a browser does, not during the call', async () => {
    const { geolocation, fake, success } = setup()
    fake.set('allow', '51.50', '-0.12')
    geolocation.getCurrentPosition(success)
    expect(success).not.toHaveBeenCalled()
    await vi.runAllTimersAsync()
    expect(success).toHaveBeenCalledTimes(1)
  })

  test('a watch gets the location too, and can be cleared', async () => {
    const { geolocation, fake, success } = setup()
    fake.set('allow', '24.57', '-78.18')
    const id = geolocation.watchPosition(success)
    await vi.runAllTimersAsync()
    expect(success.mock.calls[0][0].coords).toMatchObject({ latitude: 24.57, longitude: -78.18 })
    expect(() => geolocation.clearWatch(id)).not.toThrow()
  })

  test('refuses a location that is not a number', () => {
    const { fake } = setup()
    expect(() => fake.set('allow', 'north', '-0.12')).toThrow('"north", "-0.12"')
  })
})

describe('deny', () => {
  test("the page's location request fails as when the visitor blocks it", async () => {
    const { geolocation, fake, success, error } = setup()
    fake.set('deny', '', '')
    geolocation.getCurrentPosition(success, error)
    await vi.runAllTimersAsync()
    expect(success).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledTimes(1)
    const denial = error.mock.calls[0][0]
    expect(denial.code).toBe(1)
    expect(denial.code).toBe(denial.PERMISSION_DENIED)
  })

  test('replaces an earlier allow on the same page', async () => {
    const { geolocation, fake, success, error } = setup()
    fake.set('allow', '24.57', '-78.18')
    fake.set('deny', '', '')
    geolocation.getCurrentPosition(success, error)
    await vi.runAllTimersAsync()
    expect(success).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledTimes(1)
  })

  test('a watch fails too', async () => {
    const { geolocation, fake, success, error } = setup()
    fake.set('deny', '', '')
    geolocation.watchPosition(success, error)
    await vi.runAllTimersAsync()
    expect(success).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledTimes(1)
  })
})

describe('reset', () => {
  test("puts the browser's own methods back", () => {
    const { geolocation, fake, success } = setup()
    fake.set('allow', '51.50', '-0.12')
    fake.reset()
    expect(() => geolocation.getCurrentPosition(success)).toThrow('the real getCurrentPosition ran')
    expect(() => geolocation.watchPosition(success)).toThrow('the real watchPosition ran')
    expect(() => geolocation.clearWatch(1)).toThrow('the real clearWatch ran')
  })

  test('does nothing when nothing was set', () => {
    const { geolocation, fake, success } = setup()
    expect(() => fake.reset()).not.toThrow()
    expect(() => geolocation.getCurrentPosition(success)).toThrow('the real getCurrentPosition ran')
  })
})

test('refuses a permission other than allow or deny', () => {
  const { fake } = setup()
  expect(() => fake.set('maybe', '', '')).toThrow("Invalid permissionType: maybe. Expected 'allow' or 'deny'.")
})
