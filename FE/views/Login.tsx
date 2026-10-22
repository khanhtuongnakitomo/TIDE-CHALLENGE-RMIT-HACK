import { useState, type FormEvent } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router"
import { ArrowUpRight, CircleCheck, LogIn } from "lucide-react"
import { InputField } from "@/components/kit"
import type { ApiError, ApiResult, CurrentUser, PersonaId } from "@/lib/contracts"
import { vault } from "@/lib/fixtureAdapter"
import {
  ROLE_DEFAULT_ROUTE,
  SESSION_REQUIRED_MESSAGE,
  destinationAfterSignIn,
  safeInternalPath,
} from "@/lib/policy"
import { useSession } from "@/app/session"
import { AuthCard } from "@/components/auth"
import { Button, ButtonLink, ErrorCode, ErrorNotice, Eyebrow, Mono } from "@/components/ui"

/**
 * Persona shortcuts only exist while the fixture adapter is active, or when a
 * build explicitly opts in. A live adapter would turn them off.
 */
const DEMO_AUTH_ENABLED =
  vault.mode === "fixture" || import.meta.env.VITE_ENABLE_DEMO_AUTH === "true"

const DEMO_PERSONAS: { id: PersonaId; label: string }[] = [
  { id: "participant-01", label: "Participant (participant-01)" },
  { id: "assistant-01", label: "Research Assistant (assistant-01)" },
  { id: "head-01", label: "Head Researcher (head-01)" },
  { id: "steward-01", label: "Data Steward (steward-01)" },
  { id: "ethics-01", label: "Ethics Representative (ethics-01)" },
]

type Notice = "SESSION_REQUIRED" | "SESSION_EXPIRED" | "SIGNED_OUT"

function useNotice(next: string | null): Notice | null {
  const location = useLocation()
  const { lastEnd } = useSession()
  const state = (location.state ?? {}) as { notice?: Notice }
  if (state.notice === "SIGNED_OUT" || lastEnd === "SIGNED_OUT")
    return "SIGNED_OUT"
  if (state.notice === "SESSION_EXPIRED" || lastEnd === "EXPIRED")
    return "SESSION_EXPIRED"
  if (state.notice === "SESSION_REQUIRED" || next) return "SESSION_REQUIRED"
  return null
}

function NoticePanel({ notice }: { notice: Notice }) {
  if (notice === "SIGNED_OUT")
    return (
      <div
        role="status"
        className="flex items-start gap-lg rounded-inset rule-solid border-accent bg-accent-wash p-xl text-ink"
      >
        <CircleCheck className="mt-xs size-5 shrink-0 text-accent" aria-hidden />
        <p className="type-body text-body-sm">
          Signed out. Your demo session ended. Decrypted records, study context
          and cached data were cleared from this tab.
        </p>
      </div>
    )
  const expired = notice === "SESSION_EXPIRED"
  return (
    <div
      role="alert"
      className="flex flex-col gap-md rounded-inset surface-inset border-outline p-xl"
    >
      <ErrorCode
        error={{ status: 401, code: expired ? "SESSION_EXPIRED" : "SESSION_REQUIRED" }}
        className="self-start"
      />
      <p className="type-body text-body-sm">
        {expired
          ? "SESSION_EXPIRED: Your session expired after 30 minutes. Sign in again to continue."
          : SESSION_REQUIRED_MESSAGE}
      </p>
    </div>
  )
}

const linkClass =
  "underline underline-offset-4 transition-colors hover:text-accent"

export function Login() {
  const [params] = useSearchParams()
  const next = safeInternalPath(params.get("next"))
  const notice = useNotice(next)
  const navigate = useNavigate()
  const { user, pending, signInPersona, signInWithPassword } = useSession()

  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const [fieldError, setFieldError] = useState<{ login?: string; password?: string }>({})
  const [error, setError] = useState<ApiError | null>(null)

  const finish = (result: ApiResult<CurrentUser>) => {
    if (!result.ok) {
      setError(result.error)
      return
    }
    setPassword("")
    navigate(destinationAfterSignIn(result.data, next), { replace: true })
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const problems = {
      login: login.trim() ? undefined : "Enter your email or identity ID.",
      password: password ? undefined : "Enter your password.",
    }
    setFieldError(problems)
    if (problems.login || problems.password) return
    const result = await signInWithPassword(login, password)
    if (!result.ok) setPassword("")
    finish(result)
  }

  if (user)
    return (
      <AuthCard eyebrow="Fixture authentication" title="Already signed in">
        <p className="type-body text-body">
          You are signed in as <Mono>{user.id}</Mono> ({user.roleLabel}). To
          use a different identity, sign out first.
        </p>
        <ButtonLink
          to={next ? destinationAfterSignIn(user, next) : ROLE_DEFAULT_ROUTE[user.role]}
          variant="primary"
          iconEnd={ArrowUpRight}
          className="self-start"
        >
          Continue to workspace
        </ButtonLink>
      </AuthCard>
    )

  const busy = pending !== null

  return (
    <AuthCard
      eyebrow="Fixture authentication"
      title="Sign In"
      badge="Simulated"
      lead={
        <p>
          Demo sign-in for a synthetic-data prototype. TideCloak is simulated:
          no server is contacted, and demo accounts are checked against salted
          hashes kept in this browser.{" "}
          <Link to="/documentation#auth" className={linkClass}>
            What is simulated
          </Link>
        </p>
      }
    >
      {notice && <NoticePanel notice={notice} />}

      <form noValidate onSubmit={submit} className="flex flex-col gap-xl">
        <InputField
          label="Email or identity ID"
          value={login}
          onChange={setLogin}
          autoComplete="username"
          spellCheck={false}
          autoCapitalize="none"
          error={fieldError.login}
        />
        <InputField
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          error={fieldError.password}
        />
        {error && <ErrorNotice error={error} title="Sign-in failed" />}
        {next && (
          <p className="type-caption text-ink-muted">
            Continues to <Mono>{next}</Mono> if your role may open it.
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          iconEnd={ArrowUpRight}
          loading={pending === "password"}
          disabled={busy && pending !== "password"}
          className="w-full"
        >
          Authenticate via TideCloak
        </Button>
        <p className="type-body text-body-sm text-ink-muted">
          No account?{" "}
          <Link to="/register" className={linkClass}>
            Register a demo account
          </Link>
        </p>
      </form>

      {DEMO_AUTH_ENABLED && (
        <section
          aria-labelledby="demo-auth-heading"
          className="flex flex-col gap-lg rule-dotted-t pt-2xl"
        >
          <Eyebrow>
            <span id="demo-auth-heading">
              QUICK DEMO AUTHENTICATION (SELECT PERSONA):
            </span>
          </Eyebrow>
          <p className="type-caption text-ink-muted">
            Simulated sessions for the seeded study-wellbeing-01 personas. No
            credentials are checked.
          </p>
          <ul className="grid grid-cols-1 gap-md">
            {DEMO_PERSONAS.map((p) => (
              <li key={p.id}>
                <Button
                  variant="surface"
                  size="sm"
                  icon={LogIn}
                  loading={pending === p.id}
                  disabled={busy && pending !== p.id}
                  className="w-full justify-start"
                  onClick={async () => {
                    setError(null)
                    finish(await signInPersona(p.id))
                  }}
                >
                  {p.label}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AuthCard>
  )
}
