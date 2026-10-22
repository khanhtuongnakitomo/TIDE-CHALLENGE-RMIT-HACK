import { useEffect, type ReactNode } from "react"
import { Navigate, Outlet, useLocation } from "react-router"
import { ArrowUpRight, LogIn } from "lucide-react"
import type { ApiError, Role } from "@/lib/contracts"
import { useSession } from "@/app/session"
import { vault } from "@/lib/fixtureAdapter"
import {
  ROLE_DEFAULT_ROUTE,
  authorize,
  loginPathFor,
  matchRoutePolicy,
} from "@/lib/policy"
import { ButtonLink, Card, ErrorNotice, Eyebrow, Heading, Mono } from "./ui"

const gateCor = (path: string, suffix: string) =>
  `cor-gate${path.replace(/[^a-z0-9]+/gi, "-")}-${suffix}`.slice(0, 40)

const workspaceLabel = (role: Role) =>
  matchRoutePolicy(ROLE_DEFAULT_ROUTE[role])?.label ?? "your workspace"

/** Sends a signed-out visitor to /login, remembering where they were going. */
function ToLogin() {
  const { pathname, search, hash } = useLocation()
  const { lastEnd } = useSession()
  return (
    <Navigate
      to={loginPathFor(`${pathname}${search}${hash}`)}
      replace
      state={{ notice: lastEnd === "EXPIRED" ? "SESSION_EXPIRED" : "SESSION_REQUIRED" }}
    />
  )
}

/** 403 surface: the signed-in role may not open this workspace. */
export function AccessDenied({
  workspace,
  requirement,
}: {
  workspace: string
  requirement: string
}) {
  const { user } = useSession()
  const { pathname } = useLocation()
  if (!user) return null
  const error: ApiError = {
    status: 403,
    code: "ACCESS_DENIED",
    message: `${requirement} Signed in as ${user.id} (${user.roleLabel.toLowerCase()}).`,
    correlationId: gateCor(pathname, user.id.split("-")[0] ?? "anon"),
  }
  const home = ROLE_DEFAULT_ROUTE[user.role]
  return (
    <Card className="flex flex-col gap-2xl">
      <div className="flex flex-col gap-lg">
        <Eyebrow>{workspace}</Eyebrow>
        <Heading as="h1" size="md">
          Not in your scope
        </Heading>
      </div>
      <ErrorNotice
        error={error}
        title="This workspace is outside your authorization"
      >
        <ButtonLink to={home} size="sm" variant="primary" iconEnd={ArrowUpRight}>
          Go to {workspaceLabel(user.role)}
        </ButtonLink>
      </ErrorNotice>
      <p className="type-body text-body-sm max-w-prose">
        Access follows the role on your session. To use a different role, sign
        out and sign in with that identity. The attempt to open{" "}
        <Mono>{pathname}</Mono> was written to the evidence log.
      </p>
    </Card>
  )
}

/**
 * Layout route that guards every protected workspace. Nothing below it
 * renders until a session exists and the route policy admits its role.
 */
export function RequireAuth() {
  const { user } = useSession()
  const { pathname } = useLocation()
  const verdict = user ? authorize(user.role, pathname) : null

  useEffect(() => {
    if (!user || !verdict) return
    vault.recordRouteAccess(
      pathname,
      verdict.allowed,
      verdict.allowed ? "" : verdict.requirement,
    )
  }, [user, verdict, pathname])

  if (!user) return <ToLogin />
  if (verdict && !verdict.allowed)
    return (
      <AccessDenied
        workspace={matchRoutePolicy(pathname)?.label ?? "Workspace"}
        requirement={verdict.requirement}
      />
    )
  return <Outlet />
}

/** In-view guard (defence in depth behind RequireAuth). */
export function Gate({
  roles,
  workspace,
  requirement,
  children,
}: {
  roles: Role[]
  workspace: string
  requirement: string
  children: ReactNode
}) {
  const { user } = useSession()
  if (!user) return <ToLogin />
  if (!roles.includes(user.role))
    return <AccessDenied workspace={workspace} requirement={requirement} />
  return <>{children}</>
}

/** Signed-out link to the login page that preserves the current destination. */
export function SignInLink({ label = "Sign in" }: { label?: string }) {
  const { pathname } = useLocation()
  return (
    <ButtonLink to={loginPathFor(pathname)} size="sm" variant="primary" icon={LogIn}>
      {label}
    </ButtonLink>
  )
}
