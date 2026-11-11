import './Disclosure.css'

import { type ReactNode, useId, useState } from 'react'

export interface DisclosureProps {
  /** The always-visible button text. */
  summary: string
  /** What opens and closes. */
  children: ReactNode
  /** Starts open. */
  defaultOpen?: boolean
}

/** A button that shows and hides a panel below it. */
export const Disclosure = ({ summary, children, defaultOpen = false }: DisclosureProps) => {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()
  return (
    <div className="disclosure">
      <button
        type="button"
        data-testid="disclosure-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        {summary}
      </button>
      <div id={panelId} data-testid="disclosure-panel" hidden={!open}>
        {children}
      </div>
    </div>
  )
}
