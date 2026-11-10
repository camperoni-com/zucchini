// The geolocation step's fake (browser side): it replaces the page's navigator.geolocation methods, so a
// location request gets the scenario's answer the same way in every browser.
//
// Playwright's permissions don't fit a contract run. Its stories share one page, and the browsers keep a
// permission on that page differently: WebKit still allowed after clearPermissions, and Firefox answered
// "denied" after grantPermissions. So "allow" answers with the given location and "deny" fails the way a browser
// does when the visitor blocks it, and the runner resets the fake before each scenario. What a contract
// checks is how the component handles the answer; whether a browser grants it isn't the component's.

type Answer = (success: PositionCallback, error?: PositionErrorCallback | null) => void

const METHODS = ['getCurrentPosition', 'watchPosition', 'clearWatch'] as const

const position = (latitude: number, longitude: number): GeolocationPosition => {
  const coords = {
    latitude,
    longitude,
    accuracy: 1,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  }
  const timestamp = Date.now()
  return {
    coords: { ...coords, toJSON: () => coords },
    timestamp,
    toJSON: () => ({ coords, timestamp }),
  } as GeolocationPosition
}

// The error a browser passes when the visitor blocks the request (code 1). Chrome's wording.
const denial = (): GeolocationPositionError =>
  ({
    code: 1,
    message: 'User denied Geolocation',
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  }) as GeolocationPositionError

const answerFor = (permission: string, latitude: string, longitude: string): Answer => {
  if (permission === 'allow') {
    const lat = Number(latitude)
    const lng = Number(longitude)
    if (latitude.trim() === '' || longitude.trim() === '' || Number.isNaN(lat) || Number.isNaN(lng)) {
      throw new Error(`Invalid location: "${latitude}", "${longitude}". Expected two numbers.`)
    }
    return (success) => success(position(lat, lng))
  }
  if (permission === 'deny') {
    return (_success, error) => error?.(denial())
  }
  throw new Error(`Invalid permissionType: ${permission}. Expected 'allow' or 'deny'.`)
}

export interface GeolocationFake {
  /** Answers the page's location requests from now on: "allow" with the location, "deny" with a denial. */
  set(permission: string, latitude: string, longitude: string): void
  /** Puts the browser's own methods back. */
  reset(): void
}

export const createGeolocationFake = (geolocation: Geolocation): GeolocationFake => {
  let nextWatchId = 1

  const reset = () => {
    for (const method of METHODS) {
      // Own properties shadow the prototype's methods; deleting them brings the browser's back.
      delete (geolocation as unknown as Record<string, unknown>)[method]
    }
  }

  const set = (permission: string, latitude: string, longitude: string) => {
    const answer = answerFor(permission, latitude, longitude)
    // Later, as a browser answers, never during the call.
    const later: Answer = (success, error) => {
      setTimeout(() => answer(success, error), 0)
    }
    const methods = {
      getCurrentPosition: later,
      // A watch answers once: a fixed location never moves.
      watchPosition: (success: PositionCallback, error?: PositionErrorCallback | null) => {
        later(success, error)
        return nextWatchId++
      },
      clearWatch: () => undefined,
    }
    for (const method of METHODS) {
      Object.defineProperty(geolocation, method, { value: methods[method], configurable: true, writable: true })
    }
  }

  return { set, reset }
}
