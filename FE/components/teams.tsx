import { useEffect, useRef, useState, type FormEvent } from "react"
import {
  ArrowUpRight,
  Check,
  Copy,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  Ticket,
  UserCheck,
  UserX,
} from "lucide-react"
import { InputField, Modal } from "./kit"
import type {
  ApiError,
  IssuedSecret,
  Study,
  TeamInvitation,
} from "@/lib/contracts"
import { vault } from "@/lib/fixtureAdapter"
import { studyProblems } from "@/lib/validation"
import { useSession } from "@/app/session"
import { Button, Card, ErrorNotice, Eyebrow, Heading, Mono, Tag } from "./ui"

const fmtDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—"

/* ----- copy with feedback ----- */

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle")
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setState("copied")
    } catch {
      setState("failed")
    }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState("idle"), 2400)
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-md">
      <Button
        size="sm"
        variant="primary"
        icon={state === "copied" ? Check : Copy}
        onClick={copy}
      >
        {label}
      </Button>
      <span role="status" className="type-caption text-ink-muted">
        {state === "copied" && "Copied to clipboard."}
        {state === "failed" &&
          "Clipboard unavailable. Select the code and copy it manually."}
      </span>
    </span>
  )
}

/** A one-time secret: shown now, stored only as a hash afterwards. */
export function SecretReveal({
  kind,
  code,
  expiresAt,
}: {
  kind: "team" | "participant"
  code: string
  expiresAt: string
}) {
  return (
    <div className="flex flex-col gap-lg rounded-inset rule-solid border-accent bg-accent-wash p-xl">
      <Eyebrow className="text-accent">
        {kind === "team" ? "Team invitation code" : "Participant access token"}{" "}
        · shown once
      </Eyebrow>
      <Mono className="type-display text-display-sm text-ink select-all">
        {code}
      </Mono>
      <CopyButton
        value={code}
        label={kind === "team" ? "Copy Invite Code" : "Copy Access Token"}
      />
      <p className="type-caption text-ink-muted">
        One-time use, expires {fmtDate(expiresAt)}. Only a SHA-256 hash is kept,
        so it cannot be shown again; reissue if it is lost. Demo-only workflow:
        nothing is sent to a server.
      </p>
    </div>
  )
}

/* ----- create study dialog (head researcher) ----- */

export function CreateStudyDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const { setActiveStudyId } = useSession()
  const [title, setTitle] = useState("")
  const [code, setCode] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<{
    study: Study
    invitation: IssuedSecret<TeamInvitation>
  } | null>(null)

  const close = () => {
    setTitle("")
    setCode("")
    setErrors({})
    setApiError(null)
    setCreated(null)
    onClose()
  }

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    setApiError(null)
    const problems = studyProblems({ title, code })
    setErrors(Object.fromEntries(problems.map((p) => [p.field, p.message])))
    if (problems.length) return
    setBusy(true)
    const result = await vault.createStudy({ title, code })
    setBusy(false)
    if (!result.ok) {
      if (result.error.field)
        setErrors({ [result.error.field]: result.error.message })
      else setApiError(result.error)
      return
    }
    setCreated(result.data)
    setActiveStudyId(result.data.study.id)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={created ? "Study created" : "Create research study / team"}
      className="rv-modal"
      footer={
        created ? (
          <Button size="sm" variant="primary" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon={Plus}
              loading={busy}
              onClick={() => submit()}
            >
              Create study
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="flex flex-col gap-xl">
          <p role="status" className="type-body text-body-sm">
            <Mono>{created.study.id}</Mono> “{created.study.title}” is live with
            you as head researcher and the only team member. It has no records
            yet.
          </p>
          <SecretReveal
            kind="team"
            code={created.invitation.code}
            expiresAt={created.invitation.record.expiresAt}
          />
        </div>
      ) : (
        <form noValidate onSubmit={submit} className="flex flex-col gap-xl">
          <InputField
            label="Study Title"
            placeholder="e.g. Student Wellbeing Interview Study"
            value={title}
            onChange={(v) => {
              setTitle(v)
              setErrors((x) => ({ ...x, title: "" }))
            }}
            error={errors.title}
          />
          <InputField
            label="Unique Study Code"
            placeholder="e.g. study-wellbeing-01"
            description="Lowercase letters, digits and hyphens. Becomes the study ID; it is not a secret."
            value={code}
            onChange={(v) => {
              setCode(v)
              setErrors((x) => ({ ...x, code: "" }))
            }}
            error={errors.code}
            spellCheck={false}
            autoCapitalize="none"
          />
          <div className="flex flex-col gap-md">
            <p className="rv-field__label">Governance policy</p>
            <p className="flex items-center justify-between gap-lg rounded-inset surface-inset px-xl py-lg type-id">
              2-of-3 Quorum Required
              <Lock className="size-4 shrink-0" aria-label="Fixed policy" />
            </p>
            <p className="type-caption text-ink-muted">
              Fixed for every study. Scope changes need two of three governance
              signatures.
            </p>
          </div>
          {apiError && (
            <ErrorNotice error={apiError} title="Study not created" />
          )}
          {/* Enter submits; the footer button is the visible action. */}
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      )}
    </Modal>
  )
}

/* ----- roster ----- */

const GOVERNANCE_LABEL = {
  PROPOSER: "Proposer · governance admin",
  GOVERNANCE_ADMIN: "Governance admin",
  TEAM_MEMBER: "Team member",
} as const

export function Roster({ studyId }: { studyId: string }) {
  const { version } = useSession()
  void version
  const roster = vault.getRoster(studyId)
  if (!roster.ok) return <ErrorNotice error={roster.error} />
  const rows = roster.data
  return (
    <div className="flex flex-col gap-md">
      <Eyebrow>Team roster · {rows.length}</Eyebrow>
      <ul className="flex flex-col divide-dotted-y">
        {rows.map((m) => (
          <li
            key={m.id}
            className="grid grid-cols-1 gap-xs py-lg sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-lg"
          >
            <span className="flex min-w-0 flex-col gap-xs">
              <Mono>{m.identityId}</Mono>
              <span className="type-caption text-ink-muted break-words">
                {m.displayName}
              </span>
            </span>
            <span className="flex min-w-0 flex-col gap-xs type-body text-body-sm">
              {m.roleLabel}
              <span className="type-caption text-ink-muted">
                {GOVERNANCE_LABEL[m.governance]}
              </span>
            </span>
            <span className="flex flex-col gap-xs sm:items-end">
              <Tag
                className={
                  m.status === "PENDING"
                    ? "bg-transparent rule-solid text-ink"
                    : undefined
                }
              >
                {m.status}
              </Tag>
              <span className="type-caption text-ink-muted">
                {m.status === "ACTIVE"
                  ? `Joined ${fmtDate(m.joinedAt)}`
                  : `Requested ${fmtDate(m.requestedAt)}`}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ----- one study, head-researcher controls ----- */

function StudyTeamCard({ study, isHead }: { study: Study; isHead: boolean }) {
  const { version } = useSession()
  void version
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [invite, setInvite] = useState<{
    code: string
    expiresAt: string
  } | null>(null)
  const [token, setToken] = useState<{ code: string; expiresAt: string } | null>(
    null,
  )

  const invitations = isHead ? vault.listInvitations(study.id) : []
  const open = invitations.find((i) => i.status === "ACTIVE")
  const roster = vault.getRoster(study.id)
  const pending = roster.ok
    ? roster.data.filter((m) => m.status === "PENDING")
    : []

  const run = async <T,>(
    key: string,
    op: () => Promise<{ ok: true; data: T } | { ok: false; error: ApiError }>,
    onOk: (data: T) => void,
  ) => {
    setBusy(key)
    setError(null)
    const result = await op()
    setBusy(null)
    if (result.ok) onOk(result.data)
    else setError(result.error)
  }

  return (
    <Card as="article" className="flex flex-col gap-2xl">
      <div className="flex flex-col gap-md">
        <div className="flex flex-wrap items-center gap-md">
          <Tag>{study.status}</Tag>
          <Tag className="bg-transparent rule-solid text-ink">
            <Lock className="size-3" aria-hidden /> 2-of-3 quorum
          </Tag>
        </div>
        <Heading as="h3" size="md">
          {study.title}
        </Heading>
        <p className="type-caption text-ink-muted">
          <Mono>{study.id}</Mono> · head <Mono>{study.headResearcherId}</Mono> ·
          created {fmtDate(study.createdAt)} · {study.ethicsReference}
        </p>
      </div>

      <Roster studyId={study.id} />

      {isHead && pending.length > 0 && (
        <div className="flex flex-col gap-md">
          <Eyebrow>Join requests awaiting you</Eyebrow>
          <ul className="flex flex-col divide-dotted-y">
            {pending.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-md py-lg"
              >
                <span className="min-w-0">
                  <Mono>{m.identityId}</Mono>{" "}
                  <span className="type-caption text-ink-muted">
                    wants to join as research assistant
                  </span>
                </span>
                <span className="flex flex-wrap gap-md">
                  <Button
                    size="sm"
                    variant="primary"
                    icon={UserCheck}
                    loading={busy === `approve-${m.id}`}
                    onClick={() =>
                      run(
                        `approve-${m.id}`,
                        () => vault.reviewMembership(m.id, "APPROVE"),
                        () => {},
                      )
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    icon={UserX}
                    loading={busy === `decline-${m.id}`}
                    onClick={() =>
                      run(
                        `decline-${m.id}`,
                        () => vault.reviewMembership(m.id, "DECLINE"),
                        () => {},
                      )
                    }
                  >
                    Decline
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isHead && (
        <div className="flex flex-col gap-lg rule-dotted-t pt-2xl">
          <Eyebrow>Invitations · demo only</Eyebrow>
          <p className="type-body text-body-sm text-ink-muted">
            {open
              ? `Open team invitation ends in …${open.codeHint}, expires ${fmtDate(open.expiresAt)}.`
              : "No open team invitation."}{" "}
            The study ID lets researchers request to join; only an invitation
            code admits them without your approval.
          </p>
          {invite && <SecretReveal kind="team" {...invite} />}
          {token && <SecretReveal kind="participant" {...token} />}
          <div className="flex flex-wrap gap-md">
            <Button
              size="sm"
              variant="outline"
              icon={RefreshCw}
              loading={busy === "invite"}
              onClick={() =>
                run(
                  "invite",
                  () => vault.issueTeamInvitation(study.id),
                  (d) =>
                    setInvite({ code: d.code, expiresAt: d.record.expiresAt }),
                )
              }
            >
              {open ? "Reissue invite code" : "Issue invite code"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={Ticket}
              loading={busy === "token"}
              onClick={() =>
                run(
                  "token",
                  () => vault.issueParticipantToken(study.id),
                  setToken,
                )
              }
            >
              Issue participant token
            </Button>
          </div>
        </div>
      )}
      {error && <ErrorNotice error={error} />}
    </Card>
  )
}

/** Governance section: study creation (head researcher) and team rosters. */
export function StudyTeamsPanel() {
  const { user, version } = useSession()
  void version
  const [creating, setCreating] = useState(false)
  if (!user) return null
  const isHead = user.role === "HEAD_RESEARCHER"
  const studies = isHead ? vault.listLedStudies() : vault.listMyStudies()
  return (
    <section aria-labelledby="teams-heading" className="flex flex-col gap-2xl">
      <div className="flex flex-wrap items-end justify-between gap-xl">
        <div className="flex flex-col gap-md">
          <Eyebrow>Research studies &amp; teams</Eyebrow>
          <Heading id="teams-heading" size="lg">
            {isHead ? "Studies you lead" : "Studies you govern"}
          </Heading>
        </div>
        {isHead && (
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setCreating(true)}
          >
            Create Research Study / Team
          </Button>
        )}
      </div>
      {studies.length === 0 ? (
        <Card surface="outline">
          <p className="type-body text-body-sm">No studies yet.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2xl xl:grid-cols-2">
          {studies.map((s) => (
            <StudyTeamCard
              key={s.id}
              study={s}
              isHead={isHead && s.headResearcherId === user.id}
            />
          ))}
        </div>
      )}
      {isHead && (
        <CreateStudyDialog
          isOpen={creating}
          onClose={() => setCreating(false)}
        />
      )}
    </section>
  )
}

/* ----- researcher: join a team ----- */

export function JoinTeamPanel({
  onJoined,
}: {
  onJoined?: (studyId: string) => void
}) {
  const { version } = useSession()
  void version
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const pending = vault
    .listMyMemberships()
    .filter((m) => m.status === "PENDING")

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setDone(null)
    if (!value.trim()) {
      setError({
        status: 422,
        code: "VALIDATION_FAILED",
        message: "Enter a study ID or invitation code.",
        correlationId: "cor-join-empty",
        field: "join",
      })
      return
    }
    setBusy(true)
    const result = await vault.joinTeam(value)
    setBusy(false)
    if (!result.ok) return setError(result.error)
    setValue("")
    if (result.data.status === "ACTIVE") {
      setDone(
        `Joined ${result.data.studyId}. Your workspace is now bound to this study.`,
      )
      onJoined?.(result.data.studyId)
    } else
      setDone(
        `Join request sent for ${result.data.studyId}. It stays pending until the head researcher approves it.`,
      )
  }

  return (
    <Card
      surface="elevated"
      as="section"
      aria-labelledby="join-heading"
      className="flex flex-col gap-xl"
    >
      <div className="flex flex-col gap-md">
        <Heading id="join-heading" size="md">
          JOIN A RESEARCH TEAM
        </Heading>
        <p className="type-body text-body-sm text-ink-muted max-w-prose">
          Enter the Study ID or invitation code provided by your Head Researcher
          to bind your workspace to this study.
        </p>
      </div>
      <form
        noValidate
        onSubmit={submit}
        className="flex flex-col gap-lg md:flex-row md:items-end"
      >
        <InputField
          className="min-w-0 flex-1"
          label="Study ID or invitation code"
          placeholder="Enter Study Code (e.g., study-wellbeing-01)"
          value={value}
          onChange={setValue}
          spellCheck={false}
          autoCapitalize="none"
          error={
            error?.code === "VALIDATION_FAILED" ? error.message : undefined
          }
        />
        <Button
          type="submit"
          variant="primary"
          iconEnd={ArrowUpRight}
          loading={busy}
        >
          Join Study Team
        </Button>
      </form>
      {error && error.code !== "VALIDATION_FAILED" && (
        <ErrorNotice error={error} title="Not joined" />
      )}
      {done && (
        <p
          role="status"
          className="flex items-start gap-md type-body text-body-sm"
        >
          <Check className="mt-xs size-4 shrink-0 text-accent" aria-hidden />
          {done}
        </p>
      )}
      {pending.length > 0 && (
        <p className="type-caption text-ink-muted">
          Pending approval: {pending.map((m) => m.studyId).join(", ")}
        </p>
      )}
      <p className="type-caption text-ink-muted">
        Joining gives team-level INTERNAL access only. Restricted records still
        need a governed 2-of-3 change.
      </p>
    </Card>
  )
}

/* ----- participant: enroll with an access token ----- */

export function EnrollmentPanel() {
  const { version } = useSession()
  void version
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const enrollments = vault.listMyEnrollments()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setDone(null)
    setBusy(true)
    const result = await vault.enrollWithToken(value)
    setBusy(false)
    if (!result.ok) return setError(result.error)
    setValue("")
    setDone(
      `Enrolled in ${result.data.studyId}. You can see only your own records there.`,
    )
  }

  return (
    <Card
      as="section"
      aria-labelledby="enroll-heading"
      className="flex flex-col gap-xl"
    >
      <div className="flex flex-col gap-md">
        <Eyebrow>Study enrollment</Eyebrow>
        <Heading id="enroll-heading" size="md">
          {enrollments.length ? "Your studies" : "Enroll in a study"}
        </Heading>
        {enrollments.length > 0 ? (
          <ul className="flex flex-wrap gap-md">
            {enrollments.map((e) => (
              <li key={e.id}>
                <Tag>
                  Current study ·{" "}
                  <span className="normal-case">{e.studyId}</span>
                </Tag>
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-body text-body-sm text-ink-muted">
            You are not enrolled in any study yet.
          </p>
        )}
      </div>
      <form
        noValidate
        onSubmit={submit}
        className="flex flex-col gap-lg md:flex-row md:items-end"
      >
        <InputField
          className="min-w-0 flex-1"
          label="Participant Study Access Token"
          placeholder="PTK-XXXX-XXXX-XXXX"
          value={value}
          onChange={setValue}
          spellCheck={false}
          autoCapitalize="characters"
          error={
            error?.code === "VALIDATION_FAILED" ? error.message : undefined
          }
        />
        <Button type="submit" variant="primary" icon={KeyRound} loading={busy}>
          Enroll
        </Button>
      </form>
      {error && error.code !== "VALIDATION_FAILED" && (
        <ErrorNotice error={error} title="Not enrolled" />
      )}
      {done && (
        <p
          role="status"
          className="flex items-start gap-md type-body text-body-sm"
        >
          <Check className="mt-xs size-4 shrink-0 text-accent" aria-hidden />
          {done}
        </p>
      )}
      <p className="type-caption text-ink-muted">
        Enrollment is consent to contribute. It never grants research or
        governance rights, and team invitation codes are not accepted here.
      </p>
    </Card>
  )
}
