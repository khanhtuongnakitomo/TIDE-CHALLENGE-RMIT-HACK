import { useState } from "react"
import { useParams } from "react-router"
import { ArrowLeft, ArrowRight, KeyRound, RotateCcw } from "lucide-react"
import type { ApiError } from "@/lib/contracts"
import { useSession } from "@/app/session"
import { fixedRestrictedScope, vault } from "@/lib/fixtureAdapter"
import { Gate } from "@/components/gates"
import {
  AccessProgress,
  GrantList,
  RefreshAccessNotice,
  RequestAccessModal,
  approvalsLabel,
  useRestrictedRequest,
} from "@/components/access"
import {
  ButtonLink,
  CalderaPillButton,
  Card,
  DefinitionRows,
  ErrorNotice,
  Eyebrow,
  Heading,
  Mono,
  PageHeader,
  QuorumPips,
  StatusPill,
} from "@/components/ui"

function PermissionsView() {
  const { studyId = "" } = useParams()
  const { user } = useSession()
  const [modalOpen, setModalOpen] = useState(false)
  // Assistants see their own request; the head researcher reviews the study's.
  const { request, change } = useRestrictedRequest(
    user?.role === "RESEARCH_ASSISTANT" ? user.id : undefined,
  )
  const study = vault.getStudy(studyId)
  if (!user) return null

  if (!study.ok) {
    const error: ApiError = {
      ...study.error,
      correlationId: `cor-404-${studyId.slice(0, 16)}`,
    }
    return (
      <Card className="flex flex-col gap-xl">
        <Heading size="lg">Study not found</Heading>
        <ErrorNotice error={error} />
        <ButtonLink
          to="/researcher"
          variant="outline"
          size="sm"
          icon={ArrowLeft}
          className="self-start"
        >
          Back to research workspace
        </ButtonLink>
      </Card>
    )
  }

  const isRequester = user.role === "RESEARCH_ASSISTANT"
  const scope = fixedRestrictedScope()

  return (
    <div className="flex w-full min-w-0 flex-col gap-section">
      <div className="flex flex-col gap-2xl">
        <ButtonLink
          to="/researcher"
          variant="outline"
          size="sm"
          icon={ArrowLeft}
          className="self-start"
        >
          Research workspace
        </ButtonLink>
        <PageHeader
          eyebrow={`Permissions · ${study.data.title}`}
          title="RESTRICTED SCOPE"
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
          {isRequester
            ? "Track your request for READ on RESTRICTED data. Every stage is driven by verified provider state."
            : "Read-only view of the assistant request. Propose and sync it from the governance console."}
        </PageHeader>
      </div>

      {request?.status === "COMMITTED" && isRequester && (
        <RefreshAccessNotice request={request} />
      )}

      <Card className="flex flex-col gap-2xl" aria-labelledby="progress-h">
        <Heading id="progress-h" size="lg">
          Progression
        </Heading>
        <AccessProgress request={request} change={change} />
        <div className="grid grid-cols-1 gap-2xl lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-md rounded-inset surface-inset p-2xl">
            <Eyebrow>Scope · fixed</Eyebrow>
            <DefinitionRows
              rows={Object.entries(scope).map(([k, v]) => ({
                term: k,
                value: <Mono>{`"${v}"`}</Mono>,
              }))}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-md rounded-inset surface-inset p-2xl">
            <Eyebrow>Request</Eyebrow>
            {request ? (
              <DefinitionRows
                rows={[
                  { term: "Request", value: <Mono>{request.id}</Mono> },
                  {
                    term: "Requester",
                    value: <Mono>{request.requesterId}</Mono>,
                  },
                  { term: "Reason", value: request.reason },
                  { term: "Created", value: <Mono>{request.createdAt}</Mono> },
                  {
                    term: "Governed change",
                    value: change ? (
                      <Mono>{change.id}</Mono>
                    ) : (
                      "Awaiting proposal by head-01"
                    ),
                  },
                  {
                    term: "Verified approvals",
                    value: change ? (
                      <span className="flex flex-wrap items-center gap-md">
                        <QuorumPips
                          count={change.approvals.length}
                          required={change.requiredApprovals}
                        />
                        {change.approvals.length} of {change.requiredApprovals}{" "}
                        required approvals
                      </span>
                    ) : (
                      "0 of 2 required approvals"
                    ),
                  },
                  {
                    term: "Correlation",
                    value: <Mono>{request.correlationId}</Mono>,
                  },
                ]}
              />
            ) : (
              <p className="rule-dotted-t pt-lg type-body text-body-sm break-words">
                No request yet. record-coded-001 returns 403 MISSING_SCOPE until
                one is committed and activated.
              </p>
            )}
          </div>
        </div>
        {isRequester && (
          <div className="flex flex-col gap-lg rule-dotted-t pt-xl sm:flex-row sm:flex-wrap sm:items-center">
            {!request ? (
              <CalderaPillButton
                label="Request access"
                icon={KeyRound}
                onClick={() => setModalOpen(true)}
              />
            ) : (
              <>
                {request.status === "ACTIVE" && (
                  <ButtonLink
                    to="/researcher"
                    variant="ink"
                    iconEnd={ArrowRight}
                  >
                    Open coded record
                  </ButtonLink>
                )}
                <CalderaPillButton
                  label="Submit again"
                  variant="secondary"
                  size="sm"
                  icon={RotateCcw}
                  arrow={false}
                  onClick={() => setModalOpen(true)}
                />
                <p className="min-w-0 type-caption">
                  Duplicates are rejected by the API with 409
                  REQUEST_ALREADY_PENDING.
                </p>
              </>
            )}
          </div>
        )}
        {!isRequester && user.isGovernanceAdmin && (
          <ButtonLink
            to="/governance"
            variant="ink"
            size="sm"
            iconEnd={ArrowRight}
            className="self-start"
          >
            Open governance console
          </ButtonLink>
        )}
      </Card>

      <Card className="flex flex-col gap-lg" aria-labelledby="grants-h">
        <Eyebrow>
          Your authorization · <Mono>{user.id}</Mono> · v
          {user.authorizationVersion}
        </Eyebrow>
        <Heading id="grants-h" size="sm">
          Current grants
        </Heading>
        <GrantList grants={user.grants} />
        <p className="type-caption">
          HIGHLY_RESTRICTED is never requestable here. record-identity-001 stays
          compartmentalized for every research role.
        </p>
      </Card>

      <RequestAccessModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  )
}

export function Permissions() {
  return (
    <Gate
      roles={["RESEARCH_ASSISTANT", "HEAD_RESEARCHER"]}
      workspace="Study permissions"
      requirement="Study permissions require a research role on the study."
    >
      <PermissionsView />
    </Gate>
  )
}
