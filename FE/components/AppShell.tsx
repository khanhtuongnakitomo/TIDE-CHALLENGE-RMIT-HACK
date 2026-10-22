import { Fragment, useEffect, useId, useRef, useState } from "react"
import {
  Link,
  Outlet,
  ScrollRestoration,
  useLocation,
  useNavigate,
} from "react-router"
import {
  ArrowUpRight,
  ChevronDown,
  FlaskConical,
  Menu,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { IconButton, SelectField, cn } from "./kit"
import type {
  DirectoryFault,
  FixtureScenario,
  ProviderFault,
} from "@/lib/contracts"
import { vault } from "@/lib/fixtureAdapter"
import { ROLE_TITLE, navFor, type NavItem } from "@/lib/policy"
import { useSession } from "@/app/session"
import { Button, ButtonLink, Emblem } from "./ui"

const PUBLIC_NAV: NavItem[][] = [
  [
    { to: "/#platform", label: "Platform Overview" },
    { to: "/#security", label: "Cryptographic Security" },
  ],
  [{ to: "/documentation", label: "Documentation" }],
]

const SCENARIOS = [
  { value: "LOCKED", label: "Start: access locked" },
  { value: "AWAITING_QUORUM", label: "change-001 awaiting quorum" },
]

const FAULTS = [
  { value: "NONE", label: "Provider healthy" },
  { value: "TIDE_UNAVAILABLE", label: "Inject 503 TIDE_UNAVAILABLE" },
  {
    value: "PROVIDER_STATE_UNVERIFIED",
    label: "Inject 502 PROVIDER_STATE_UNVERIFIED",
  },
]

const DIRECTORY_FAULTS = [
  { value: "NONE", label: "Browser storage healthy" },
  { value: "PERSISTENCE_FAILED", label: "Inject 503 PERSISTENCE_FAILED" },
]

/* ---------------------------------------------------------------------------
 * Fixture banner: states plainly that authentication is simulated, shows the
 * demo session, and holds fixture controls. There is no persona switching
 * here; changing identity means signing out and signing in.
 * ------------------------------------------------------------------------- */

function DemoControls() {
  const { resetScenario } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) =>
      !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <Button
        size="sm"
        variant="surface"
        icon={SlidersHorizontal}
        iconEnd={ChevronDown}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        Demo controls
      </Button>
      {open && (
        <div
          id={panelId}
          role="group"
          aria-label="Fixture controls"
          className="absolute right-0 z-40 mt-md flex w-(--container-xs) max-w-[calc(100vw_-_var(--space-2xl)_*_2)] flex-col gap-lg rounded-inset surface-elevated p-xl"
        >
          <p className="type-eyebrow text-ink-muted">
            Fixture controls · no server contacted
          </p>
          <SelectField
            label="Scenario"
            options={SCENARIOS}
            value={vault.getScenario()}
            onChange={(v) => resetScenario(v as FixtureScenario)}
            description="Resetting keeps your session but purges decrypted data."
          />
          <SelectField
            label="Governance provider"
            options={FAULTS}
            value={vault.getFault()}
            onChange={(v) => vault.setFault(v as ProviderFault)}
          />
          <SelectField
            label="Demo directory"
            options={DIRECTORY_FAULTS}
            value={vault.getDirectoryFault()}
            onChange={(v) => vault.setDirectoryFault(v as DirectoryFault)}
          />
          <div className="rule-dotted-t pt-lg">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                vault.clearDemoDirectory()
                setOpen(false)
              }}
            >
              Clear demo accounts &amp; teams
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function FixtureBanner() {
  return (
    <div className="bg-inset text-ink rule-dotted-b">
      <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-x-lg gap-y-md px-xl py-md md:px-2xl">
        <p className="flex min-w-0 items-center gap-md type-body text-body-sm uppercase">
          <FlaskConical className="size-4 shrink-0 text-accent" aria-hidden />
          <span>
            Fixture auth · simulated TideCloak
            <span className="hidden md:inline"> · no server contacted</span>
          </span>
        </p>
        <DemoControls />
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Navbar
 * ------------------------------------------------------------------------- */

function Wordmark() {
  return (
    <Link
      to="/"
      className="flex shrink-0 items-center gap-md"
      aria-label="ResearchVault home"
    >
      <Emblem />
      <span className="type-display text-display-sm">ResearchVault</span>
    </Link>
  )
}

function useNavGroups(): NavItem[][] {
  const { user } = useSession()
  if (!user) return PUBLIC_NAV
  return [
    [{ to: "/", label: "Overview" }],
    navFor(user.role),
    [{ to: "/documentation", label: "Documentation" }],
  ]
}

function isCurrent(item: NavItem, pathname: string, hash: string) {
  const [path, anchor] = item.to.split("#")
  if (anchor) return pathname === path && hash === `#${anchor}`
  if (path === "/") return pathname === "/" && !hash
  return pathname === path || pathname.startsWith(`${path}/`)
}

function NavItems({
  onNavigate,
  vertical,
}: {
  onNavigate?: () => void
  vertical?: boolean
}) {
  const groups = useNavGroups()
  const { pathname, hash } = useLocation()
  return (
    <ul
      className={cn(
        "flex",
        vertical
          ? "flex-col gap-xs"
          : "flex-wrap items-center justify-center gap-xs rounded-pill bg-canvas rule-solid p-xs",
      )}
    >
      {groups.map((group, g) => (
        <Fragment key={g}>
          {g > 0 &&
            (vertical ? (
              <li aria-hidden className="my-xs rule-dotted-t" />
            ) : (
              <li aria-hidden className="mx-xs h-lg rule-dotted-l" />
            ))}
          {group.map((item) => {
            const current = isCurrent(item, pathname, hash)
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={onNavigate}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "block rounded-pill px-xl py-md type-body text-body-sm whitespace-nowrap transition-colors duration-(--duration-slot) ease-forge",
                    current
                      ? "bg-accent text-on-accent"
                      : "text-ink-muted hover:bg-ink-faint hover:text-ink",
                    vertical && "py-lg text-body",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </Fragment>
      ))}
    </ul>
  )
}

function SessionActions({ onDone }: { onDone?: () => void }) {
  const { user, signOut } = useSession()
  const navigate = useNavigate()
  if (!user)
    return (
      <>
        <ButtonLink to="/login" size="sm" variant="surface" onClick={onDone}>
          Sign In
        </ButtonLink>
        <ButtonLink
          to="/register"
          size="sm"
          variant="primary"
          iconEnd={ArrowUpRight}
          onClick={onDone}
        >
          Register Now
        </ButtonLink>
      </>
    )
  // "Demo" because sign-in is simulated; never labelled "Verified".
  return (
    <>
      <p
        className="inline-flex min-w-0 items-center gap-md rounded-pill rule-solid px-lg py-xs type-id text-ink break-words"
        aria-label={`Demo session: ${user.id}, ${ROLE_TITLE[user.role]}`}
      >
        <span className="size-dot shrink-0 rounded-pill bg-granted" aria-hidden />
        <span aria-hidden>
          DEMO SESSION · {user.id} · {ROLE_TITLE[user.role]}
        </span>
      </p>
    <Button
      size="sm"
      variant="outline"
      iconEnd={ArrowUpRight}
      onClick={() => {
        onDone?.()
        signOut()
        navigate("/login", { replace: true, state: { notice: "SIGNED_OUT" } })
      }}
    >
      Sign Out
    </Button>
    </>
  )
}

/**
 * Toggles data-floating on the header once the page scrolls past 40px.
 * Writes the DOM attribute directly inside rAF, so scrolling never
 * re-renders React and the attribute only changes when the state flips.
 */
function useFloatingNav() {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let frame = 0
    const update = () => {
      frame = 0
      const floating = String(window.scrollY > 40)
      if (el.dataset.floating !== floating) el.dataset.floating = floating
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
  return ref
}

function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()
  const ref = useFloatingNav()
  useEffect(() => setMobileOpen(false), [pathname])
  return (
    <header
      ref={ref}
      className="rv-nav sticky top-xl z-40 mx-auto mt-2xl w-full max-w-page px-xl md:px-2xl"
    >
      {/* Tablet: wordmark + actions on one row, the nav pill wraps below.
          Desktop: one dark pill. Phone: nav moves behind the menu button. */}
      <div className="rv-nav__bar flex flex-wrap items-center justify-between gap-md rounded-card surface-elevated p-md pl-xl xl:flex-nowrap xl:rounded-pill">
        <Wordmark />
        <nav
          aria-label="Primary"
          className="order-last hidden w-full md:block xl:order-none xl:w-auto"
        >
          <NavItems />
        </nav>
        <div className="flex items-center gap-md">
          <div className="hidden items-center gap-md sm:flex">
            <SessionActions />
          </div>
          <IconButton
            className="md:hidden text-ink border-outline"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMobileOpen((o) => !o)}
            icon={
              mobileOpen ? (
                <X className="size-5" aria-hidden />
              ) : (
                <Menu className="size-5" aria-hidden />
              )
            }
          />
        </div>
      </div>
      {mobileOpen && (
        <nav
          id="mobile-nav"
          aria-label="Primary"
          className="mt-md flex max-h-[calc(100dvh-var(--spacing-section))] flex-col gap-lg overflow-y-auto rounded-card surface-elevated p-lg md:hidden"
        >
          <NavItems vertical onNavigate={() => setMobileOpen(false)} />
          <div className="flex flex-wrap gap-md rule-dotted-t px-xs pt-lg sm:hidden">
            <SessionActions onDone={() => setMobileOpen(false)} />
          </div>
        </nav>
      )}
    </header>
  )
}

function Footer() {
  return (
    <footer className="mx-auto w-full max-w-page px-xl pb-3xl md:px-2xl">
      <div className="flex flex-col gap-2xl rounded-card surface-elevated p-2xl md:flex-row md:items-center md:justify-between md:p-card">
        <p className="type-display text-display-lg" aria-hidden>
          ResearchVault
        </p>
        <div className="flex flex-col gap-xs md:items-end md:text-right">
          <p className="type-body text-body-sm">
            Caldera Edition · fixture adapter · synthetic data only
          </p>
          <p className="type-body text-body-sm text-ink-muted">
            Sign-in and governance are simulated in this browser. No TideCloak
            or Tide QEA server is contacted.
          </p>
        </div>
      </div>
    </footer>
  )
}

/** Scroll to in-page anchors such as /#security after navigation. */
function useHashScroll() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) return
    const el = document.getElementById(decodeURIComponent(hash.slice(1)))
    el?.scrollIntoView({ block: "start" })
  }, [pathname, hash])
}

export function AppShell() {
  const { user } = useSession()
  useHashScroll()
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-canvas text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-md focus:left-md focus:z-50 focus:rounded-pill focus:bg-accent focus:px-xl focus:py-md focus:text-on-accent"
      >
        Skip to content
      </a>
      <FixtureBanner />
      <Header />
      <main
        id="main"
        className="mx-auto w-full max-w-page flex-1 px-xl py-3xl md:px-2xl"
      >
        {/* Keyed by session: every view-local cache starts empty per session. */}
        <Outlet key={user?.sessionId ?? "signed-out"} />
      </main>
      <Footer />
      <ScrollRestoration />
    </div>
  )
}
