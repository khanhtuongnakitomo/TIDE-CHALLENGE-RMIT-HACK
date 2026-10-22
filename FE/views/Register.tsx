import { useState, type FormEvent } from "react"
import { Link } from "react-router"
import { ArrowUpRight, CircleCheck, UserPlus } from "lucide-react"
import { InputField, RadioGroup } from "@/components/kit"
import type { ApiError, Identity, RegistrationInput } from "@/lib/contracts"
import { useSession } from "@/app/session"
import { PASSWORD_MIN, registrationProblems } from "@/lib/validation"
import { AuthCard } from "@/components/auth"
import { Button, ButtonLink, ErrorNotice, Mono } from "@/components/ui"

const EMPTY: RegistrationInput = {
  identityId: "",
  email: "",
  displayName: "",
  password: "",
  confirmPassword: "",
  accountType: "PARTICIPANT",
}

const ACCOUNT_TYPES = [
  {
    value: "PARTICIPANT",
    label: "Study participant",
    description:
      "Enroll in a study with a participant access token. Sees only your own records.",
  },
  {
    value: "RESEARCH_ASSISTANT",
    label: "Research assistant",
    description:
      "Join a study team by invitation or join request. Starts with no data access.",
  },
]

export function Register() {
  const { register, user } = useSession()
  const [form, setForm] = useState<RegistrationInput>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<Identity | null>(null)

  const set = (field: keyof RegistrationInput) => (value: string) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: "" }))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setApiError(null)
    const problems = registrationProblems(form)
    setErrors(Object.fromEntries(problems.map((p) => [p.field, p.message])))
    if (problems.length) return
    setBusy(true)
    const result = await register(form)
    setBusy(false)
    if (!result.ok) {
      setApiError(result.error)
      if (result.error.field)
        setErrors((x) => ({ ...x, [result.error.field!]: result.error.message }))
      return
    }
    setForm(EMPTY)
    setCreated(result.data)
  }

  if (created)
    return (
      <AuthCard eyebrow="Demo provisioning" title="Account created">
          <p role="status" className="flex items-start gap-md type-body text-body-lg">
            <CircleCheck className="mt-xs size-6 shrink-0 text-accent" aria-hidden />
            <span>
              <Mono>{created.id}</Mono> ({created.roleLabel.toLowerCase()}) is
              saved in this browser&apos;s demo directory. It has no study
              access yet.
            </span>
          </p>
          <p className="type-body text-body-sm text-ink-muted">
            {created.role === "PARTICIPANT"
              ? "After signing in, enroll with the participant access token the study team gives you."
              : "After signing in, join a team with an invitation code, or request to join by study ID."}
          </p>
          <ButtonLink to="/login" variant="primary" iconEnd={ArrowUpRight} className="self-start">
            Go to sign in
          </ButtonLink>
      </AuthCard>
    )

  return (
    <AuthCard
      eyebrow="Demo provisioning"
      title="Register"
      badge="This browser only"
      lead={
        <p>
          Creates a demo account in this browser. Nothing is sent to a server.
          You can register as a participant or research assistant only. Head
          researcher, data steward and ethics roles cannot be self-assigned.
        </p>
      }
    >
      {user && (
        <p className="type-body text-body-sm text-ink-muted">
          You are signed in as <Mono>{user.id}</Mono>. Registering does not
          change your current session.
        </p>
      )}

        <form noValidate onSubmit={submit} className="flex flex-col gap-xl">
          <div className="flex flex-col gap-xl">
            <InputField
              label="Identity ID"
              value={form.identityId}
              onChange={set("identityId")}
              description="Lowercase, e.g. assistant-02. Used to sign in."
              error={errors.identityId}
              autoComplete="username"
              spellCheck={false}
              autoCapitalize="none"
            />
            <InputField
              label="Email"
              type="email"
              value={form.email}
              onChange={set("email")}
              error={errors.email}
              autoComplete="email"
            />
          </div>
          <InputField
            label="Display name"
            value={form.displayName}
            onChange={set("displayName")}
            error={errors.displayName}
            autoComplete="name"
          />
          <div className="flex flex-col gap-xl">
            <InputField
              label="Password"
              type="password"
              value={form.password}
              onChange={set("password")}
              description={`At least ${PASSWORD_MIN} characters, with a letter and a digit.`}
              error={errors.password}
              autoComplete="new-password"
            />
            <InputField
              label="Confirm password"
              type="password"
              value={form.confirmPassword}
              onChange={set("confirmPassword")}
              error={errors.confirmPassword}
              autoComplete="new-password"
            />
          </div>
          <fieldset className="flex flex-col gap-md">
            <legend id="account-type" className="rv-field__label">
              Account type
            </legend>
            <RadioGroup
              name="accountType"
              aria-labelledby="account-type"
              value={form.accountType}
              onChange={(v) => set("accountType")(v)}
              options={ACCOUNT_TYPES}
            />
            {errors.accountType && (
              <p className="rv-field__error">{errors.accountType}</p>
            )}
          </fieldset>
          {apiError && <ErrorNotice error={apiError} title="Not registered" />}
          <div className="flex flex-wrap items-center gap-lg">
            <Button type="submit" variant="primary" icon={UserPlus} loading={busy}>
              Create demo account
            </Button>
            <Link
              to="/login"
              className="type-body text-body-sm underline underline-offset-4 hover:text-accent"
            >
              Already registered? Sign in
            </Link>
          </div>
        </form>
    </AuthCard>
  )
}
