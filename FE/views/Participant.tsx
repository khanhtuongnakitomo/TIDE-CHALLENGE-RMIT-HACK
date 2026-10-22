import { useState, type ReactNode } from "react"
import {
  EyeOff,
  Fingerprint,
  LockKeyhole,
  ScrollText,
  ShieldCheck,
  Unlock,
} from "lucide-react"
import type { ApiError, ClearanceLevel, RecordSummary } from "@/lib/contracts"
import { useSession } from "@/app/session"
import { vault } from "@/lib/fixtureAdapter"
import { CODED_RECORD_ID, IDENTITY_RECORD_ID, STUDY_ID } from "@/lib/fixtures"
import { Gate } from "@/components/gates"
import { EnrollmentPanel } from "@/components/teams"
import { ScrollRevealCard } from "@/components/ScrollRevealCard"
import { RecordPlaintext } from "@/components/RecordContent"
import {
  CalderaPillButton,
  Card,
  CategoryBadge,
  DefinitionRows,
  ErrorNotice,
  Eyebrow,
  Heading,
  Mono,
  PageHeader,
  StatusPill,
  Tag,
  TierGlyph,
  TIER_CODE,
  TIER_LABEL,
  TIER_TONE,
} from "@/components/ui"

function OwnRecordCard({
  record,
  icon: Icon,
  className,
  children,
}: {
  record: RecordSummary
  icon: typeof Fingerprint
  className?: string
  children?: ReactNode
}) {
  const { decrypted, decrypt, lockRecord } = useSession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)
  const envelope = decrypted[record.id]
  const identity = record.category === "HIGHLY_RESTRICTED"
  const headingId = `rec-${record.id}`

  const open = async () => {
    setBusy(true)
    setError(null)
    setError(await decrypt(record.id))
    setBusy(false)
  }

  return (
    <Card
      surface={identity ? "elevated" : "card"}
      as="article"
      lift
      aria-labelledby={headingId}
      className={`flex flex-col gap-2xl ${className ?? ""}`}
    >
      <div className="flex items-start justify-between gap-xl">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-lg">
          <CategoryBadge category={record.category} />
          <Heading id={headingId} size="md">
            RECORD: <span className="break-words">{record.id}</span>
          </Heading>
          <p className="type-body text-body-lg">{record.title}</p>
        </div>
        <Icon className="size-8 shrink-0" aria-hidden />
      </div>
      <p className="w-full type-body text-body-sm break-words">
        {record.description}
      </p>
      <DefinitionRows
        onDark={identity}
        rows={[
          { term: "Owner", value: <Mono>{record.ownerParticipantId}</Mono> },
          {
            term: "Who else can read",
            value: identity
              ? "No one. Owner-only and compartmentalized from every research and governance role."
              : "head-01 by baseline. assistant-01 only through a committed 2/3 governed change.",
          },
        ]}
      />
      {error && <ErrorNotice error={error} />}
      {envelope ? (
        <div className="flex w-full min-w-0 flex-col gap-xl rounded-inset surface-inset p-2xl">
          <RecordPlaintext envelope={envelope} onDark={identity} />
          <CalderaPillButton
            label="Hide and purge plaintext"
            size="sm"
            variant="secondary"
            onDark={identity}
            icon={EyeOff}
            arrow={false}
            className="self-start"
            onClick={() => lockRecord(record.id)}
          />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-lg">
          <StatusPill status="LOCKED" />
          <CalderaPillButton
            label="Decrypt my record"
            size="sm"
            variant={identity ? "primary" : "dark"}
            icon={Unlock}
            loading={busy}
            onClick={open}
          />
        </div>
      )}
      {children}
    </Card>
  )
}

/** Plain-language summary of the existing permission model for this participant. */
function SharingScope({
  quorum,
  assistantActive,
}: {
  quorum: { required: number; total: number }
  assistantActive: boolean
}) {
  const points = [
    "Your coded interview is RESTRICTED. You and head-01 can read it by baseline.",
    `assistant-01 can read it only after a ${quorum.required}-of-${quorum.total} governance quorum commits a change and assistant-01 refreshes their authorization.`,
    assistantActive
      ? "That governed change is active now: assistant-01 can read the coded transcript."
      : "No governed change is active: assistant-01 cannot read the coded transcript today.",
    "Your identity mapping is HIGHLY RESTRICTED and owner-only. It is kept separate from the coded record, and no role, quorum or governed change grants it to research assistants.",
    "Every denied decrypt attempt is recorded in the evidence log with a correlation ID.",
  ]
  return (
    <section
      aria-labelledby="sharing-h"
      className="w-full min-w-0 rounded-inset surface-inset p-2xl"
    >
      <Heading id="sharing-h" as="h3" size="sm" className="mb-lg">
        Sharing scope
      </Heading>
      <ul className="flex w-full flex-col">
        {points.map((p) => (
          <li
            key={p}
            className="flex gap-lg rule-dotted-b py-md last:border-b-0"
          >
            <span
              className="mt-md size-2 shrink-0 rounded-pill bg-accent"
              aria-hidden
            />
            <span className="min-w-0 flex-1 whitespace-normal break-words text-left type-body text-body-sm">
              {p}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ParticipantWorkspace() {
  const { user, version } = useSession()
  void version
  if (!user) return null
  const enrolledSeed = vault
    .listMyEnrollments()
    .some((e) => e.studyId === STUDY_ID)
  const study = vault.getStudy(STUDY_ID)
  const records = vault.listRecords(STUDY_ID)
  const requests = vault.listAccessRequests(STUDY_ID)
  const coded = records.ok
    ? records.data.find(
        (r) => r.id === CODED_RECORD_ID && r.ownerParticipantId === user.id,
      )
    : undefined
  const identity = records.ok
    ? records.data.find(
        (r) => r.id === IDENTITY_RECORD_ID && r.ownerParticipantId === user.id,
      )
    : undefined
  // Registered participants own no seeded records: show enrollment only.
  if (!enrolledSeed || !study.ok || !coded || !identity)
    return (
      <div className="flex w-full min-w-0 flex-col gap-section">
        <PageHeader
          eyebrow="Participant workspace"
          title="MY CONTRIBUTION"
          badge={<Tag>PARTICIPANT ROLE</Tag>}
        >
          <p>
            Signed in as <Mono>{user.id}</Mono>. No records have been
            contributed under this identity yet; the study team adds them after
            you enroll.
          </p>
        </PageHeader>
        <ScrollRevealCard>
          <EnrollmentPanel />
        </ScrollRevealCard>
      </div>
    )
  const s = study.data
  const assistantActive = requests.some(
    (r) => r.requesterId === "assistant-01" && r.status === "ACTIVE",
  )

  const tiers: { level: ClearanceLevel; who: string; note: string }[] = [
    {
      level: 2,
      who: "You · assistant-01 · head-01",
      note: "Study protocol and coding frame.",
    },
    {
      level: 3,
      who: assistantActive
        ? "You · head-01 · assistant-01 (governed change)"
        : "You · head-01",
      note: "Your coded transcript. New readers need a committed 2/3 governance quorum.",
    },
    {
      level: 4,
      who: "You only",
      note: "Your identity record. Compartmentalized; cannot be granted.",
    },
  ]

  return (
    <div className="flex w-full min-w-0 flex-col gap-section">
      <PageHeader
        eyebrow={`Participant workspace · ${s.title}`}
        title="MY CONTRIBUTION"
        badge={<Tag>PARTICIPANT ROLE · OWNER</Tag>}
      >
        <p>{s.summary}</p>
        <p className="mt-lg flex flex-wrap items-center gap-md type-body text-body-sm">
          <StatusPill status="ACTIVE" detail="· study" />
          <span>
            Signed in as <Mono>{user.id}</Mono> · pseudonym P-01
          </span>
        </p>
      </PageHeader>

      <ScrollRevealCard className="grid grid-cols-1 gap-2xl lg:grid-cols-12">
        <OwnRecordCard
          record={coded}
          icon={ScrollText}
          className="lg:col-span-7"
        >
          <SharingScope quorum={s.quorum} assistantActive={assistantActive} />
        </OwnRecordCard>
        <div className="flex min-w-0 flex-col gap-2xl lg:col-span-5">
          <OwnRecordCard record={identity} icon={Fingerprint} />
          <Card as="aside" aria-labelledby="study-h">
            <Heading id="study-h" size="sm" className="mb-md">
              Study details
            </Heading>
            <DefinitionRows
              rows={[
                { term: "Study", value: <Mono>{s.id}</Mono> },
                {
                  term: "Head researcher",
                  value: <Mono>{s.headResearcherId}</Mono>,
                },
                {
                  term: "Quorum rule",
                  value: `${s.quorum.required} of ${s.quorum.total} governance admins`,
                },
                { term: "Ethics ref", value: s.ethicsReference },
                { term: "Enrolled", value: <Mono>{s.enrolledAt}</Mono> },
              ]}
            />
          </Card>
        </div>
      </ScrollRevealCard>

      <ScrollRevealCard>
        <EnrollmentPanel />
      </ScrollRevealCard>

      <section aria-labelledby="tiers-h" className="flex flex-col gap-2xl">
        <Heading id="tiers-h" size="lg">
          Three clearance levels on your data
        </Heading>
        <div className="grid grid-cols-1 gap-2xl md:grid-cols-3">
          {tiers.map((t, i) => (
            <ScrollRevealCard key={t.level} delay={i * 0.08}>
            <Card as="div" className="flex h-full flex-col gap-xl">
              <div className={`flex items-center gap-md ${TIER_TONE[t.level]}`}>
                <TierGlyph level={t.level} className="size-6 shrink-0" />
                <Eyebrow>Tier {TIER_CODE[t.level]}</Eyebrow>
              </div>
              <Heading as="h3" size="sm">
                {TIER_LABEL[t.level]}
              </Heading>
              <p className="type-body text-body-sm text-ink-muted">{t.note}</p>
              <p className="mt-auto rule-dotted-t pt-lg type-body text-body-sm">
                {t.who}
              </p>
            </Card>
            </ScrollRevealCard>
          ))}
        </div>
      </section>

      <ScrollRevealCard>
      <Card
        surface="quantum"
        className="grid grid-cols-1 gap-2xl md:grid-cols-[auto_minmax(0,1fr)] md:items-start"
      >
        <ShieldCheck className="size-10" aria-hidden />
        <div className="flex min-w-0 flex-col gap-lg">
          <Heading size="lg">
            Governance cannot silently expose your identity
          </Heading>
          <p className="w-full max-w-prose type-body text-body break-words">
            Governance cannot silently expose highly restricted identity data to
            assistants. L3 Highly Restricted is owner-only: there is no role,
            quorum or governed change that grants it, and every denied attempt
            is written to the evidence log with a correlation ID.
          </p>
          <p className="flex items-start gap-md type-body text-body-sm">
            <LockKeyhole className="mt-xs size-5 shrink-0" aria-hidden />
            <span className="min-w-0">
              Revocation and consent changes go through the study team; this
              preview does not simulate them.
            </span>
          </p>
        </div>
      </Card>
      </ScrollRevealCard>
    </div>
  )
}

export function Participant() {
  return (
    <Gate
      roles={["PARTICIPANT"]}
      workspace="Participant workspace"
      requirement="/user requires a participant session."
    >
      <ParticipantWorkspace />
    </Gate>
  )
}
