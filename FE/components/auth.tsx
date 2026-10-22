import type { ReactNode } from "react"
import { Eyebrow, RevealHeading, Tag } from "./ui"

/** Centered sign-in / registration card: 520px wide, 40px corners, card gradient. */
export function AuthCard({
  eyebrow,
  title,
  badge,
  lead,
  children,
}: {
  eyebrow: string
  title: string
  badge?: string
  lead?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      aria-label={title}
      className="mx-auto flex w-full max-w-auth flex-col gap-2xl rounded-card surface-card p-2xl md:p-card"
    >
      <header className="flex flex-col gap-lg">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <Eyebrow>{eyebrow}</Eyebrow>
          {badge && <Tag>{badge}</Tag>}
        </div>
        <RevealHeading
          as="h1"
          text={title}
          className="type-display text-display-2xl text-ink"
        />
        {lead && (
          <div className="type-body text-body-sm text-ink-muted">{lead}</div>
        )}
      </header>
      {children}
    </section>
  )
}
