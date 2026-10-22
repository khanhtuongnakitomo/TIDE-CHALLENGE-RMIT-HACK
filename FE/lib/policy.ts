import type { CurrentUser, Role } from "./contracts"

/* ---------------------------------------------------------------------------
 * Central route and workspace policy. The router, sign-in redirect and
 * navigation all read from here; the adapter re-checks every data call.
 * ------------------------------------------------------------------------- */

export const SESSION_REQUIRED_MESSAGE =
  "SESSION_REQUIRED: Please sign in to access this workspace."

/** Title-case role names for the session pill and persona buttons. */
export const ROLE_TITLE: Record<Role, string> = {
  PARTICIPANT: "Participant",
  RESEARCH_ASSISTANT: "Research Assistant",
  HEAD_RESEARCHER: "Head Researcher",
  DATA_STEWARD: "Data Steward",
  ETHICS_REPRESENTATIVE: "Ethics Representative",
}

export const ROLE_DEFAULT_ROUTE: Record<Role, string> = {
  PARTICIPANT: "/user",
  RESEARCH_ASSISTANT: "/researcher",
  HEAD_RESEARCHER: "/governance",
  DATA_STEWARD: "/governance",
  ETHICS_REPRESENTATIVE: "/governance",
}

const RESEARCH_ROLES: Role[] = ["RESEARCH_ASSISTANT", "HEAD_RESEARCHER"]
const GOVERNANCE_ROLES: Role[] = [
  "HEAD_RESEARCHER",
  "DATA_STEWARD",
  "ETHICS_REPRESENTATIVE",
]
/** Evidence log: staff and governance roles; participants never see others' activity. */
export const EVIDENCE_ROLES: Role[] = [
  "RESEARCH_ASSISTANT",
  "HEAD_RESEARCHER",
  "DATA_STEWARD",
  "ETHICS_REPRESENTATIVE",
]

export const canViewEvidence = (role: Role) => EVIDENCE_ROLES.includes(role)

export interface RoutePolicy {
  id: "user" | "researcher" | "permissions" | "governance" | "evidence"
  label: string
  pattern: RegExp
  roles: Role[]
}

export const ROUTE_POLICIES: RoutePolicy[] = [
  {
    id: "user",
    label: "Participant workspace",
    pattern: /^\/user\/?$/,
    roles: ["PARTICIPANT"],
  },
  {
    id: "permissions",
    label: "Study permissions",
    pattern: /^\/researcher\/studies\/[^/]+\/permissions\/?$/,
    roles: RESEARCH_ROLES,
  },
  {
    id: "researcher",
    label: "Researcher workspace",
    pattern: /^\/researcher\/?$/,
    roles: RESEARCH_ROLES,
  },
  {
    id: "governance",
    label: "Governance",
    pattern: /^\/governance\/?$/,
    roles: GOVERNANCE_ROLES,
  },
  {
    id: "evidence",
    label: "Evidence log",
    pattern: /^\/evidence\/?$/,
    roles: EVIDENCE_ROLES,
  },
]

export function matchRoutePolicy(pathname: string): RoutePolicy | null {
  return ROUTE_POLICIES.find((p) => p.pattern.test(pathname)) ?? null
}

/** Any path under a protected prefix is protected, even if it 404s. */
export function isProtectedPath(pathname: string) {
  return /^\/(user|researcher|governance|evidence)(\/|$)/.test(pathname)
}

export type Authorization =
  | { allowed: true }
  | { allowed: false; requirement: string }

const roleList = (roles: Role[]) =>
  roles.map((r) => r.replace(/_/g, " ").toLowerCase()).join(", ")

export function authorize(role: Role, pathname: string): Authorization {
  const policy = matchRoutePolicy(pathname)
  if (!policy) return { allowed: true }
  if (policy.roles.includes(role)) return { allowed: true }
  return {
    allowed: false,
    requirement: `${policy.label} requires one of: ${roleList(policy.roles)}.`,
  }
}

export interface NavItem {
  to: string
  label: string
}

/** Workspace navigation visible to a role. */
export function navFor(role: Role): NavItem[] {
  const items: NavItem[] = []
  if (role === "PARTICIPANT") items.push({ to: "/user", label: "My data" })
  if (RESEARCH_ROLES.includes(role))
    items.push({ to: "/researcher", label: "Researcher" })
  if (GOVERNANCE_ROLES.includes(role))
    items.push({ to: "/governance", label: "Governance" })
  if (canViewEvidence(role)) items.push({ to: "/evidence", label: "Evidence" })
  return items
}

const AUTH_PAGES = /^\/(login|register)(\/|$)/

/**
 * Returns an internal path from an untrusted `next` value, or null.
 * Rejects absolute and protocol-relative URLs, backslash tricks, control
 * characters and the auth pages themselves.
 */
export function safeInternalPath(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 512) return null
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\"))
    return null
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null
  try {
    const base = "https://researchvault.internal"
    const url = new URL(raw, base)
    if (url.origin !== base) return null
    if (AUTH_PAGES.test(url.pathname)) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

/** Where to land after sign-in: a validated, authorized `next`, else the role default. */
export function destinationAfterSignIn(
  user: Pick<CurrentUser, "role">,
  next: string | null | undefined,
) {
  const safe = safeInternalPath(next)
  if (safe && authorize(user.role, new URL(safe, "https://x.invalid").pathname).allowed)
    return safe
  return ROLE_DEFAULT_ROUTE[user.role]
}

export function loginPathFor(next: string) {
  const safe = safeInternalPath(next)
  return safe ? `/login?next=${encodeURIComponent(safe)}` : "/login"
}
