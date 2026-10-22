import { useState } from "react"
import { Link } from "react-router"
import { ArrowRight, EyeOff, KeyRound, ShieldAlert, Unlock } from "lucide-react"
import type { AccessRequest, ApiError, RecordSummary } from "@/lib/contracts"
import { useSession } from "@/app/session"
import { vault } from "@/lib/fixtureAdapter"
import { STUDY_ID } from "@/lib/fixtures"
import { Gate } from "@/components/gates"
import { RecordPlaintext } from "@/components/RecordContent"
import {
  GrantList,
  RefreshAccessNotice,
  RequestAccessModal,
  approvalsLabel,
  useRestrictedRequest,
} from "@/components/access"
import { JoinTeamPanel } from "@/components/teams"
import { ScrollRevealCard } from "@/components/ScrollRevealCard"
import {
  Button,
  ButtonLink,
  CalderaPillButton,
  Card,
  CategoryBadge,
  ErrorCode,
  ErrorNotice,
  Eyebrow,
  Heading,
  Mono,
  PageHeader,
  StatusPill,
  Tag,
  TierGlyph,
  TIER_TONE,
  tierName,
} from "@/components/ui"

export const PERMISSIONS_PATH = `/researcher/studies/${STUDY_ID}/permissions`

function RecordCard({
  record,
  quorum,
  onRequest,
}: {
  record: RecordSummary
  quorum: { required: number; total: number }
  onRequest: () => void
}) {
  const { user, decrypted, decrypt, lockRecord } = useSession()
  const { request, change } = useRestrictedRequest(user?.id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const envelope = decrypted[record.id]
  const isCodedForRequester =
    record.category === "RESTRICTED" && user?.role === "RESEARCH_ASSISTANT"
  const headingId = `rec-${record.id}`

  const attempt = async () => {
    setBusy(true)
    setError(null)
    setError(await decrypt(record.id))
    setBusy(false)
  }

  return (
    <Card
      as="article"
      lift
      aria-labelledby={headingId}
      className={`flex flex-col gap-xl ${
        envelope ? "md:col-span-2 xl:col-span-3" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-lg">
        <CategoryBadge category={record.category} />
        <span
          className="grid size-12 shrink-0 place-items-center rounded-pill surface-inset"
          aria-hidden
        >
          <TierGlyph
            level={record.level}
            className={`size-6 ${TIER_TONE[record.level]}`}
          />
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-md">
        <Mono className="text-ink-muted">{record.id}</Mono>
        <Heading as="h3" size="sm" id={headingId}>
          {record.title}
        </Heading>
        <p className="type-body text-body-sm break-words text-ink-muted">
          {record.description}
        </p>
        <p className="type-caption">{tierName(record.level)}</p>
      </div>

      {record.denial && (
        <div className="flex flex-col gap-md rounded-inset surface-inset p-xl">
          <ErrorCode error={record.denial} />
          <p className="type-body text-body-sm break-words">
            {record.denial.compartmentalized
              ? "Owner-only. Stays locked even with restricted scope; no governed change can grant it."
              : `Plaintext is not loaded. Reading it needs a governed change approved by a ${quorum.required}-of-${quorum.total} governance quorum.`}
          </p>
        </div>
      )}

      {error && (
        <ErrorNotice error={error} title="Decryption refused by policy" />
      )}

      {envelope && (
        <div className="w-full min-w-0 rounded-inset surface-inset p-2xl">
          <RecordPlaintext envelope={envelope} />
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-md rule-dotted-t pt-xl">
        {record.access === "UNLOCKED" && (
          <>
            {isCodedForRequester && request?.status === "ACTIVE" && (
              <StatusPill status="ACTIVE" detail="· governed" />
            )}
            <StatusPill status="UNLOCKED" />
            {envelope ? (
              <CalderaPillButton
                label="Hide"
                size="sm"
                variant="secondary"
                icon={EyeOff}
                arrow={false}
                onClick={() => lockRecord(record.id)}
              />
            ) : (
              <CalderaPillButton
                label="Decrypt"
                size="sm"
                variant="dark"
                icon={Unlock}
                loading={busy}
                onClick={attempt}
              />
            )}
          </>
        )}
        {record.access === "LOCKED" && (
          <>
            <StatusPill status="LOCKED" />
            {isCodedForRequester && request && (
              <StatusPill
                status={request.status}
                detail={
                  request.status === "PENDING_GOVERNANCE"
                    ? approvalsLabel(change)
                    : request.status === "COMMITTED"
                      ? `(${change?.approvals.length}/${change?.requiredApprovals})`
                      : undefined
                }
              />
            )}
            {isCodedForRequester && !request && (
              <CalderaPillButton
                label="Request access"
                size="sm"
                icon={KeyRound}
                onClick={onRequest}
              />
            )}
            {isCodedForRequester && request && (
              <ButtonLink
                size="sm"
                variant="outline"
                to={PERMISSIONS_PATH}
                iconEnd={ArrowRight}
              >
                View request
              </ButtonLink>
            )}
          </>
        )}
        {record.access === "COMPARTMENTALIZED" && (
          <StatusPill status="COMPARTMENTALIZED" />
        )}
        {record.denial && (
          <CalderaPillButton
            label="Attempt decrypt"
            size="sm"
            variant="secondary"
            icon={ShieldAlert}
            arrow={false}
            loading={busy}
            onClick={attempt}
          />
        )}
      </div>
    </Card>
  )
}

function ResearchWorkspace() {
  const { user, version } = useSession()
  void version
  const [modalOpen, setModalOpen] = useState(false)
  const [created, setCreated] = useState<AccessRequest | null>(null)
  const { request } = useRestrictedRequest(user?.id)
  const { activeStudyId, setActiveStudyId } = useSession()
  if (!user) return null
  // Only studies where this identity holds an active team seat.
  const studies = vault.listMyStudies()
  const current =
    studies.find((s) => s.id === activeStudyId) ?? studies[0] ?? null
  if (!current)
    return (
      <div className="flex w-full min-w-0 flex-col gap-section">
        <PageHeader
          eyebrow="Research workspace"
          title="STUDY RECORDS"
          badge={<Tag>{user.roleLabel.toUpperCase()}</Tag>}
        >
          <p className="type-body text-body-sm">
            <Mono>{user.id}</Mono> is not on any study team yet, so no records
            are visible.
          </p>
        </PageHeader>
        <ScrollRevealCard>
          <JoinTeamPanel onJoined={setActiveStudyId} />
        </ScrollRevealCard>
      </div>
    )
  const study = { ok: true as const, data: current }
  const records = vault.listRecords(current.id)
  const isSeeded = current.id === STUDY_ID

  return (
    <div className="flex w-full min-w-0 flex-col gap-section">
      <PageHeader
        eyebrow={`Research workspace · ${study.data.title}`}
        title="STUDY RECORDS"
        badge={<Tag>{user.roleLabel.toUpperCase()}</Tag>}
        actions={
          isSeeded && (
            <ButtonLink
              to={PERMISSIONS_PATH}
              variant="outline"
              size="sm"
              iconEnd={ArrowRight}
            >
              Permissions and requests
            </ButtonLink>
          )
        }
      >
        <p className="type-body text-body-sm">
          <Mono>{study.data.id}</Mono> · session <Mono>{user.sessionId}</Mono> ·
          authorization v{user.authorizationVersion}
        </p>
      </PageHeader>

      {studies.length > 1 && (
        <nav aria-label="Your studies" className="flex flex-wrap gap-md">
          {studies.map((s) => (
            <Button
              key={s.id}
              size="sm"
              variant={s.id === current.id ? "primary" : "outline"}
              aria-current={s.id === current.id ? "true" : undefined}
              onClick={() => setActiveStudyId(s.id)}
            >
              {s.id}
            </Button>
          ))}
        </nav>
      )}

      {request?.status === "COMMITTED" && (
        <RefreshAccessNotice request={request} />
      )}
      {created && request?.status === "REQUESTED" && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-md rounded-card surface-card p-2xl"
        >
          <StatusPill status="REQUESTED" />
          <span className="min-w-0 type-body text-body-sm break-words">
            <Mono>{created.id}</Mono> submitted. The head researcher proposes it
            as a governed change next.
          </span>
        </div>
      )}

      <ScrollRevealCard>
      <section aria-labelledby="records-h" className="flex flex-col gap-2xl">
        <div className="flex flex-wrap items-baseline justify-between gap-lg">
          <Heading id="records-h" size="lg">
            Records
          </Heading>
          <span className="type-body text-body-sm">
            {records.ok ? records.data.length : 0} in study
          </span>
        </div>
        {records.ok && records.data.length === 0 ? (
          <Card surface="outline">
            <p className="type-body text-body-sm">
              No records in {current.id} yet.
            </p>
          </Card>
        ) : records.ok ? (
          <div className="grid grid-cols-1 gap-2xl md:grid-cols-2 xl:grid-cols-3">
            {records.data.map((r) => (
              <RecordCard
                key={r.id}
                record={r}
                quorum={study.data.quorum}
                onRequest={() => setModalOpen(true)}
              />
            ))}
          </div>
        ) : (
          <ErrorNotice error={records.error} />
        )}
      </section>
      </ScrollRevealCard>

      <ScrollRevealCard>
      <Card
        as="aside"
        aria-labelledby="grants-h"
        className="flex flex-col gap-lg"
      >
        <Eyebrow>
          Your authorization · <Mono>{user.id}</Mono>
        </Eyebrow>
        <Heading id="grants-h" size="sm">
          Grants in this authorization
        </Heading>
        <GrantList grants={user.grants} />
      </Card>
      </ScrollRevealCard>

      {user.role === "RESEARCH_ASSISTANT" && (
        <ScrollRevealCard>
          <JoinTeamPanel onJoined={setActiveStudyId} />
        </ScrollRevealCard>
      )}

      <p className="type-caption">
        Locked records never receive ciphertext or plaintext in this view. Read
        the full policy trail on{" "}
        <Link to="/evidence" className="underline underline-offset-2">
          the evidence log
        </Link>
        .
      </p>

      <RequestAccessModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={setCreated}
      />
    </div>
  )
}

export function Researcher() {
  return (
    <Gate
      roles={["RESEARCH_ASSISTANT", "HEAD_RESEARCHER"]}
      workspace="Research workspace"
      requirement="/researcher requires a research assistant or head researcher session."
    >
      <ResearchWorkspace />
    </Gate>
  )
}
