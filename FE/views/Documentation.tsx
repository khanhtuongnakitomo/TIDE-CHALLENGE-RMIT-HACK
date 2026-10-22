import type { ReactNode } from "react"
import { ArrowRight } from "lucide-react"
import type { ApiErrorCode } from "@/lib/contracts"
import { useSession } from "@/app/session"
import { ROLE_DEFAULT_ROUTE, ROLE_TITLE } from "@/lib/policy"
import {
  ButtonLink,
  Card,
  DefinitionRows,
  Eyebrow,
  Heading,
  Mono,
  PageHeader,
} from "@/components/ui"

const SECTIONS = [
  ["what", "What this demo is"],
  ["tidecloak", "TideCloak & Tide MCP plan"],
  ["roles", "Roles & routes"],
  ["tiers", "Clearance tiers"],
  ["quorum", "2-of-3 quorum"],
  ["teams", "Studies & teams"],
  ["sessions", "Sessions"],
  ["errors", "Error codes"],
  ["limits", "Security limits"],
] as const

const TIDECLOAK_ROLE_CLAIM: Record<keyof typeof ROLE_TITLE, string> = {
  PARTICIPANT: "participant",
  RESEARCH_ASSISTANT: "research_assistant",
  HEAD_RESEARCHER: "head_researcher",
  DATA_STEWARD: "data_steward",
  ETHICS_REPRESENTATIVE: "ethics_representative",
}

const TIDE_LAYERS = [
  {
    layer: "1. Sign-In & RFC 9449 DPoP Sender-Constrained Auth",
    where:
      "TideCloak OIDC issues a JWT bound to the browser's ephemeral ECDSA P-256 keypair via cnf.jkt. src/lib/auth/tideJWT.ts and src/lib/auth/verifyDpop.ts verify the JWKS signature, ath token hash, htm/htu request binding, and jti replay protection.",
    simulated:
      "POST /api/demo/login and the Sign In view simulate TideCloak authentication for the 5 study-wellbeing-01 personas, setting an HttpOnly SameSite=Strict session cookie and enforcing 30-minute session expiry.",
  },
  {
    layer: "2. Client Roles & Access Checks (resource_access)",
    where:
      "TideCloak maps realm/client roles in resource_access['researchvault-web'].roles (participant, research_assistant, head_researcher, data_steward, ethics_representative) to route guards and API capabilities.",
    simulated:
      "FE/lib/policy.ts and src/lib/server.ts enforce the exact same role and capability checks on every route and /api/* endpoint, returning 401 SESSION_REQUIRED, 403 ACCESS_DENIED, or 403 MISSING_SCOPE with audit correlation IDs.",
  },
  {
    layer: "3. IGA · 2-of-3 Quorum-Enforced Authority (QEA)",
    where:
      "TideCloak Identity Governance & Administration holds RESTRICTED role/scope grants in a draft change-set until 2 of 3 governance admins sign, then requires the requester to refresh their token.",
    simulated:
      "POST /api/access-requests/:id/propose and /approve enforce distinct 2-of-3 governance signatures in SQLite (request_approvals), block self-approval (SELF_APPROVAL_FORBIDDEN), and require explicit Sync Authorization before unlocking.",
  },
  {
    layer: "4. Policy-Bound Encryption (RelationshipAttestation:1)",
    where:
      "src/lib/tide/shared-vault.ts binds record ciphertexts to study-wellbeing-01:<CATEGORY> tags and verifies a threshold-signed Forseti RelationshipAttestation:1 contract before Tide's Ork enclave releases keys.",
    simulated:
      "GET /api/records/:recordId verifies SQLite quorum and ownership policies before decrypting real AES-256-GCM ciphertext stored in the SQLite records table.",
  },
]

const ROLES: { role: keyof typeof ROLE_TITLE; routes: string; can: string }[] = [
  {
    role: "PARTICIPANT",
    routes: "/user",
    can: "See and decrypt only your own records; enroll with a participant access token.",
  },
  {
    role: "RESEARCH_ASSISTANT",
    routes: "/researcher, /researcher/studies/:id/permissions, /evidence",
    can: "Work on studies you are a team member of; request restricted scope; join teams.",
  },
  {
    role: "HEAD_RESEARCHER",
    routes: "/governance, /researcher, /evidence",
    can: "Create studies, issue invitations and participant tokens, approve join requests, propose governed changes.",
  },
  {
    role: "DATA_STEWARD",
    routes: "/governance, /evidence",
    can: "Sign or withhold governed changes as a governance admin.",
  },
  {
    role: "ETHICS_REPRESENTATIVE",
    routes: "/governance, /evidence",
    can: "Sign or withhold governed changes as a governance admin.",
  },
]

const ERRORS: [ApiErrorCode, string][] = [
  [
    "SESSION_REQUIRED",
    "401 · No session. You are sent to sign in and returned afterwards.",
  ],
  [
    "SESSION_EXPIRED",
    "401 · The 30-minute session ended. Decrypted plaintext was purged.",
  ],
  [
    "INVALID_CREDENTIALS",
    "401 · Identity or password did not match. No hint about which.",
  ],
  [
    "ACCESS_DENIED",
    "403 · Your role or team membership does not cover this route or record.",
  ],
  [
    "MISSING_SCOPE",
    "403 · The record needs a scope your authorization does not include.",
  ],
  ["VALIDATION_FAILED", "422 · A field is missing or malformed."],
  ["CONFLICT", "409 · Duplicate, e.g. a study code or email already in use."],
  [
    "REQUEST_ALREADY_PENDING",
    "409 · You already have an open request or membership.",
  ],
  [
    "INVALID_INVITATION",
    "422 · Invitation code unknown, used, revoked or expired.",
  ],
  ["INVALID_ACCESS_TOKEN", "422 · Participant token unknown, used or expired."],
  [
    "WRONG_CODE_TYPE",
    "422 · A team code was used for enrollment, or a token for joining.",
  ],
  ["NOT_FOUND", "404 · The study or record does not exist."],
  [
    "PERSISTENCE_FAILED",
    "503 · Browser storage refused the write; nothing changed.",
  ],
  ["TIDE_UNAVAILABLE", "503 · Simulated provider outage."],
  [
    "PROVIDER_STATE_UNVERIFIED",
    "502 · Simulated provider returned a state that could not be verified.",
  ],
]

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      className="flex scroll-mt-section flex-col gap-xl"
    >
      <Heading id={`${id}-h`} size="lg">
        {title}
      </Heading>
      {children}
    </section>
  )
}

const P = ({ children }: { children: ReactNode }) => (
  <p className="max-w-prose type-body text-body text-ink-muted">{children}</p>
)

export function Documentation() {
  const { user } = useSession()
  const simulatedClaims = user
    ? {
        iss: "http://localhost:8080/realms/researchvault-local",
        sub: user.id,
        azp: "researchvault-web",
        preferred_username: user.email,
        cnf: { jkt: `dpop-sha256-${user.id}` },
        resource_access: {
          "researchvault-web": {
            roles: [
              TIDECLOAK_ROLE_CLAIM[user.role],
              ...(user.grants.some((g) => g.category === "RESTRICTED")
                ? ["restricted_Composite"]
                : []),
            ],
          },
        },
        tide_forseti_contract: "RelationshipAttestation:1",
        grants: user.grants,
      }
    : null

  return (
    <div className="flex w-full min-w-0 flex-col gap-section">
      <PageHeader
        eyebrow="Documentation"
        title="HOW THE VAULT WORKS"
        actions={
          <ButtonLink
            to={user ? ROLE_DEFAULT_ROUTE[user.role] : "/login"}
            variant="primary"
            iconEnd={ArrowRight}
          >
            {user ? "Open My Workspace" : "Get Started / Sign In"}
          </ButtonLink>
        }
      >
        Built as though TideCloak protects every layer, planned with Tide's MCP,
        and backed by a connected Next.js + SQLite + AES-256-GCM simulation while
        TideCloak's live realm bootstrap is unavailable.
      </PageHeader>

      <div className="grid grid-cols-1 gap-2xl lg:grid-cols-12 lg:items-start">
        <nav
          aria-label="On this page"
          className="lg:sticky lg:top-section lg:col-span-3"
        >
          <Card surface="outline" as="div" className="flex flex-col gap-md">
            <Eyebrow>On this page</Eyebrow>
            <ul className="flex flex-col gap-sm">
              {SECTIONS.map(([id, label]) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="type-body text-body-sm underline-offset-2 hover:underline"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        </nav>

        <div className="flex min-w-0 flex-col gap-section lg:col-span-9">
          <Section id="what" title="What this demo is">
            <P>
              ResearchVault is built as though TideCloak protects every route,
              role, quorum decision, and encrypted record. In accordance with
              the organizer fallback guidance when TideCloak is unavailable, we
              used Tide's MCP (<Mono>Raziel</Mono> architectural playbooks) to
              design and wire the full 4-layer TideCloak architecture in{" "}
              <Mono>src/lib/auth/</Mono> and <Mono>src/lib/tide/</Mono>, while
              simulating TideCloak's sign-in, roles, and access checks against
              our live Next.js + SQLite + AES-256-GCM backend.
            </P>
            <P>
              The seeded study is <Mono>study-wellbeing-01</Mono> with five demo
              identities: <Mono>participant-01</Mono>, <Mono>assistant-01</Mono>
              , <Mono>head-01</Mono>, <Mono>steward-01</Mono> and{" "}
              <Mono>ethics-01</Mono>. You can switch personas from the sign-in
              page or the top-right <Mono>Demo controls</Mono> menu.
            </P>
          </Section>

          <Section id="tidecloak" title="TideCloak & Tide MCP plan">
            <P>
              Each security boundary is planned via Tide's MCP and implemented
              with a clean adapter boundary so that live TideCloak and the local
              simulation enforce the exact same policies:
            </P>
            <ul className="grid grid-cols-1 gap-xl">
              {TIDE_LAYERS.map((item) => (
                <li key={item.layer}>
                  <Card as="div" className="flex flex-col gap-md">
                    <Heading as="h3" size="sm">
                      {item.layer}
                    </Heading>
                    <p className="type-body text-body-sm">
                      <strong>Where TideCloak fits (Tide MCP plan):</strong>{" "}
                      {item.where}
                    </p>
                    <p className="type-body text-body-sm text-ink-muted">
                      <strong>Simulated right now:</strong> {item.simulated}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
            {simulatedClaims && (
              <Card surface="outline" as="div" className="flex flex-col gap-md">
                <Eyebrow>
                  Active Simulated TideCloak JWT Claims ({user?.id})
                </Eyebrow>
                <pre className="overflow-x-auto type-mono text-caption text-ink">
                  {JSON.stringify(simulatedClaims, null, 2)}
                </pre>
              </Card>
            )}
          </Section>

          <Section id="roles" title="Roles & routes">
            <P>
              Every workspace route is protected centrally. Signed-out visitors
              are sent to sign in; signed-in users outside a route's roles get a
              403 “Not in your scope” page and the attempt is logged.
            </P>
            <ul className="grid grid-cols-1 gap-xl md:grid-cols-2">
              {ROLES.map((r) => (
                <li key={r.role}>
                  <Card as="div" className="flex h-full flex-col gap-md">
                    <Heading as="h3" size="sm">
                      {ROLE_TITLE[r.role]}
                    </Heading>
                    <p className="type-caption text-ink-muted">
                      TideCloak role:{" "}
                      <Mono>{TIDECLOAK_ROLE_CLAIM[r.role]}</Mono> · Lands on{" "}
                      <Mono>{ROLE_DEFAULT_ROUTE[r.role]}</Mono> · may open{" "}
                      <Mono>{r.routes}</Mono>
                    </p>
                    <p className="type-body text-body-sm">{r.can}</p>
                  </Card>
                </li>
              ))}
            </ul>
          </Section>

          <Section id="tiers" title="Clearance tiers">
            <DefinitionRows
              rows={[
                { term: "Public", value: "Study title and summary." },
                {
                  term: "Internal",
                  value: "Protocol and coding frame. Every active team member.",
                },
                {
                  term: "Restricted",
                  value:
                    "Coded transcripts. The owning participant and head researcher; others only through a committed 2-of-3 governed change.",
                },
                {
                  term: "Highly restricted",
                  value:
                    "Identity records. Owner-only. No role, quorum or change can grant it.",
                },
              ]}
            />
          </Section>

          <Section id="quorum" title="2-of-3 quorum">
            <P>
              Restricted scope changes need two of three governance admin
              signatures (head researcher, data steward, ethics representative).
              The requester is never an approver. After the change commits the
              requester must refresh their authorization before records unlock.
              The policy is fixed for every study, including new ones; a newly
              created study starts with its creator as the only governance
              admin, so no change can commit there in this demo.
            </P>
          </Section>

          <Section id="teams" title="Studies & teams">
            <P>
              A head researcher creates a study with a title and a unique
              lower-case code such as <Mono>study-sleep-02</Mono>; the code
              becomes the study ID. The creator is the first team member.
            </P>
            <P>
              Researchers join in one of two ways. Entering a study ID sends a
              join request that stays pending until the head researcher approves
              it. Entering a team invitation code (
              <Mono>XXXX-XXXX-XXXX-XXXX</Mono>) joins immediately. Codes are
              single-use, expire after 7 days, are shown once and stored only as
              a SHA-256 hash. Joining never grants restricted data.
            </P>
            <P>
              Participants enroll separately with a participant access token (
              <Mono>PTK-XXXX-XXXX-XXXX</Mono>). Enrollment is consent to
              contribute and never gives research or governance rights.
            </P>
          </Section>

          <Section id="sessions" title="Sessions">
            <P>
              Sessions last 30 minutes and are checked on a timer and when the
              tab regains focus. Signing out, signing in as someone else,
              resetting the scenario or expiry purges decrypted plaintext and
              the active study before anything else renders. Registered
              passwords are hashed with PBKDF2-SHA-256 (120,000 iterations).
            </P>
          </Section>

          <Section id="errors" title="Error codes">
            <P>
              Every error shows its code and a correlation ID you can find in
              the evidence log.
            </P>
            <DefinitionRows
              rows={ERRORS.map(([code, text]) => ({ term: code, value: text }))}
            />
          </Section>

          <Section id="limits" title="Security limits">
            <P>
              In local simulation mode, TideCloak's external OIDC and Ork key
              network are simulated while SQLite persistence, role/quorum policy
              checks, and AES-256-GCM record encryption run locally on the
              Next.js backend (<Mono>/api/*</Mono>). Do not enter real
              participant data or real passwords. Setting{" "}
              <Mono>APP_AUTH_MODE=live</Mono> switches the backend to verify
              live TideCloak JWKS tokens and RFC 9449 DPoP proofs.
            </P>
          </Section>
        </div>
      </div>
    </div>
  )
}
