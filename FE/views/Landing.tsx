import { ArrowRight, ArrowUpRight, BookOpen, Users } from "lucide-react"
import { cn } from "@/components/kit"
import type { ClearanceLevel } from "@/lib/contracts"
import { useSession } from "@/app/session"
import { ROLE_DEFAULT_ROUTE } from "@/lib/policy"
import { vault } from "@/lib/fixtureAdapter"
import { ScrollRevealCard } from "@/components/ScrollRevealCard"
import {
  ButtonLink,
  Card,
  Eyebrow,
  Heading,
  QUORUM_TERM,
  RevealHeading,
  Tag,
  TIER_TONE,
  TierGlyph,
  tierName,
} from "@/components/ui"

const STEPS = [
  {
    n: "01",
    title: "CONTRIBUTE",
    body: "Participants contribute interviews. Each record is sealed to a payload tier before it leaves the device.",
  },
  {
    n: "02",
    title: "REQUEST SCOPE",
    body: "Researchers ask for a study-category scope with a stated reason. Denials come back as explicit 403s, never silent gaps.",
  },
  {
    n: "03",
    title: "QUORUM COMMIT",
    body: "Two of three governance admins sign on the Tide network. The app activates scope only after it verifies that state.",
  },
]

/**
 * Payload tiers, keyed by the app-wide ClearanceLevel so glyphs, labels and
 * colours match every other view. Display codes (L1–L3) come from tierName.
 */
const TIERS: { level: ClearanceLevel; detail: string }[] = [
  { level: 2, detail: "Study protocol · Unlocked." },
  { level: 3, detail: "Coded interview · 2-of-3 Quorum required." },
  { level: 4, detail: "Identity mapping · Owner only." },
]

const PARTICIPANT_POINTS = [
  "Coded transcript · L2 Restricted",
  "Identity record · L3 Highly Restricted, owner only",
  "Every access in the evidence log",
]

const GOVERNANCE_POINTS = [
  "3 payload tiers",
  "2 of 3 governance quorum",
  "Provider state verified before activation",
]

/** Halftone Matrix feature card: the three payload tiers plus the quorum layer. */
function TierCard() {
  return (
    <aside
      id="security"
      aria-label="Cryptographic security: clearance tiers"
      className="scroll-mt-3xl halftone flex min-h-105 flex-col justify-between gap-2xl rounded-card p-xl sm:p-2xl md:p-3xl"
    >
      <Eyebrow>Clearance tiers · sealed per record</Eyebrow>
      <ol className="flex flex-col gap-md">
        {TIERS.map((t) => (
          <li
            key={t.level}
            data-tier={t.level === 3 ? "restricted" : undefined}
            className="flex items-start gap-lg rounded-inset halftone-panel p-xl"
          >
            <TierGlyph
              level={t.level}
              className={cn("mt-xs size-5 shrink-0", TIER_TONE[t.level])}
            />
            <span className="flex min-w-0 flex-col gap-xs">
              <span className="type-display text-display-sm">
                {tierName(t.level)}
              </span>
              <span className="type-body text-body-sm text-ink-muted">
                {t.detail}
              </span>
            </span>
          </li>
        ))}
        {/* Governance layer, not a data tier: drawn as an outlined row. */}
        <li
          data-kind="governance"
          className="flex items-start gap-lg rounded-inset halftone-panel p-xl"
        >
          <Users className="mt-xs size-5 shrink-0 text-quorum" aria-hidden />
          <span className="flex min-w-0 flex-col gap-xs">
            <span className="type-display text-display-sm">{QUORUM_TERM}</span>
            <span className="type-body text-body-sm">
              Governance layer · 2 of 3 admins commit. Not a payload tier.
            </span>
          </span>
        </li>
      </ol>
    </aside>
  )
}

function PointList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col">
      {items.map((line) => (
        <li key={line} className="rule-dotted-t py-md type-body text-body-sm">
          {line}
        </li>
      ))}
    </ul>
  )
}

export function Landing() {
  const { user } = useSession()

  return (
    <div className="flex flex-col gap-card">
      {/* Hero */}
      <section
        id="platform"
        aria-label="Platform overview"
        className="scroll-mt-3xl grid items-center gap-2xl lg:grid-cols-12">
        <ScrollRevealCard className="flex flex-col items-start lg:col-span-7">
          <Tag tone="sulfur" className="mb-2xl">
            SYNTHETIC DATA PROTOTYPE ·{" "}
            {vault.isBackendConnected() ? "LOCAL SIMULATION" : "FIXTURE AUTH"}
          </Tag>
          <RevealHeading
            text="RESEARCH TOGETHER. KEEP PARTICIPANT DATA UNDER CONTROLLED ACCESS."
            highlight="CONTROLLED ACCESS."
            className="type-display text-display-3xl text-ink"
          />
          <p className="mt-2xl mb-3xl max-w-prose type-body text-body-lg text-ink-muted">
            ResearchVault keeps every interview end-to-end encrypted. Who can
            read what is decided by clearance tiers and a 2-of-3 governance
            quorum on the Tide network.
          </p>
          <div className="flex flex-wrap items-center gap-xl">
            {user ? (
              <ButtonLink
                to={ROLE_DEFAULT_ROUTE[user.role]}
                variant="primary"
                iconEnd={ArrowUpRight}
              >
                Open My Workspace
              </ButtonLink>
            ) : (
              <ButtonLink to="/login" variant="primary" iconEnd={ArrowRight}>
                Get Started / Sign In
              </ButtonLink>
            )}
            <ButtonLink
              to="/documentation"
              variant="surface"
              iconEnd={ArrowUpRight}
            >
              Explore Documentation
            </ButtonLink>
          </div>
        </ScrollRevealCard>
        <ScrollRevealCard delay={0.12} className="lg:col-span-5">
          <TierCard />
        </ScrollRevealCard>
      </section>

      {/* Role entry */}
      <div className="grid grid-cols-1 gap-2xl md:grid-cols-2">
        <ScrollRevealCard>
        <Card as="article" lift className="flex h-full flex-col justify-between gap-2xl">
          <div className="flex flex-col items-start">
            <Tag tone="sulfur">For participants</Tag>
            <Heading size="lg" className="mt-xl mb-lg">
              Your record, your key
            </Heading>
            <p className="mb-2xl max-w-(--container-md) type-body text-body text-ink-muted">
              See which tier each of your records sits in, who can reach it, and
              why identity data never leaves your control.
            </p>
            <div className="self-stretch">
              <PointList items={PARTICIPANT_POINTS} />
            </div>
          </div>
          <div className="flex flex-wrap gap-lg">
            <ButtonLink to="/login" variant="surface" iconEnd={ArrowRight}>
              Sign in as a participant
            </ButtonLink>
          </div>
        </Card>
        </ScrollRevealCard>

        <ScrollRevealCard delay={0.08}>
        <Card
          as="article"
          surface="frame"
          lift
          className="flex h-full flex-col justify-between gap-2xl"
        >
          <div className="flex flex-col items-start">
            <Tag>For research &amp; governance</Tag>
            <Heading size="lg" className="mt-xl mb-lg">
              Scope by quorum, not by admin
            </Heading>
            <p className="mb-2xl max-w-(--container-md) type-body text-body text-ink">
              Assistants request restricted scope. The head researcher proposes,
              a steward or ethics representative co-signs, and access activates
              only after a verified sync and a fresh authorization.
            </p>
            <div className="self-stretch">
              <PointList items={GOVERNANCE_POINTS} />
            </div>
          </div>
          <div className="flex flex-wrap gap-lg">
            <ButtonLink to="/login" variant="obsidian" iconEnd={ArrowUpRight}>
              Sign in to research
            </ButtonLink>
            <ButtonLink
              to="/documentation#quorum"
              variant="obsidian"
              icon={BookOpen}
            >
              How quorum works
            </ButtonLink>
          </div>
        </Card>
        </ScrollRevealCard>
      </div>

      {/* Workflow */}
      <ScrollRevealCard>
      <Card aria-label="How access works">
        <ol className="grid grid-cols-1 gap-2xl md:grid-cols-3 md:gap-3xl">
          {STEPS.map((s, i) => (
            <li
              key={s.n}
              className={
                i === 0
                  ? "flex flex-col gap-md"
                  : "flex flex-col gap-md rule-dotted-t pt-2xl md:border-t-0 md:rule-dotted-l md:pt-0 md:pl-3xl"
              }
            >
              <Heading as="h3" size="md">
                <span className="text-accent">{s.n}</span> / {s.title}
              </Heading>
              <p className="type-body text-body text-ink-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </Card>
      </ScrollRevealCard>
    </div>
  )
}
