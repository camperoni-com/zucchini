import './Badge.css'

export interface BadgeProps {
  /** What the badge says. */
  label: string
  /** The colour, by meaning. */
  tone?: 'neutral' | 'success' | 'warning'
  /** A number shown after the label, such as unread items. */
  count?: number
  /** Makes the whole badge a link. */
  href?: string
}

/** A small status pill. With `href`, it's a link. */
export const Badge = ({ label, tone = 'neutral', count, href }: BadgeProps) => {
  const content = (
    <>
      <span data-testid="badge-label">{label}</span>
      {count !== undefined && <span data-testid="badge-count">{count}</span>}
    </>
  )
  return href ? (
    <a data-testid="badge" className={`badge badge-${tone}`} data-tone={tone} href={href}>
      {content}
    </a>
  ) : (
    <span data-testid="badge" className={`badge badge-${tone}`} data-tone={tone}>
      {content}
    </span>
  )
}
