import { useEffect, useState } from "react"
import {
  Ban,
  CircleCheck,
  Clock,
  Hexagon,
  RefreshCw,
  SquareTerminal,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react"
import { Tabs, cn } from "@/components/kit"
import type {
  ActivityEvent,
  ActivityResult,
  ApiError,
  ApiErrorCode,
} from "@/lib/contracts"
import { useSession } from "@/app/session"
import { vault } from "@/lib/fixtureAdapter"
import { Gate } from "@/components/gates"
import { ScrollRevealCard } from "@/components/ScrollRevealCard"
import { EVIDENCE_ROLES } from "@/lib/policy"
import {
  Button,
  Card,
  ErrorCode,
  ErrorNotice,
  Heading,
  Mono,
  PageHeader,
  Spinner,
  Tag,
} from "@/components/ui"

const RESULT: Record<ActivityResult, { icon: LucideIcon; className: string }> = {
  SUCCESS: {
    icon: CircleCheck,
    className: "bg-granted text-on-accent border-granted",
  },
  PENDING: {
    icon: Clock,
    className: "bg-accent-wash text-accent border-accent border-dashed",
  },
  DENIED: { icon: Ban, className: "text-ink border-outline" },
  ERROR: { icon: TriangleAlert, className: "surface-breach" },
}

function SourceBadge({ source }: { source: ActivityEvent["source"] }) {
  const tide = source === "TIDE_QEA"
  const Icon = tide ? Hexagon : SquareTerminal
  return (
    <span
      className={cn(
        "inline-flex items-center gap-xs rounded-pill rule-solid px-2.5 py-0.5 type-caption whitespace-nowrap",
        tide
          ? "bg-accent-wash text-accent border-accent"
          : "text-ink-muted border-outline",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {source}
    </span>
  )
}

function ResultCell({ event }: { event: ActivityEvent }) {
  const r = RESULT[event.result]
  const Icon = r.icon
  return (
    <span className="flex flex-col items-start gap-xs">
      <span
        className={cn(
          "inline-flex items-center gap-xs rounded-pill rule-solid px-2.5 py-0.5 type-caption whitespace-nowrap",
          r.className,
        )}
      >
        <Icon className="size-4" aria-hidden />
        {event.result}
      </span>
      {event.error && (
        <Mono>{`${event.error.status} ${event.error.code}`}</Mono>
      )}
    </span>
  )
}

const COLUMNS = [
  "Timestamp (UTC)",
  "Action",
  "Source",
  "Correlation ID",
  "Result",
] as const

function EvidenceTable({ events }: { events: ActivityEvent[] }) {
  if (!events.length)
    return (
      <p className="type-body text-body-sm py-xl">
        No events for this source yet.
      </p>
    )
  return (
    <>
      {/* Below lg: one stacked entry per event, same fields as the table. */}
      <ol
        className="flex flex-col lg:hidden"
        aria-label="Evidence log, newest first"
      >
        {events.map((e) => (
          <li
            key={e.id}
            className="flex flex-col gap-lg rule-dotted-b py-xl first:pt-0 last:border-b-0"
          >
            <div className="flex flex-wrap items-center justify-between gap-md">
              <Mono>{e.timestamp}</Mono>
              <SourceBadge source={e.source} />
            </div>
            <div className="flex min-w-0 flex-col gap-xs">
              <span className="type-body text-body-sm break-words">
                {e.summary}
              </span>
              <span className="type-caption text-ink-muted">
                by {e.actorId}
              </span>
            </div>
            <dl className="grid grid-cols-1 gap-lg sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-xs">
                <dt className="type-caption uppercase tracking-label text-ink-muted">
                  Correlation ID
                </dt>
                <dd className="min-w-0">
                  <Mono>{e.correlationId}</Mono>
                </dd>
              </div>
              <div className="flex min-w-0 flex-col gap-xs">
                <dt className="type-caption uppercase tracking-label text-ink-muted">
                  Result
                </dt>
                <dd>
                  <ResultCell event={e} />
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>

      <table className="hidden w-full table-fixed border-collapse text-left lg:table">
        <caption className="sr-only">Evidence log, newest first</caption>
        <colgroup>
          <col className="w-[18%]" />
          <col />
          <col className="w-[16%]" />
          <col className="w-[22%]" />
          <col className="w-[16%]" />
        </colgroup>
        <thead>
          <tr className="rule-dotted-b">
            {COLUMNS.map((h) => (
              <th
                key={h}
                scope="col"
                className="py-lg pr-xl type-caption uppercase tracking-label font-normal"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="rule-dotted-b align-top last:border-b-0">
              <td className="py-xl pr-xl">
                <Mono>{e.timestamp}</Mono>
              </td>
              <td className="py-xl pr-xl">
                <span className="flex min-w-0 flex-col gap-xs">
                  <span className="type-body text-body-sm break-words">
                    {e.summary}
                  </span>
                  <span className="type-caption text-ink-muted">
                    by {e.actorId}
                  </span>
                </span>
              </td>
              <td className="py-xl pr-xl">
                <SourceBadge source={e.source} />
              </td>
              <td className="py-xl pr-xl">
                <Mono>{e.correlationId}</Mono>
              </td>
              <td className="py-xl">
                <ResultCell event={e} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function LoadingRows() {
  return (
    <div className="flex flex-col gap-xl" aria-busy>
      <Spinner label="Loading evidence…" />
      <ul className="flex flex-col" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <li
            key={i}
            className="grid grid-cols-1 gap-md rule-dotted-b py-xl last:border-b-0 md:grid-cols-[1fr_3fr_1fr] md:gap-xl"
          >
            <span className="h-3 rounded-pill bg-ink-faint" />
            <span
              className="h-3 rounded-pill bg-ink-faint"
              style={{ width: `${90 - i * 9}%` }}
            />
            <span className="h-3 rounded-pill bg-ink-faint" />
          </li>
        ))}
      </ul>
    </div>
  )
}

const CODES: {
  status: ApiError["status"]
  code: ApiErrorCode
  meaning: string
}[] = [
  {
    status: 401,
    code: "SESSION_REQUIRED",
    meaning: "No session. Nothing is readable.",
  },
  {
    status: 403,
    code: "MISSING_SCOPE",
    meaning:
      "Authorization lacks the tier, or the record is compartmentalized.",
  },
  {
    status: 409,
    code: "REQUEST_ALREADY_PENDING",
    meaning: "A request for the same scope already exists.",
  },
  {
    status: 422,
    code: "VALIDATION_FAILED",
    meaning: "Reason missing or too short.",
  },
  {
    status: 502,
    code: "PROVIDER_STATE_UNVERIFIED",
    meaning: "Provider response failed verification; app unchanged.",
  },
  {
    status: 503,
    code: "TIDE_UNAVAILABLE",
    meaning: "Tide network unreachable; retry later.",
  },
]

function EvidenceLog() {
  const { user, version } = useSession()
  const [loading, setLoading] = useState(true)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => setLoading(false), 650)
    return () => clearTimeout(t)
  }, [nonce, user?.sessionId])

  void version
  const result = vault.listActivity()
  if (!user) return null
  if (!result.ok) return <ErrorNotice error={result.error} />
  const events = result.data
  const counts = (code: ApiErrorCode) =>
    events.filter((e) => e.error?.code === code).length
  const tabs = [
    {
      id: "all",
      label: `All · ${events.length}`,
      content: <EvidenceTable events={events} />,
    },
    ...(["APPLICATION", "TIDE_QEA"] as const).map((src) => {
      const list = events.filter((e) => e.source === src)
      return {
        id: src,
        label: `${src} · ${list.length}`,
        content: <EvidenceTable events={list} />,
      }
    }),
  ]

  return (
    <div className="flex w-full min-w-0 flex-col gap-section">
      <PageHeader
        eyebrow="Evidence · newest first"
        title="EVIDENCE LOG"
        badge={<Tag>{events.length} EVENTS</Tag>}
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            loading={loading}
            onClick={() => setNonce((n) => n + 1)}
          >
            Reload
          </Button>
        }
      >
        Every application decision and Tide QEA provider response, with the
        correlation ID that ties a denial back to its policy check.
      </PageHeader>

      <ScrollRevealCard>
        <Card className="flex flex-col gap-md">
          {loading ? <LoadingRows /> : <Tabs tabs={tabs} className="rv-tabs" />}
        </Card>
      </ScrollRevealCard>

      <ScrollRevealCard>
      <Card
        surface="elevated"
        className="flex flex-col gap-xl"
        aria-labelledby="codes-h"
      >
        <Heading id="codes-h" size="lg">
          Error reference
        </Heading>
        <ul className="grid grid-cols-1 gap-x-3xl md:grid-cols-2">
          {CODES.map((c) => (
            <li
              key={c.code}
              className="flex flex-col gap-md rule-dotted-b py-xl"
            >
              <span className="flex flex-wrap items-center gap-md">
                <ErrorCode error={c} />
                <span className="type-caption">{counts(c.code)} in log</span>
              </span>
              <span className="type-body text-body-sm">{c.meaning}</span>
            </li>
          ))}
        </ul>
      </Card>
      </ScrollRevealCard>
    </div>
  )
}

export function Evidence() {
  return (
    <Gate
      roles={EVIDENCE_ROLES}
      workspace="Evidence"
      requirement="/evidence requires a research staff or governance session."
    >
      <EvidenceLog />
    </Gate>
  )
}
