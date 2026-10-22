import { useEffect, useState } from "react"
import {
  Clock,
  ExternalLink,
  Minus,
  RefreshCw,
  Signature,
  Stamp,
  Vault,
} from "lucide-react"
import { Modal, RadioGroup, cn } from "@/components/kit"
import type {
  ApiError,
  ClearanceLevel,
  GovernanceChange,
  PersonaId,
  ProviderChangeView,
} from "@/lib/contracts"
import { useSession } from "@/app/session"
import { vault } from "@/lib/fixtureAdapter"
import { PERSONAS, STUDY, STUDY_ID, personaById } from "@/lib/fixtures"
import { Gate } from "@/components/gates"
import { approvalsLabel } from "@/components/access"
import { StudyTeamsPanel } from "@/components/teams"
import { ScrollRevealCard } from "@/components/ScrollRevealCard"
import {
  Button,
  Card,
  DefinitionRows,
  ErrorNotice,
  Eyebrow,
  Heading,
  LEVEL_OF,
  Mono,
  PageHeader,
  QuorumPips,
  Spinner,
  StatusPill,
  TIER_CODE,
  TIER_TONE,
  tierName,
  TierGlyph,
} from "@/components/ui"

const TEAM: PersonaId[] = ["assistant-01", "head-01", "steward-01", "ethics-01"]
const initials = (id: string) =>
  id.split("-")
    .map((p) => p[0])
    .join("")
    .toUpperCase()

function StatCards({ pending }: { pending: number }) {
  const stats = [
    { value: String(STUDY.categories.length), label: "PAYLOAD TIERS" },
    {
      value: `${STUDY.quorum.required}/${STUDY.quorum.total}`,
      label: "QUORUM RULE",
    },
    {
      value: String(pending),
      label: pending === 1 ? "PENDING GRANT" : "PENDING GRANTS",
    },
    { value: String(STUDY.governanceAdminIds.length), label: "GOV ADMINS" },
  ]
  return (
    <div className="grid grid-cols-2 gap-xl lg:grid-cols-4">
      {stats.map((s, i) => (
        <ScrollRevealCard key={s.label} delay={i * 0.08}>
        <Card
          surface="accent"
          as="div"
          className="flex h-full min-w-0 flex-col justify-between gap-md p-2xl md:p-3xl"
        >
          <p
            className="type-display text-display-2xl text-on-accent-display"
            aria-hidden
          >
            {s.value}
          </p>
          <p className="type-body text-body-sm tracking-label break-words text-on-accent">
            <span className="sr-only">{s.value} </span>
            {s.label}
          </p>
        </Card>
        </ScrollRevealCard>
      ))}
    </div>
  )
}

function ClearanceSidebar() {
  const [level, setLevel] = useState<ClearanceLevel>(3)
  const auths = vault.listAuthorizations()
  const holders = (l: ClearanceLevel) => {
    if (l === 1) return PERSONAS.map((p) => ({ id: p.id, note: "" }))
    return auths.flatMap((a) => {
      const g = a.grants.find((x) => LEVEL_OF[x.category] === l)
      if (!g) return []
      return [
        {
          id: a.identityId,
          note:
            g.scope === "OWN_RECORDS"
              ? "own"
              : g.source === "GOVERNED_CHANGE"
                ? "governed"
                : "",
        },
      ]
    })
  }
  const levels = [1, 2, 3, 4] as ClearanceLevel[]
  const list = holders(level)
  return (
    <Card
      as="aside"
      aria-labelledby="clearance-h"
      className="flex flex-col gap-xl p-2xl md:p-3xl"
    >
      <Heading id="clearance-h" size="md">
        Clearance
      </Heading>
      <fieldset className="flex min-w-0 flex-col gap-lg">
        <legend className="mb-lg type-body text-body-sm">
          Choose a level to see who holds it.
        </legend>
        <RadioGroup
          name="clearance-level"
          className="rv-pill-radios grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1"
          value={String(level)}
          onChange={(v) => setLevel(Number(v) as ClearanceLevel)}
          options={levels.map((l) => ({
            value: String(l),
            label: tierName(l),
          }))}
        />
      </fieldset>
      <div
        className="flex flex-col gap-md rounded-inset surface-inset p-xl"
        aria-live="polite"
      >
        <span className="flex items-center gap-md type-eyebrow">
          <TierGlyph level={level} className={TIER_TONE[level]} />
          Holders · {TIER_CODE[level]}
        </span>
        {list.length ? (
          <ul className="flex flex-wrap gap-xs">
            {list.map((h) => (
              <li
                key={h.id}
                className="rounded-pill rule-solid bg-canvas px-md py-0.5 type-id"
              >
                {h.id}
                {h.note && ` · ${h.note}`}
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-body text-body-sm">
            No one holds this level in the current authorization state.
          </p>
        )}
      </div>
    </Card>
  )
}

type ApprovalState = "SIGNED" | "AWAITING" | "REQUESTER" | "NONE"

function approvalState(
  id: PersonaId,
  change?: GovernanceChange,
): ApprovalState {
  if (id === "assistant-01") return "REQUESTER"
  if (!change) return "NONE"
  return change.approvals.some((a) => a.approverId === id)
    ? "SIGNED"
    : "AWAITING"
}

const APPROVAL_LOOK: Record<ApprovalState, {
  icon: typeof Stamp
  label: string
  className: string
}> = {
  SIGNED: {
    icon: Stamp,
    label: "Signed · verified",
    className: "bg-granted text-on-accent border-granted",
  },
  AWAITING: {
    icon: Clock,
    label: "Awaiting verified signature",
    className: "border-dashed border-accent text-accent",
  },
  REQUESTER: {
    icon: Minus,
    label: "Requester · not an approver",
    className: "border-outline text-ink-muted",
  },
  NONE: {
    icon: Minus,
    label: "No open change",
    className: "border-outline text-ink-muted",
  },
}

function TeamGrid({ change }: { change?: GovernanceChange }) {
  const { user } = useSession()
  const auths = vault.listAuthorizations()
  return (
    <div className="grid grid-cols-1 gap-xl sm:grid-cols-2">
      {TEAM.map((id) => {
        const p = personaById(id)
        const auth = auths.find((a) => a.identityId === id)!
        const state = approvalState(id, change)
        const look = APPROVAL_LOOK[state]
        const Icon = look.icon
        const active = user?.id === id
        return (
          <Card
            key={id}
            as="article"
            className="flex flex-col gap-xl p-2xl md:p-3xl"
          >
            <div className="flex flex-wrap items-center gap-lg">
              <span className="grid size-11 shrink-0 place-items-center rounded-pill bg-accent-wash type-caption text-accent">
                {initials(id)}
              </span>
              <div className="flex min-w-0 flex-col">
                <Mono>{id}</Mono>
                <span className="type-body text-body-sm">{p.roleLabel}</span>
              </div>
              <span className="ml-auto flex items-center gap-xs type-caption">
                <span
                  className={cn(
                    "size-2 rounded-pill",
                    active ? "bg-granted" : "rule-solid",
                  )}
                  aria-hidden
                />
                {active ? "In session" : "Offline"}
              </span>
            </div>
            <DefinitionRows
              rows={[
                {
                  term: "Role",
                  value: p.isGovernanceAdmin
                    ? `Governance admin${id === "head-01" ? " · proposer" : ""}`
                    : "Requester",
                },
                {
                  term: "Assignment",
                  value: (
                    <>
                      <Mono>{STUDY_ID}</Mono> ·{" "}
                      {auth.grants.length
                        ? auth.grants.map((g) => g.category).join(", ")
                        : "no data tiers"}
                    </>
                  ),
                },
              ]}
            />
            <span
              className={cn(
                "mt-auto inline-flex items-center gap-md self-start rounded-pill rule-solid px-lg py-xs type-caption uppercase tracking-label",
                look.className,
              )}
            >
              <Icon className="size-4" aria-hidden />
              {look.label}
            </span>
          </Card>
        )
      })}
    </div>
  )
}

function TideConsole({
  changeId,
  isOpen,
  onClose,
}: {
  changeId: string
  isOpen: boolean
  onClose: () => void
}) {
  const { user } = useSession()
  const [view, setView] = useState<ProviderChangeView | null>(null)
  const [loading, setLoading] = useState(false)
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    const r = await vault.openProviderConsole(changeId)
    setLoading(false)
    if (r.ok) setView(r.data)
    else {
      setView(null)
      setError(r.error)
    }
  }
  useEffect(() => {
    if (isOpen) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, changeId])

  const sign = async () => {
    setSigning(true)
    setError(null)
    const r = await vault.signProviderApproval(changeId)
    setSigning(false)
    if (r.ok) setView(r.data)
    else setError(r.error)
  }

  const close = () => {
    setView(null)
    setError(null)
    onClose()
  }

  const signed = view?.approvals.some((a) => a.approverId === user?.id)
  const eligible = !!user && view?.eligibleApproverIds.includes(user.id)
  const appCount =
    vault.listChanges().find((c) => c.id === changeId)?.approvals.length ?? 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Tide approval console"
      size="large"
      className="rv-modal"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={close}>
            Close console
          </Button>
          {eligible && !signed && (
            <Button
              variant="primary"
              size="sm"
              icon={Signature}
              loading={signing}
              onClick={sign}
            >
              Sign as {user?.id}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-xl">
        <p className="flex flex-wrap items-center gap-md rounded-inset surface-canvas px-xl py-md type-caption">
          <Vault className="size-4 text-accent" aria-hidden />
          Provider surface · simulated Tide QEA network ·{" "}
          <Mono>{changeId}</Mono>
        </p>
        {loading && <Spinner label="Contacting Tide network…" />}
        {error && (
          <ErrorNotice error={error}>
            <Button size="sm" variant="ink" icon={RefreshCw} onClick={load}>
              Retry
            </Button>
          </ErrorNotice>
        )}
        {view && (
          <>
            <div className="flex items-center gap-lg">
              <QuorumPips
                count={view.approvals.length}
                required={view.requiredApprovals}
              />
              <span className="type-body">
                Provider holds {view.approvals.length} of{" "}
                {view.requiredApprovals} signatures
              </span>
            </div>
            <ul className="flex flex-col rounded-inset surface-inset px-xl">
              {view.eligibleApproverIds.map((id) => {
                const a = view.approvals.find((x) => x.approverId === id)
                return (
                  <li
                    key={id}
                    className="flex flex-col gap-xs rule-dotted-b py-lg last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <Mono>{id}</Mono>
                    {a ? (
                      <span className="type-caption">
                        Signed <Mono>{a.signedAt}</Mono> ·{" "}
                        <Mono>{a.providerSignatureRef}</Mono>
                      </span>
                    ) : (
                      <span className="type-caption">Not signed</span>
                    )}
                  </li>
                )
              })}
            </ul>
            <p className="type-body text-body-sm">
              ResearchVault currently shows{" "}
              <strong className="font-medium">
                {appCount} of {view.requiredApprovals}
              </strong>{" "}
              verified. Signatures here reach the app only when a governance
              admin syncs provider state.
            </p>
            {!eligible && (
              <p className="type-body text-body-sm">
                {user?.id} is not an eligible approver for this change.
              </p>
            )}
            {signed && user?.id === "head-01" && (
              <p className="type-body text-body-sm">
                head-01 signed as proposer.
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

function ChangePanel() {
  const { user, version } = useSession()
  void version
  const [busy, setBusy] = useState<"propose" | "sync" | null>(null)
  const [error, setError] = useState<{
    action: "propose" | "sync"
    error: ApiError
  } | null>(null)
  const [syncNote, setSyncNote] = useState<string | null>(null)
  const [consoleOpen, setConsoleOpen] = useState(false)

  const requests = vault.listAccessRequests(STUDY_ID)
  const request = requests[0]
  const change = request?.governanceChangeId
    ? vault.listChanges().find((c) => c.id === request.governanceChangeId)
    : undefined
  if (!user) return null

  if (!request) {
    return (
      <Card className="flex flex-col gap-lg">
        <Eyebrow>Governed changes</Eyebrow>
        <Heading size="md">No access requests awaiting governance</Heading>
        <p className="type-body text-body-sm max-w-prose">
          When assistant-01 requests restricted scope it appears here as
          request-001. Switch to assistant-01, or choose the “change-001
          awaiting quorum” scenario in the fixture banner.
        </p>
      </Card>
    )
  }

  const propose = async () => {
    setBusy("propose")
    setError(null)
    const r = await vault.proposeGovernedChange(request.id)
    setBusy(null)
    if (!r.ok) setError({ action: "propose", error: r.error })
  }

  const sync = async () => {
    if (!change) return
    setBusy("sync")
    setError(null)
    setSyncNote(null)
    const before = change.approvals.length
    const r = await vault.syncProviderStatus(change.id)
    setBusy(null)
    if (!r.ok) return setError({ action: "sync", error: r.error })
    const after = r.data.approvals.length
    setSyncNote(
      r.data.status === "COMMITTED"
        ? `Verified ${after}/${r.data.requiredApprovals}. change-001 committed; assistant-01 must refresh access.`
        : after > before
          ? `Verified ${after}/${r.data.requiredApprovals}. New provider signature imported.`
          : `Verified ${after}/${r.data.requiredApprovals}. No new provider signatures.`,
    )
  }

  const endpoint = change
    ? `POST /api/governance/changes/${change.id}/sync`
    : "POST /api/governance/changes/:changeId/sync"

  return (
    <Card className="flex flex-col gap-2xl">
      <div className="flex flex-wrap items-center justify-between gap-lg">
        <div className="flex flex-col gap-md">
          <Eyebrow>Governed change</Eyebrow>
          <Heading size="md">
            {request.id}
            {change && ` · ${change.id}`}
          </Heading>
        </div>
        <StatusPill
          status={request.status}
          detail={
            request.status === "PENDING_GOVERNANCE"
              ? approvalsLabel(change)
              : request.status === "COMMITTED" || request.status === "ACTIVE"
                ? `(${change?.approvals.length}/${change?.requiredApprovals})`
                : undefined
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-2xl xl:grid-cols-2">
        <DefinitionRows
          rows={[
            { term: "Request", value: <Mono>{request.id}</Mono> },
            { term: "Requester", value: <Mono>{request.requesterId}</Mono> },
            {
              term: "Scope",
              value: <Mono>READ RESTRICTED · {request.scope.studyId}</Mono>,
            },
            {
              term: "Context record",
              value: <Mono>{request.scope.contextRecordId}</Mono>,
            },
            { term: "Reason", value: request.reason },
          ]}
        />
        <DefinitionRows
          rows={[
            {
              term: "Change",
              value: change ? <Mono>{change.id}</Mono> : "Not proposed",
            },
            { term: "Provider", value: "TIDE_QEA" },
            {
              term: "Approvals",
              value: (
                <span className="flex flex-wrap items-center gap-md">
                  <QuorumPips
                    count={change?.approvals.length ?? 0}
                    required={STUDY.quorum.required}
                  />
                  {change?.approvals.length ?? 0} of {STUDY.quorum.required}{" "}
                  required approvals
                </span>
              ),
            },
            {
              term: "Last verified",
              value: change ? <Mono>{change.lastVerifiedAt}</Mono> : "—",
            },
            { term: "Sync endpoint", value: <Mono>{endpoint}</Mono> },
          ]}
        />
      </div>

      {error && (
        <ErrorNotice
          error={error.error}
          title={
            error.action === "sync"
              ? "Sync failed · app state unchanged"
              : "Proposal not submitted"
          }
        >
          <Button
            size="sm"
            variant="ink"
            icon={RefreshCw}
            loading={busy === error.action}
            onClick={error.action === "sync" ? sync : propose}
          >
            Retry
          </Button>
        </ErrorNotice>
      )}
      {syncNote && !error && (
        <p
          role="status"
          className="rounded-inset rule-solid border-accent bg-accent-wash px-xl py-lg type-body text-body-sm break-words"
        >
          {syncNote}
        </p>
      )}

      <div className="flex flex-col gap-lg rule-dotted-t pt-xl">
        <div className="flex flex-wrap gap-md">
          {request.status === "REQUESTED" && (
            <Button
              variant="primary"
              icon={Stamp}
              loading={busy === "propose"}
              disabled={user.role !== "HEAD_RESEARCHER"}
              onClick={propose}
            >
              Propose governed change
            </Button>
          )}
          {change && (
            <>
              <Button
                variant="ink"
                icon={ExternalLink}
                onClick={() => setConsoleOpen(true)}
              >
                Open Tide approval console
              </Button>
              <Button
                variant="outline"
                icon={RefreshCw}
                loading={busy === "sync"}
                onClick={sync}
              >
                Sync provider status
              </Button>
            </>
          )}
        </div>
        <p className="type-caption max-w-prose">
          {request.status === "REQUESTED" && user.role !== "HEAD_RESEARCHER"
            ? "Only head-01 can propose. Proposing records the first provider approval."
            : "Counts above are app-verified. ResearchVault never increments approvals or activates scope locally; it copies provider state only through a verified sync."}
        </p>
      </div>

      {change && (
        <TideConsole
          changeId={change.id}
          isOpen={consoleOpen}
          onClose={() => setConsoleOpen(false)}
        />
      )}
    </Card>
  )
}

function GovernanceConsole() {
  const { version } = useSession()
  void version
  const requests = vault.listAccessRequests(STUDY_ID)
  const pending = requests.filter((r) => r.status !== "ACTIVE").length
  const request = requests[0]
  const change = request?.governanceChangeId
    ? vault.listChanges().find((c) => c.id === request.governanceChangeId)
    : undefined

  return (
    <div className="flex w-full min-w-0 flex-col gap-section">
      <PageHeader
        eyebrow={`Governance · ${STUDY.title}`}
        title="QUORUM CONSOLE"
        badge={
          <StatusPill
            status={request?.status ?? "LOCKED"}
            detail={
              request?.status === "PENDING_GOVERNANCE"
                ? approvalsLabel(change)
                : undefined
            }
          />
        }
      >
        Restricted scope changes need {STUDY.quorum.required} of{" "}
        {STUDY.quorum.total} verified governance signatures. Highly restricted
        identity data can never be granted through this console.
      </PageHeader>
      <StatCards pending={pending} />
      <div className="grid grid-cols-1 gap-2xl lg:grid-cols-12 lg:items-start">
        <ScrollRevealCard className="lg:col-span-4">
          <ClearanceSidebar />
        </ScrollRevealCard>
        <div className="flex min-w-0 flex-col gap-2xl lg:col-span-8">
          <ScrollRevealCard delay={0.08}>
            <ChangePanel />
          </ScrollRevealCard>
          <ScrollRevealCard delay={0.16}>
            <TeamGrid change={change} />
          </ScrollRevealCard>
        </div>
      </div>
      <ScrollRevealCard>
        <StudyTeamsPanel />
      </ScrollRevealCard>
    </div>
  )
}

export function Governance() {
  return (
    <Gate
      roles={["HEAD_RESEARCHER", "DATA_STEWARD", "ETHICS_REPRESENTATIVE"]}
      workspace="Governance"
      requirement="/governance requires a head researcher, data steward or ethics representative session."
    >
      <GovernanceConsole />
    </Gate>
  )
}
