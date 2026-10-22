import { useState } from "react"
import { Check, Lock, RefreshCw, Send } from "lucide-react"
import { Modal, TextareaField, cn } from "./kit"
import type {
  AccessRequest,
  ApiError,
  GovernanceChange,
  Grant,
} from "@/lib/contracts"
import { fixedRestrictedScope, vault } from "@/lib/fixtureAdapter"
import { STUDY_ID } from "@/lib/fixtures"
import { useSession } from "@/app/session"
import {
  CalderaPillButton,
  CategoryBadge,
  ErrorCode,
  ErrorNotice,
  Heading,
  Mono,
} from "./ui"

/* ----- current assistant request for RESTRICTED on the study ----- */

/**
 * The restricted-scope request in the seeded study. Pass the signed-in
 * requester's own ID to see only theirs; omit it (reviewers) to see the
 * study's open request.
 */
export function useRestrictedRequest(requesterId?: string) {
  const { version } = useSession()
  void version
  const request = vault
    .listAccessRequests(STUDY_ID)
    .find(
      (r) =>
        (requesterId === undefined || r.requesterId === requesterId) &&
        r.scope.dataCategory === "RESTRICTED",
    )
  const change = request?.governanceChangeId
    ? vault.listChanges().find((c) => c.id === request.governanceChangeId)
    : undefined
  return { request, change }
}

export function approvalsLabel(change?: GovernanceChange) {
  return change
    ? `(${change.approvals.length}/${change.requiredApprovals})`
    : `(0/2)`
}

/* ----- REQUESTED → PENDING GOVERNANCE → COMMITTED → ACTIVE ----- */

const STAGES = [
  { status: "REQUESTED", label: "REQUESTED" },
  { status: "PENDING_GOVERNANCE", label: "PENDING GOVERNANCE" },
  { status: "COMMITTED", label: "COMMITTED" },
  { status: "ACTIVE", label: "ACTIVE" },
] as const

/**
 * Four-step pipeline. The highlighted step is read straight from the request
 * status; with no request nothing is highlighted (access stays locked).
 */
export function AccessProgress({
  request,
  change,
}: {
  request?: AccessRequest
  change?: GovernanceChange
}) {
  const current = request
    ? STAGES.findIndex((s) => s.status === request.status)
    : -1
  const detail = (status: typeof STAGES[number]["status"], i: number) => {
    if (status === "PENDING_GOVERNANCE" && i <= current)
      return approvalsLabel(change)
    if (status === "COMMITTED" && i <= current && change)
      return `(${change.approvals.length}/${change.requiredApprovals})`
    return null
  }
  return (
    <div className="flex w-full min-w-0 flex-col gap-lg">
      <ol
        className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Access request progression"
      >
        {STAGES.map((stage, i) => {
          const done = i < current
          const now = i === current
          const extra = detail(stage.status, i)
          return (
            <li
              key={stage.status}
              aria-current={now ? "step" : undefined}
              className={cn(
                "flex min-w-0 items-center gap-lg rounded-inset px-xl py-lg",
                done && "surface-elevated",
                now && "surface-accent",
                !done && !now && "rule-dotted text-ink-muted",
              )}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-pill rule-solid border-current type-id">
                {done ? (
                  <Check className="size-4" aria-hidden />
                ) : (
                  <span aria-hidden>0{i + 1}</span>
                )}
              </span>
              <span className="flex min-w-0 flex-col gap-xs">
                <span className="sr-only">
                  {done ? "Done:" : now ? "Current:" : "Upcoming:"}
                </span>
                <span className="type-eyebrow">
                  0{i + 1} {stage.label}
                </span>
                {extra && <span className="type-id">{extra}</span>}
              </span>
            </li>
          )
        })}
      </ol>
      {!request && (
        <p className="type-body text-body-sm">
          Not requested yet · access stays locked until a request is committed
          and activated.
        </p>
      )}
    </div>
  )
}

/* ----- Request modal (fixed scope, reason required) ----- */

export function RequestAccessModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean
  onClose: () => void
  onCreated?: (r: AccessRequest) => void
}) {
  const scope = fixedRestrictedScope()
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const close = () => {
    setError(null)
    onClose()
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    const result = await vault.createAccessRequest({ scope, reason })
    setBusy(false)
    if (!result.ok) return setError(result.error)
    setReason("")
    onCreated?.(result.data)
    onClose()
  }

  const fieldError = error?.status === 422 ? error : null
  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Request restricted scope"
      size="large"
      className="rv-modal"
      footer={
        <>
          <CalderaPillButton
            label="Cancel"
            variant="secondary"
            size="sm"
            arrow={false}
            onClick={close}
          />
          <CalderaPillButton
            label="Submit request"
            variant="dark"
            size="sm"
            icon={Send}
            arrow={false}
            loading={busy}
            onClick={submit}
          />
        </>
      }
    >
      <div className="flex flex-col gap-2xl">
        <p className="type-body text-body-sm">
          This scope is fixed by the study policy. Governance admins see your
          reason before signing on the Tide network.
        </p>
        <dl className="flex flex-col rounded-inset surface-inset px-xl py-md">
          {(Object.entries(scope) as [keyof typeof scope, string][]).map(
            ([k, v]) => (
              <div
                key={k}
                className="flex flex-wrap items-center justify-between gap-x-xl gap-y-xs rule-dotted-b py-md last:border-b-0"
              >
                <dt className="type-id">{k}</dt>
                <dd className="flex min-w-0 items-center gap-md type-id break-words">
                  "{v}"
                  <Lock className="size-4 shrink-0" aria-label="fixed" />
                </dd>
              </div>
            ),
          )}
        </dl>
        <div className="flex flex-col gap-md">
          <TextareaField
            label="Reason for access"
            description="Required. At least 20 characters."
            placeholder="e.g. Second coder for 20% reliability double-coding on P-01."
            value={reason}
            onChange={setReason}
            rows={3}
            className="rv-input"
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? "reason-error" : undefined}
          />
          {fieldError && (
            <p
              id="reason-error"
              role="alert"
              className="flex flex-wrap items-center gap-md type-body text-body-sm"
            >
              <ErrorCode error={fieldError} />
              {fieldError.message}
            </p>
          )}
        </div>
        {error && !fieldError && (
          <ErrorNotice
            error={error}
            title={error.status === 409 ? "Duplicate request" : undefined}
          />
        )}
      </div>
    </Modal>
  )
}

/* ----- Committed → explicit refresh, then decrypt through policy ----- */

export function RefreshAccessNotice({ request }: { request: AccessRequest }) {
  const { decrypt } = useSession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const refresh = async () => {
    setBusy(true)
    setError(null)
    const result = await vault.refreshAuthorization()
    if (!result.ok) {
      setBusy(false)
      return setError(result.error)
    }
    // Decryption still goes through the normal policy check with the new token.
    const denied = await decrypt(request.scope.contextRecordId)
    setBusy(false)
    if (denied) setError(denied)
  }
  return (
    <section
      role="status"
      aria-labelledby="refresh-h"
      className="flex w-full min-w-0 flex-col gap-xl rounded-card surface-elevated rule-solid border-accent p-2xl md:p-card"
    >
      <div className="flex flex-col gap-xl md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-col gap-md">
          <p className="flex items-center gap-md type-eyebrow">
            <span className="rv-pulse text-accent" aria-hidden />
            Committed · awaiting refresh
          </p>
          <Heading id="refresh-h" size="md">
            Permission committed. Refresh access to continue.
          </Heading>
          <p className="max-w-prose type-body text-body-sm break-words">
            <Mono>{request.id}</Mono> reached quorum. Your current authorization
            does not include it until you refresh.
          </p>
        </div>
        <CalderaPillButton
          label="Refresh Authorization & Decrypt"
          variant="primary"
          icon={RefreshCw}
          arrow={false}
          loading={busy}
          onClick={refresh}
        />
      </div>
      {error && (
        <ErrorNotice error={error} title="Refresh failed">
          <CalderaPillButton
            label="Retry refresh"
            size="sm"
            variant="dark"
            icon={RefreshCw}
            arrow={false}
            loading={busy}
            onClick={refresh}
          />
        </ErrorNotice>
      )}
    </section>
  )
}

export function GrantList({ grants }: { grants: Grant[] }) {
  if (!grants.length)
    return (
      <p className="type-body text-body-sm">
        No data grants in this authorization.
      </p>
    )
  return (
    <ul className="flex w-full min-w-0 flex-col">
      {grants.map((g, i) => (
        <li
          key={i}
          className="flex flex-wrap items-center gap-md rule-dotted-b py-md last:border-b-0"
        >
          <CategoryBadge category={g.category} />
          <span className="type-body text-body-sm">
            {g.scope === "OWN_RECORDS" ? "own records" : "whole study"}
          </span>
          <span className="type-caption opacity-80">
            {g.source === "BASELINE" ? (
              "baseline"
            ) : (
              <>
                governed · <Mono>{g.changeId}</Mono>
              </>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}
