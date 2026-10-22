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
  ["roles", "Roles & routes"],
  ["tiers", "Clearance tiers"],
  ["quorum", "2-of-3 quorum"],
  ["teams", "Studies & teams"],
  ["sessions", "Sessions"],
  ["errors", "Error codes"],
  ["limits", "Security limits"],
] as const

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
        A fixture-backed demonstration of governed research-data access. This
        page describes exactly what the demo does and does not do.
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
              Everything runs in your browser. Sign-in is a simulated TideCloak
              flow against a local fixture directory: no request reaches a real
              identity provider, Tide network or server. Demo accounts, studies,
              teams, invitations and enrollments are saved in this browser's
              local storage and can be cleared from the demo controls.
            </P>
            <P>
              The seeded study is <Mono>study-wellbeing-01</Mono> with five demo
              identities: <Mono>participant-01</Mono>, <Mono>assistant-01</Mono>
              , <Mono>head-01</Mono>, <Mono>steward-01</Mono> and{" "}
              <Mono>ethics-01</Mono>. Demo sign-in buttons appear only on the
              sign-in page in fixture mode.
            </P>
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
                      Lands on <Mono>{ROLE_DEFAULT_ROUTE[r.role]}</Mono> · may
                      open <Mono>{r.routes}</Mono>
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
              This is not a security boundary. All checks run in client code
              that a user can modify, browser storage is readable by anyone with
              the device, and “encryption” and signatures are simulated. Do not
              enter real participant data or real passwords. A production build
              would enforce these rules on a server and on the Tide network.
            </P>
          </Section>
        </div>
      </div>
    </div>
  )
}
