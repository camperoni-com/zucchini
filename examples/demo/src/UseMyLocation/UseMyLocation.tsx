import './UseMyLocation.css'

import { useState } from 'react'

type State = { kind: 'idle' } | { kind: 'found'; latitude: number; longitude: number } | { kind: 'blocked' }

/** Asks the browser where the visitor is, and shows it, or says the visitor blocked it. */
export const UseMyLocation = () => {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const locate = () =>
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setState({ kind: 'found', latitude: coords.latitude, longitude: coords.longitude }),
      () => setState({ kind: 'blocked' })
    )
  return (
    <div className="use-my-location">
      <button type="button" data-testid="locate-button" onClick={locate}>
        Use my location
      </button>
      {state.kind === 'found' && (
        <p data-testid="location">
          {state.latitude.toFixed(2)}, {state.longitude.toFixed(2)}
        </p>
      )}
      {state.kind === 'blocked' && (
        <p data-testid="location-error" role="alert">
          Location is blocked. Allow it in the browser to use it here.
        </p>
      )}
    </div>
  )
}
