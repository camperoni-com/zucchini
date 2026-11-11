import './Tooltip.css'

import { type ReactNode, useId, useState } from 'react'

export interface TooltipProps {
  /** The tip's text. */
  text: string
  /** What the tip is about. */
  children: ReactNode
}

/** A tip that shows while the pointer is over its trigger, or after a tap on touch screens. */
export const Tooltip = ({ text, children }: TooltipProps) => {
  const [open, setOpen] = useState(false)
  const tipId = useId()
  return (
    <span className="tooltip">
      <button
        type="button"
        data-testid="tooltip-trigger"
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        // A tap opens it: a touch screen has no hover. (A tap also moves the pointer here, so toggling would
        // close it again at once.)
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      {open && (
        <span id={tipId} role="tooltip" data-testid="tooltip">
          {text}
        </span>
      )}
    </span>
  )
}
