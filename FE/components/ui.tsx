import {
  Fragment,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react"
import { Link, type LinkProps } from "react-router"
import { Button as KitButton, cn } from "./kit"
import {
  ArrowUpRight,
  BadgeCheck,
  Ban,
  CircleDot,
  Clock,
  CloudOff,
  KeyRound,
  LoaderCircle,
  Lock,
  LockOpen,
  ServerCrash,
  ShieldAlert,
  Stamp,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react"
import type {
  AccessRequestStatus,
  ApiError,
  ClearanceLevel,
  DataCategory,
  RecordAccess,
} from "@/lib/contracts"

/* ---------------------------------------------------------------------------
 * Buttons — kit Button / router Link skinned with the rv-btn pills from
 * styles/global.css. Labels use the .rv-slot viewport: both layers share one
 * clipped grid cell, so only one label is ever visible.
 * ------------------------------------------------------------------------- */

/**
 * primary = Ember gradient, ink = Titanium inverse, outline = seam outline,
 * surface = carbon pill (Ember on hover), obsidian = black pill for ember-framed cards.
 */
type ButtonVariant = "primary" | "ink" | "outline" | "surface" | "obsidian"
type ButtonSize = "md" | "sm"

const buttonSkins: Record<ButtonVariant, string> = {
  primary: "rv-btn--primary",
  ink: "rv-btn--ink",
  outline: "rv-btn--secondary",
  surface: "rv-btn--surface",
  obsidian: "rv-btn--obsidian",
}

interface ButtonLookProps {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: LucideIcon
  iconEnd?: LucideIcon
  loading?: boolean
  children: ReactNode
  className?: string
}

function buttonClass(
  variant: ButtonVariant,
  size: ButtonSize,
  className?: string,
) {
  return cn(
    "rv-btn shrink-0 whitespace-nowrap",
    buttonSkins[variant],
    size === "sm" && "rv-btn--sm",
    className,
  )
}

function SlotLabel({
  icon: Icon,
  iconEnd: IconEnd,
  loading,
  size = "md",
  children,
}: Omit<ButtonLookProps, "variant" | "className">) {
  const iconClass = size === "sm" ? "size-4" : "size-5"
  const layer = (
    <>
      {loading ? (
        <LoaderCircle className={cn(iconClass, "rv-spin")} aria-hidden />
      ) : (
        Icon && <Icon className={iconClass} aria-hidden />
      )}
      {children}
      {IconEnd && <IconEnd className={iconClass} aria-hidden />}
    </>
  )
  return (
    <span className="rv-slot">
      <span>{layer}</span>
      <span aria-hidden>{layer}</span>
    </span>
  )
}

export function Button({
  variant = "ink",
  size = "md",
  icon,
  iconEnd,
  loading,
  children,
  className,
  disabled,
  ...rest
}: ButtonLookProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <KitButton
      type="button"
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <SlotLabel icon={icon} iconEnd={iconEnd} loading={loading} size={size}>
        {children}
      </SlotLabel>
    </KitButton>
  )
}

export function ButtonLink({
  variant = "ink",
  size = "md",
  icon,
  iconEnd,
  children,
  className,
  ...rest
}: ButtonLookProps & Omit<LinkProps, "children" | "className">) {
  return (
    <Link
      className={cn(
        "inline-flex items-center justify-center",
        buttonClass(variant, size, className),
      )}
      {...rest}
    >
      <SlotLabel icon={icon} iconEnd={iconEnd} size={size}>
        {children}
      </SlotLabel>
    </Link>
  )
}

/* ---------------------------------------------------------------------------
 * CalderaPillButton — the public pill API for workspace actions.
 * Built on Button, so it shares the double-layer slot roll: both label layers
 * occupy one clipped grid cell (no height change, never two visible lines) and
 * the duplicate layer plus the arrow are aria-hidden.
 * ------------------------------------------------------------------------- */

type PillVariant = "primary" | "secondary" | "dark"

export interface PillButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "type"> {
  /** Trailing arrow; on by default. */
  /** Kept for call-site compatibility: every surface is dark, so it no longer changes the skin. */
  label: string
  variant?: PillVariant
  size?: ButtonSize
  icon?: LucideIcon
  arrow?: boolean
  loading?: boolean
  onDark?: boolean
  type?: "button" | "submit" | "reset"
}

const PILL_SKIN: Record<PillVariant, ButtonVariant> = {
  primary: "primary",
  secondary: "outline",
  dark: "ink",
}

export function CalderaPillButton({
  label,
  variant = "primary",
  arrow = true,
  onDark: _onDark,
  ...rest
}: PillButtonProps) {
  return (
    <Button
      variant={PILL_SKIN[variant]}
      iconEnd={arrow ? ArrowUpRight : undefined}
      {...rest}
    >
      {label}
    </Button>
  )
}

/* ---------------------------------------------------------------------------
 * Surfaces
 * ------------------------------------------------------------------------- */

/**
 * card = standard gradient card, elevated = featured/emphasis card,
 * breach = alert gradient, quantum = violet (highly restricted context),
 * halftone = Halftone Matrix feature card, accent = solid Ember (stat cards),
 * frame = dark card with an Ember frame, outline = transparent with a technical seam.
 */
type Surface = "card" | "elevated" | "breach" | "quantum" | "halftone" | "accent" | "frame" | "outline"

const surfaces: Record<Surface, string> = {
  card: "surface-card",
  elevated: "surface-elevated",
  breach: "surface-breach",
  quantum: "surface-quantum",
  halftone: "halftone",
  accent: "surface-accent",
  frame: "surface-frame",
  outline: "rule-solid bg-transparent text-ink",
}

/**
 * Main content card: 40px corners and padding from --radius-card / --spacing-card.
 * `lift` adds the shadowless hover/focus-within displacement — use it only on
 * cards that hold their own actions.
 */
export function Card({
  surface = "card",
  lift,
  className,
  children,
  as: Tag = "section",
  ...rest
}: {
  surface?: Surface
  lift?: boolean
  className?: string
  children: ReactNode
  as?: "section" | "div" | "article" | "aside"
} & HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={cn(
        "min-w-0 rounded-card p-2xl md:p-card",
        surfaces[surface],
        lift && "lift",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/* ---------------------------------------------------------------------------
 * Type helpers
 * ------------------------------------------------------------------------- */

/**
 * Character-rise reveal. Words are separate clipped spans joined by real
 * space text nodes, so word spacing and natural wrapping are preserved.
 * The heading's accessible name is the plain string (aria-label); the
 * animated glyphs are aria-hidden so text appears once in DOM text. `highlight` names a trailing phrase
 * drawn with the plasma gradient; it rises as one unit so the gradient is
 * clipped to its own glyphs and keeps its internal spaces.
 */
export function RevealHeading({
  text,
  highlight,
  as: Tag = "h1",
  className,
}: {
  text: string
  highlight?: string
  as?: "h1" | "h2" | "h3"
  className?: string
}) {
  const tail = highlight && text.endsWith(highlight) ? highlight : undefined
  const head = tail ? text.slice(0, -tail.length).trimEnd() : text
  const words = head ? head.split(" ") : []
  let index = 0
  return (
    <Tag className={className} aria-label={text}>
      <span aria-hidden>
        {words.map((word, w) => (
          <Fragment key={w}>
            <span className="rv-reveal-word">
              {Array.from(word).map((char, c) => (
                <span
                  key={c}
                  className="rv-reveal-char"
                  style={{ "--i": index++ } as CSSProperties}
                >
                  {char}
                </span>
              ))}
            </span>
            {(w < words.length - 1 || tail) && " "}
          </Fragment>
        ))}
        {tail && (
          <span className="rv-reveal-word">
            <span
              className="rv-reveal-char text-plasma"
              style={{ "--i": index } as CSSProperties}
            >
              {tail}
            </span>
          </span>
        )}
      </span>
    </Tag>
  )
}

/** Workspace page header: eyebrow, revealed display heading, badge, lead copy. */
export function PageHeader({
  eyebrow,
  title,
  badge,
  actions,
  children,
}: {
  eyebrow?: ReactNode
  title: string
  badge?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="flex w-full min-w-0 flex-col gap-xl">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <div className="flex flex-wrap items-end justify-between gap-x-2xl gap-y-xl">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2xl gap-y-lg">
          <RevealHeading
            text={title}
            className="type-display text-display-2xl text-ink"
          />
          {badge}
        </div>
        {actions && <div className="flex flex-wrap gap-md">{actions}</div>}
      </div>
      {children && (
        <div className="w-full max-w-prose type-body text-body-lg break-words">
          {children}
        </div>
      )}
    </header>
  )
}

const HEADING_SIZE = {
  lg: "text-display-lg",
  md: "text-display-md",
  sm: "text-display-sm",
} as const

/** Section heading in the display face; sizes map to --text-display-* tokens. */
export function Heading({
  as: Tag = "h2",
  size = "md",
  id,
  className,
  children,
}: {
  as?: "h1" | "h2" | "h3" | "h4"
  size?: keyof typeof HEADING_SIZE
  id?: string
  className?: string
  children: ReactNode
}) {
  return (
    <Tag
      id={id}
      className={cn("type-display break-words", HEADING_SIZE[size], className)}
    >
      {children}
    </Tag>
  )
}

export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <p className={cn("type-eyebrow", className)}>{children}</p>
}

export function Mono({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  // break-words (not break-all): long IDs wrap only when they would overflow,
  // so they never lower a flex/grid parent's min-content width to one glyph.
  return (
    <code className={cn("type-id break-words", className)}>{children}</code>
  )
}

/** Pill badge: ember wash by default, Neon Sulfur for metadata / prototype markers. */
export function Tag({
  children,
  className,
  tone = "accent",
}: {
  children: ReactNode
  className?: string
  tone?: "accent" | "sulfur"
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-md rounded-pill px-lg py-xs type-eyebrow",
        tone === "sulfur" ? "badge-sulfur" : "bg-accent-wash text-accent",
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ---------------------------------------------------------------------------
 * Geometric tier glyphs — meaning never rests on color alone.
 * ------------------------------------------------------------------------- */

export const TIER_LABEL: Record<ClearanceLevel, string> = {
  1: "STUDY METADATA",
  2: "INTERNAL",
  3: "RESTRICTED",
  4: "HIGHLY RESTRICTED",
}

/**
 * Display codes — presentation only. Payload tiers are numbered L1–L3 for
 * people (Internal, Restricted, Highly Restricted); study metadata sits
 * outside the payload tiers. ClearanceLevel values are unchanged.
 * "L4 · QEA QUORUM" is governance terminology (QUORUM_TERM), never a tier.
 */
export const TIER_CODE: Record<ClearanceLevel, string> = {
  1: "META",
  2: "L1",
  3: "L2",
  4: "L3",
}

/** "L2 · RESTRICTED", "META · STUDY METADATA". */
export function tierName(level: ClearanceLevel) {
  return `${TIER_CODE[level]} · ${TIER_LABEL[level]}`
}

export const QUORUM_TERM = "L4 · QEA QUORUM"

/** Tier colour reinforces shape + label: sulfur, ember, violet; metadata stays muted. */
export const TIER_TONE: Record<ClearanceLevel, string> = {
  1: "text-tier-metadata",
  2: "text-tier-internal",
  3: "text-tier-restricted",
  4: "text-tier-highly-ink",
}

export const CATEGORY_LABEL: Record<DataCategory, string> = {
  INTERNAL: "INTERNAL",
  RESTRICTED: "RESTRICTED",
  HIGHLY_RESTRICTED: "HIGHLY RESTRICTED",
}

export const LEVEL_OF: Record<DataCategory, ClearanceLevel> = {
  INTERNAL: 2,
  RESTRICTED: 3,
  HIGHLY_RESTRICTED: 4,
}

/** Metadata triangle outline, Internal circle, Restricted square, Highly Restricted filled hexagon. */
export function TierGlyph({
  level,
  className,
}: {
  level: ClearanceLevel
  className?: string
}) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.5 }
  return (
    <svg viewBox="0 0 16 16" className={cn("size-5", className)} aria-hidden>
      {level === 1 && (
        <path d="M8 2.5 14 13.5H2Z" {...common} strokeLinejoin="round" />
      )}
      {level === 2 && <circle cx="8" cy="8" r="5.5" {...common} />}
      {level === 3 && (
        <rect
          x="2.75"
          y="2.75"
          width="10.5"
          height="10.5"
          rx="1"
          fill="currentColor"
        />
      )}
      {level === 4 && (
        <path
          d="M8 1.5 13.6 4.75v6.5L8 14.5l-5.6-3.25v-6.5Z"
          fill="currentColor"
        />
      )}
    </svg>
  )
}

/** Internal sulfur outline, Restricted ember gradient, Highly Restricted violet outline. */
const CATEGORY_SKIN: Record<DataCategory, string> = {
  INTERNAL: "border-tier-internal text-tier-internal",
  RESTRICTED: "surface-breach border-transparent",
  HIGHLY_RESTRICTED: "border-tier-highly text-tier-highly-ink",
}

export function CategoryBadge({
  category,
  className,
}: {
  category: DataCategory
  className?: string
}) {
  const level = LEVEL_OF[category]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-md rounded-pill rule-solid px-lg py-xs type-caption uppercase tracking-label",
        CATEGORY_SKIN[category],
        className,
      )}
    >
      <TierGlyph level={level} className="size-4 shrink-0" />
      <span>
        {TIER_CODE[level]} · {CATEGORY_LABEL[category]}
      </span>
    </span>
  )
}

/* ---------------------------------------------------------------------------
 * Status pills
 * ------------------------------------------------------------------------- */

type StatusKey = RecordAccess | AccessRequestStatus | "LOCKED"

const STATUS: Record<StatusKey, {
  icon: LucideIcon
  className: string
  label: string
}> = {
  UNLOCKED: {
    icon: LockOpen,
    className: "bg-granted text-on-accent border-granted",
    label: "UNLOCKED",
  },
  LOCKED: {
    icon: Lock,
    className: "bg-inset text-ink border-outline",
    label: "LOCKED",
  },
  COMPARTMENTALIZED: {
    icon: Ban,
    className: "bg-transparent text-ink-muted border-outline border-dashed",
    label: "LOCKED (COMPARTMENTALIZED)",
  },
  REQUESTED: {
    icon: CircleDot,
    className: "bg-transparent text-ink border-outline",
    label: "REQUESTED",
  },
  PENDING_GOVERNANCE: {
    icon: Clock,
    className: "bg-accent-wash text-accent border-accent border-dashed",
    label: "PENDING_GOVERNANCE",
  },
  COMMITTED: {
    icon: Stamp,
    className: "bg-accent text-on-accent border-accent",
    label: "COMMITTED",
  },
  ACTIVE: {
    icon: BadgeCheck,
    className: "bg-granted text-on-accent border-granted",
    label: "ACTIVE",
  },
}

export function StatusPill({
  status,
  detail,
  className,
}: {
  status: StatusKey
  detail?: string
  className?: string
}) {
  const s = STATUS[status]
  const Icon = s.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-md rounded-pill rule-solid px-lg py-xs type-caption uppercase tracking-label whitespace-nowrap",
        s.className,
        className,
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {s.label}
      {detail && <span>{detail}</span>}
    </span>
  )
}

/* ---------------------------------------------------------------------------
 * Error surfaces
 * ------------------------------------------------------------------------- */

const ERROR_ICON: Record<number, LucideIcon> = {
  401: KeyRound,
  403: ShieldAlert,
  404: TriangleAlert,
  409: TriangleAlert,
  422: TriangleAlert,
  502: ServerCrash,
  503: CloudOff,
}

export function ErrorCode({
  error,
  className,
}: {
  error: Pick<ApiError, "status" | "code">
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-md rounded-pill rule-solid bg-canvas px-lg py-xs type-id text-ink whitespace-nowrap",
        className,
      )}
    >
      {error.status} {error.code}
    </span>
  )
}

/** Inline notice for API failures. Provider failures (5xx) use the breach gradient surface. */
export function ErrorNotice({
  error,
  title,
  children,
  className,
}: {
  error: ApiError
  title?: string
  children?: ReactNode
  className?: string
}) {
  const Icon = ERROR_ICON[error.status] ?? TriangleAlert
  const provider = error.status >= 500
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-lg rounded-inset p-5 sm:flex-row sm:items-start",
        provider
          ? "surface-breach"
          : error.status === 409
            ? "rule-solid border-accent bg-accent-wash text-ink"
            : "surface-inset border-outline",
        className,
      )}
    >
      <Icon className="size-6 shrink-0 mt-0.5" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-md">
        <div className="flex flex-wrap items-center gap-md">
          <ErrorCode error={error} />
          {title && <span className="type-body">{title}</span>}
        </div>
        <p className="type-body text-body-sm">{error.message}</p>
        <p className="type-caption opacity-80">
          Correlation <Mono>{error.correlationId}</Mono>
        </p>
        {children && (
          <div className="flex flex-wrap gap-md pt-xs">{children}</div>
        )}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Misc
 * ------------------------------------------------------------------------- */

/** Quorum pips: filled squares for verified approvals, outlined for outstanding. */
export function QuorumPips({
  count,
  required,
  className,
}: {
  count: number
  required: number
  className?: string
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-xs", className)}
      aria-hidden
    >
      {Array.from({ length: required }, (_, i) => (
        <span
          key={i}
          className={cn(
            "size-3 rounded-xs rule-solid border-current",
            i < count ? "bg-current" : "bg-transparent",
          )}
        />
      ))}
    </span>
  )
}

export function Spinner({
  label,
  className,
}: {
  label: string
  className?: string
}) {
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-md type-body text-body-sm",
        className,
      )}
    >
      <LoaderCircle className="size-5 rv-spin" aria-hidden />
      {label}
    </span>
  )
}

export function Emblem({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8 shrink-0", className)}
      aria-hidden
    >
      <rect width="32" height="32" rx="10" fill="var(--color-accent)" />
      <rect
        x="7"
        y="8"
        width="18"
        height="3.5"
        rx="1.75"
        fill="var(--color-on-accent)"
      />
      <rect
        x="9.5"
        y="14.25"
        width="13"
        height="3.5"
        rx="1.75"
        fill="var(--color-on-accent)"
      />
      <rect
        x="12.5"
        y="20.5"
        width="7"
        height="3.5"
        rx="1.75"
        fill="var(--color-on-accent)"
      />
    </svg>
  )
}

export function DefinitionRows({
  rows,
  className,
  /** Kept for call-site compatibility; all surfaces share one dark rule colour. */
}: {
  rows: { term: string; value: ReactNode }[]
  className?: string
  onDark?: boolean
}) {
  return (
    <dl className={cn("@container flex w-full min-w-0 flex-col", className)}>
      {rows.map((r) => (
        <div
          key={r.term}
          className={cn(
            "flex flex-col gap-xs py-lg last:border-b-0 @md:flex-row @md:items-baseline @md:gap-xl",
            "rule-dotted-b",
          )}
        >
          <dt className="type-caption uppercase tracking-label text-ink-muted @md:w-36 @md:shrink-0">
            {r.term}
          </dt>
          <dd className="min-w-0 flex-1 type-body text-body-sm break-words">
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
