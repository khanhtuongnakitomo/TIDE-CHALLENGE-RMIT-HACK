import type {
  AccessRequest,
  AccessScope,
  ActivityEvent,
  ApiError,
  ApiErrorCode,
  ApiResult,
  AuthMethod,
  CurrentUser,
  DirectoryFault,
  FixtureScenario,
  GovernanceApproval,
  GovernanceChange,
  Grant,
  Identity,
  IdentityId,
  IssuedSecret,
  ParticipantEnrollment,
  PersonaId,
  ProviderChangeView,
  ProviderFault,
  RecordEnvelope,
  RecordSummary,
  RegistrationInput,
  Role,
  RosterEntry,
  Study,
  StudyMembership,
  TeamInvitation,
} from "./contracts"
import {
  CATEGORY_LEVEL,
  CODED_RECORD_ID,
  PERSONAS,
  RECORDS,
  SEALED,
  SEED_ACTIVITY,
  SEED_ENROLLMENTS,
  SEED_MEMBERSHIPS,
  STUDY,
  STUDY_ID,
  isPersonaId,
  personaById,
  type RecordSeed,
} from "./fixtures"
import {
  clearDirectory,
  loadDirectory,
  loadSession,
  saveDirectory,
  saveSession,
  type Directory,
  type StoredIdentity,
  type StoredSession,
} from "./directory"
import {
  digestsEqual,
  hashPassword,
  normalizeCode,
  randomCode,
  randomHex,
  sha256,
} from "./secrets"
import {
  ROLE_LABEL,
  normalizeStudyCode,
  validateRegistration,
  validateStudyInput,
} from "./validation"
import { canViewEvidence } from "./policy"

/* ---------------------------------------------------------------------------
 * Fixture adapter. Two deliberately separate stores:
 *   app      — what ResearchVault has verified and enforces
 *   provider — what the simulated Tide QEA network holds
 * Provider-side signatures never touch app state until an explicit sync.
 *
 * Authentication is simulated (FIXTURE AUTH · SIMULATED TIDECLOAK): no server
 * is contacted. The demo directory (registered accounts, teams, invitations,
 * enrollments) persists in this browser; see lib/directory.
 * ------------------------------------------------------------------------- */

interface AppState {
  session: StoredSession | null
  authVersions: Record<IdentityId, number>
  /** Grants added to an identity's authorization through committed governed changes. */
  governedGrants: Record<IdentityId, Grant[]>
  requests: AccessRequest[]
  changes: GovernanceChange[]
  activity: ActivityEvent[]
}

interface ProviderChange {
  changeId: string
  requestId: string
  approvals: GovernanceApproval[]
  requiredApprovals: number
  eligibleApproverIds: IdentityId[]
}

interface ProviderState {
  changes: Record<string, ProviderChange>
  fault: ProviderFault
}

const REQUIRED_APPROVALS = STUDY.quorum.required
const LATENCY = { fast: 260, provider: 620 }
export const SESSION_TTL_MS = 30 * 60 * 1000
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const TEAM_PREFIX = "TEAM"
const TOKEN_PREFIX = "PTK"
/** Reserved: never mint this identifier for a new study. */
const RESERVED_STUDY_IDS = new Set(["study-protocol-001"])

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const now = () => new Date().toISOString()
const hex = (len: number) =>
  Array.from({ length: len }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("")

let seq = 0
const correlationId = () => `cor-${hex(4)}-${String(++seq).padStart(4, "0")}`
const signatureRef = () => `tide:sig:${hex(6)}`

const ok = <T>(data: T): ApiResult<T> => ({ ok: true, data })
const fail = <T,>(
  status: ApiError["status"],
  code: ApiErrorCode,
  message: string,
  extra: Partial<ApiError> = {},
): ApiResult<T> => ({
  ok: false,
  error: { status, code, message, correlationId: correlationId(), ...extra },
})

/** Grants a study role carries on its own study. Never includes HIGHLY_RESTRICTED. */
function roleBaseline(role: StudyMembership["studyRole"], studyId: string): Grant[] {
  const g = (category: Grant["category"]): Grant => ({
    category,
    scope: "STUDY",
    studyId,
    source: "BASELINE",
  })
  if (role === "HEAD_RESEARCHER") return [g("INTERNAL"), g("RESTRICTED")]
  if (role === "RESEARCH_ASSISTANT") return [g("INTERNAL")]
  return []
}

/** Enrolled participants read the study protocol plus their own records only. */
function participantBaseline(studyId: string): Grant[] {
  return [
    { category: "INTERNAL", scope: "STUDY", studyId, source: "BASELINE" },
    { category: "RESTRICTED", scope: "OWN_RECORDS", studyId, source: "BASELINE" },
    {
      category: "HIGHLY_RESTRICTED",
      scope: "OWN_RECORDS",
      studyId,
      source: "BASELINE",
    },
  ]
}

const personaIdentity = (id: PersonaId): Identity => {
  const p = personaById(id)
  return {
    id: p.id,
    email: p.email,
    displayName: p.displayName,
    role: p.role,
    roleLabel: p.roleLabel,
    isGovernanceAdmin: p.isGovernanceAdmin,
    kind: "FIXTURE_PERSONA",
    createdAt: STUDY.createdAt,
  }
}

const storedIdentity = (s: StoredIdentity): Identity => ({
  id: s.id,
  email: s.email,
  displayName: s.displayName,
  role: s.role,
  roleLabel: ROLE_LABEL[s.role],
  isGovernanceAdmin: false,
  kind: "REGISTERED",
  createdAt: s.createdAt,
})

const invitationView = ({ codeHash: _hash, ...rest }: TeamInvitation & {
  codeHash: string
}): TeamInvitation =>
  rest.status === "ACTIVE" && Date.parse(rest.expiresAt) <= Date.now()
    ? { ...rest, status: "EXPIRED" }
    : rest

class FixtureAdapter {
  readonly mode = "fixture" as const
  private app!: AppState
  private provider!: ProviderState
  private directory: Directory = loadDirectory()
  private directoryFault: DirectoryFault = "NONE"
  private scenario: FixtureScenario = "LOCKED"
  private listeners = new Set<() => void>()
  private version = 0
  /** Dedupe keys for protected-route audit events. */
  private routeAudits = new Set<string>()

  constructor() {
    // Start signed out; a still-valid session from this tab is restored below.
    this.reset("LOCKED")
    this.restoreSession()
  }

  /* ----- subscription (for useSyncExternalStore) ----- */
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  getVersion = () => this.version
  private emit() {
    this.version++
    this.listeners.forEach((l) => l())
  }

  private log(
    event: Omit<ActivityEvent, "id" | "timestamp"> & { timestamp?: string },
  ) {
    this.app.activity = [
      { id: `evt-${hex(8)}`, timestamp: event.timestamp ?? now(), ...event },
      ...this.app.activity,
    ]
  }

  private logError(
    actorId: ActivityEvent["actorId"],
    summary: string,
    error: ApiError,
  ) {
    this.log({
      actorId,
      summary,
      source: "APPLICATION",
      correlationId: error.correlationId,
      result: error.status === 403 || error.status === 401 ? "DENIED" : "ERROR",
      error: { status: error.status, code: error.code },
    })
  }

  /** Fail, write the denial/error to the evidence log, and notify. */
  private reject<T>(
    actorId: ActivityEvent["actorId"],
    summary: string,
    status: ApiError["status"],
    code: ApiErrorCode,
    message: string,
    extra: Partial<ApiError> = {},
  ): ApiResult<T> {
    const r = fail<T>(status, code, message, extra)
    if (!r.ok) this.logError(actorId, summary, r.error)
    this.emit()
    return r
  }

  /* ----- fixture controls ----- */
  getScenario = () => this.scenario
  getFault = () => this.provider.fault
  getDirectoryFault = () => this.directoryFault

  setFault(fault: ProviderFault) {
    this.provider.fault = fault
    this.emit()
  }

  setDirectoryFault(fault: DirectoryFault) {
    this.directoryFault = fault
    this.emit()
  }

  /**
   * Resets the governance scenario. The current session and the demo
   * directory are kept; grants are recomputed from persona baselines plus
   * memberships and enrollments, so governed grants start over.
   */
  reset(scenario: FixtureScenario) {
    seq = 0
    this.scenario = scenario
    // A reset rotates the session ID so every decrypted cache is purged.
    const kept = this.app?.session ?? null
    const session = kept ? { ...kept, sessionId: `sess-${randomHex(3)}` } : null
    if (session) saveSession(session)
    this.app = {
      session,
      authVersions: {},
      governedGrants: {},
      requests: [],
      changes: [],
      activity: [...SEED_ACTIVITY].reverse(),
    }
    this.provider = { changes: {}, fault: this.provider?.fault ?? "NONE" }
    this.routeAudits.clear()

    if (scenario === "AWAITING_QUORUM") {
      const created = "2025-03-21T08:12:03.000Z"
      const proposed = "2025-03-21T09:05:44.000Z"
      const reqCor = "cor-4f20-0001"
      const chgCor = "cor-4f20-0002"
      const headApproval: GovernanceApproval = {
        approverId: "head-01",
        signedAt: proposed,
        providerSignatureRef: "tide:sig:9a41c2",
      }
      this.app.requests = [
        {
          id: "request-001",
          requesterId: "assistant-01",
          scope: fixedRestrictedScope(),
          reason:
            "Second coder for thematic reliability check on P-01 transcript (20% double-coding).",
          status: "PENDING_GOVERNANCE",
          createdAt: created,
          updatedAt: proposed,
          governanceChangeId: "change-001",
          correlationId: reqCor,
        },
      ]
      this.app.changes = [
        {
          id: "change-001",
          requestId: "request-001",
          provider: "TIDE_QEA",
          status: "PENDING_QUORUM",
          proposedBy: "head-01",
          proposedAt: proposed,
          approvals: [headApproval],
          requiredApprovals: REQUIRED_APPROVALS,
          eligibleApproverIds: [...STUDY.governanceAdminIds],
          lastVerifiedAt: proposed,
          correlationId: chgCor,
        },
      ]
      this.provider.changes["change-001"] = {
        changeId: "change-001",
        requestId: "request-001",
        approvals: [{ ...headApproval }],
        requiredApprovals: REQUIRED_APPROVALS,
        eligibleApproverIds: [...STUDY.governanceAdminIds],
      }
      this.log({
        timestamp: created,
        actorId: "assistant-01",
        summary: "request-001 created: READ RESTRICTED on study-wellbeing-01",
        source: "APPLICATION",
        correlationId: reqCor,
        result: "PENDING",
      })
      this.log({
        timestamp: proposed,
        actorId: "head-01",
        summary: "change-001 proposed for request-001",
        source: "APPLICATION",
        correlationId: chgCor,
        result: "PENDING",
      })
      this.log({
        timestamp: proposed,
        actorId: "head-01",
        summary: "Approval 1 of 2 signed for change-001 (proposer)",
        source: "TIDE_QEA",
        correlationId: chgCor,
        result: "SUCCESS",
      })
    }
    seq = 2
    this.emit()
  }

  /* ----- identity directory ----- */
  private registered(): StoredIdentity[] {
    return this.directory.identities
  }

  getIdentity(id: IdentityId): Identity | null {
    if (isPersonaId(id)) return personaIdentity(id)
    const s = this.registered().find((i) => i.id === id)
    return s ? storedIdentity(s) : null
  }

  listIdentities(): Identity[] {
    return [
      ...PERSONAS.map((p) => personaIdentity(p.id)),
      ...this.registered().map(storedIdentity),
    ]
  }

  listPersonas() {
    return PERSONAS
  }

  private memberships(): StudyMembership[] {
    return [...SEED_MEMBERSHIPS, ...this.directory.memberships]
  }

  private enrollments(): ParticipantEnrollment[] {
    return [...SEED_ENROLLMENTS, ...this.directory.enrollments]
  }

  private activeMembership(identityId: IdentityId, studyId: string) {
    return this.memberships().find(
      (m) =>
        m.identityId === identityId &&
        m.studyId === studyId &&
        m.status === "ACTIVE",
    )
  }

  private enrolled(identityId: IdentityId, studyId: string) {
    return this.enrollments().some(
      (e) => e.participantId === identityId && e.studyId === studyId,
    )
  }

  private grantsFor(identityId: IdentityId): Grant[] {
    const base: Grant[] = []
    for (const m of this.memberships()) {
      if (m.identityId !== identityId || m.status !== "ACTIVE") continue
      // Fixture personas keep their documented baseline on the fixture study.
      if (isPersonaId(identityId) && m.studyId === STUDY_ID)
        base.push(...personaById(identityId).baselineGrants)
      else base.push(...roleBaseline(m.studyRole, m.studyId))
    }
    for (const e of this.enrollments()) {
      if (e.participantId !== identityId) continue
      if (isPersonaId(identityId) && e.studyId === STUDY_ID)
        base.push(...personaById(identityId).baselineGrants)
      else base.push(...participantBaseline(e.studyId))
    }
    return [...base, ...(this.app.governedGrants[identityId] ?? [])].map(
      (g) => ({ ...g }),
    )
  }

  private studyIdsFor(identityId: IdentityId) {
    const ids = new Set<string>()
    this.memberships().forEach(
      (m) =>
        m.identityId === identityId &&
        m.status === "ACTIVE" &&
        ids.add(m.studyId),
    )
    this.enrollments().forEach(
      (e) => e.participantId === identityId && ids.add(e.studyId),
    )
    return [...ids]
  }

  private authVersion(identityId: IdentityId) {
    return this.app.authVersions[identityId] ?? 1
  }

  private bumpAuthorization(identityId: IdentityId) {
    this.app.authVersions[identityId] = this.authVersion(identityId) + 1
  }

  /** Writes the next directory snapshot, or reports why nothing changed. */
  private persist(next: Directory): ApiError | null {
    const failure = () =>
      fail<never>(
        503,
        "PERSISTENCE_FAILED",
        "The demo directory could not be saved in this browser. Nothing was changed; retry.",
      )
    if (this.directoryFault === "PERSISTENCE_FAILED") {
      const r = failure()
      return r.ok ? null : r.error
    }
    try {
      saveDirectory(next)
    } catch {
      const r = failure()
      return r.ok ? null : r.error
    }
    this.directory = next
    return null
  }

  private draft(): Directory {
    return structuredClone(this.directory)
  }

  /* ----- session ----- */
  private sessionError(code: "SESSION_REQUIRED" | "SESSION_EXPIRED") {
    // Deterministic correlation IDs: session reads happen during render.
    return code === "SESSION_EXPIRED"
      ? fail<CurrentUser>(
          401,
          "SESSION_EXPIRED",
          "Your session expired after 30 minutes. Sign in again to continue.",
          { correlationId: "cor-session-expired" },
        )
      : fail<CurrentUser>(
          401,
          "SESSION_REQUIRED",
          "Sign in to continue. No active session.",
          { correlationId: "cor-session-none" },
        )
  }

  getSession(): ApiResult<CurrentUser> {
    const s = this.app.session
    if (!s) return this.sessionError("SESSION_REQUIRED")
    if (Date.parse(s.expiresAt) <= Date.now())
      return this.sessionError("SESSION_EXPIRED")
    const identity = this.getIdentity(s.identityId)
    if (!identity) return this.sessionError("SESSION_REQUIRED")
    return ok({
      id: identity.id,
      email: identity.email,
      displayName: identity.displayName,
      role: identity.role,
      roleLabel: identity.roleLabel,
      sessionId: s.sessionId,
      authMethod: s.authMethod,
      authenticatedAt: s.authenticatedAt,
      expiresAt: s.expiresAt,
      authorizationVersion: this.authVersion(identity.id),
      studyIds: this.studyIdsFor(identity.id),
      grants: this.grantsFor(identity.id),
      isGovernanceAdmin: identity.isGovernanceAdmin,
    })
  }

  private restoreSession() {
    const stored = loadSession()
    if (!stored) return
    const valid =
      Date.parse(stored.expiresAt) > Date.now() &&
      !!this.getIdentity(stored.identityId)
    if (!valid) {
      saveSession(null)
      return
    }
    this.app.session = stored
    this.log({
      actorId: stored.identityId,
      summary: `Session ${stored.sessionId} restored in this tab (expires ${stored.expiresAt})`,
      source: "APPLICATION",
      correlationId: correlationId(),
      result: "SUCCESS",
    })
    this.emit()
  }

  private startSession(identity: Identity, authMethod: AuthMethod) {
    const t = Date.now()
    const session: StoredSession = {
      identityId: identity.id,
      sessionId: `sess-${randomHex(3)}`,
      authMethod,
      authenticatedAt: new Date(t).toISOString(),
      expiresAt: new Date(t + SESSION_TTL_MS).toISOString(),
    }
    this.app.session = session
    saveSession(session)
    this.log({
      actorId: identity.id,
      summary: `Signed in (${identity.roleLabel.toLowerCase()}) via ${
        authMethod === "FIXTURE_PERSONA"
          ? "fixture persona"
          : "demo account credentials"
      }; session ${session.sessionId} expires in 30 min`,
      source: "APPLICATION",
      correlationId: correlationId(),
      result: "SUCCESS",
    })
    this.emit()
  }

  /** One-click fixture persona sign-in (simulated TideCloak). */
  async signIn(personaId: PersonaId): Promise<ApiResult<CurrentUser>> {
    this.signOut("REPLACED")
    await wait(LATENCY.fast)
    this.startSession(personaIdentity(personaId), "FIXTURE_PERSONA")
    return this.getSession()
  }

  /** Email or identity ID plus password, for registered demo accounts. */
  async signInWithPassword(
    login: string,
    password: string,
  ): Promise<ApiResult<CurrentUser>> {
    const needle = login.trim().toLowerCase()
    await wait(LATENCY.fast)
    const stored = this.registered().find(
      (i) => i.id === needle || i.email.toLowerCase() === needle,
    )
    // Derive a hash even for unknown logins so both paths cost the same.
    const { hash } = await hashPassword(
      password,
      stored?.passwordSalt ?? "researchvault-no-such-account",
    )
    if (!needle || !password || !stored || !digestsEqual(hash, stored.passwordHash)) {
      return this.reject(
        "anonymous",
        "Sign-in failed: invalid credentials",
        401,
        "INVALID_CREDENTIALS",
        "Invalid email, identity ID or password.",
      )
    }
    this.signOut("REPLACED")
    this.startSession(storedIdentity(stored), "FIXTURE_PASSWORD")
    return this.getSession()
  }

  signOut(reason: "USER" | "REPLACED" = "USER") {
    const s = this.app.session
    if (!s) return
    this.app.session = null
    saveSession(null)
    this.log({
      actorId: s.identityId,
      summary:
        reason === "USER"
          ? `Signed out; session ${s.sessionId} ended and decrypted data purged`
          : `Session ${s.sessionId} ended by a new sign-in`,
      source: "APPLICATION",
      correlationId: correlationId(),
      result: "SUCCESS",
    })
    this.emit()
  }

  /** Clears a session whose 30-minute lifetime has elapsed. */
  expireSession() {
    const s = this.app.session
    if (!s || Date.parse(s.expiresAt) > Date.now()) return
    this.app.session = null
    saveSession(null)
    this.log({
      actorId: s.identityId,
      summary: `Session ${s.sessionId} expired after 30 minutes; decrypted data purged`,
      source: "APPLICATION",
      correlationId: correlationId(),
      result: "DENIED",
      error: { status: 401, code: "SESSION_EXPIRED" },
    })
    this.emit()
  }

  private requireSession(): ApiResult<CurrentUser> {
    return this.getSession()
  }

  /** Audit a protected-route decision once per session, path and outcome. */
  recordRouteAccess(pathname: string, allowed: boolean, requirement: string) {
    const s = this.app.session
    if (!s) return
    const key = `${s.sessionId}|${pathname}|${allowed}`
    if (this.routeAudits.has(key)) return
    this.routeAudits.add(key)
    if (allowed) {
      this.log({
        actorId: s.identityId,
        summary: `Opened protected workspace ${pathname}`,
        source: "APPLICATION",
        correlationId: correlationId(),
        result: "SUCCESS",
      })
      this.emit()
    } else {
      this.reject(
        s.identityId,
        `Route ${pathname} denied`,
        403,
        "ACCESS_DENIED",
        requirement,
      )
    }
  }

  /* ----- registration ----- */
  async register(input: RegistrationInput): Promise<ApiResult<Identity>> {
    await wait(LATENCY.fast)
    const invalid = validateRegistration(input)
    if (invalid)
      return fail(422, "VALIDATION_FAILED", invalid.message, {
        field: invalid.field,
      })
    const id = input.identityId.trim().toLowerCase()
    const email = input.email.trim().toLowerCase()
    const identities = this.listIdentities()
    if (identities.some((i) => i.id === id))
      return this.reject(
        "anonymous",
        `Registration rejected: identity ID ${id} already exists`,
        409,
        "CONFLICT",
        `The identity ID ${id} is already taken. Choose another.`,
        { field: "identityId" },
      )
    if (identities.some((i) => i.email.toLowerCase() === email))
      return this.reject(
        "anonymous",
        "Registration rejected: email already registered",
        409,
        "CONFLICT",
        "An account with that email already exists. Sign in instead.",
        { field: "email" },
      )
    const { salt, hash } = await hashPassword(input.password)
    const stored: StoredIdentity = {
      id,
      email,
      displayName: input.displayName.trim(),
      role: input.accountType,
      createdAt: now(),
      passwordSalt: salt,
      passwordHash: hash,
    }
    const next = this.draft()
    next.identities.push(stored)
    const failure = this.persist(next)
    if (failure) {
      this.logError("anonymous", `Registration of ${id} not saved`, failure)
      this.emit()
      return { ok: false, error: failure }
    }
    this.log({
      actorId: id,
      summary: `Demo account ${id} registered (${ROLE_LABEL[stored.role].toLowerCase()})`,
      source: "APPLICATION",
      correlationId: correlationId(),
      result: "SUCCESS",
    })
    this.emit()
    return ok(storedIdentity(stored))
  }

  /** Removes registered accounts, created studies and their memberships. */
  clearDemoDirectory() {
    const s = this.app.session
    if (s && !isPersonaId(s.identityId)) this.signOut()
    clearDirectory()
    this.directory = loadDirectory()
    this.log({
      actorId: "system",
      summary: "Demo directory cleared: registered accounts, created studies, invitations and enrollments removed",
      source: "APPLICATION",
      correlationId: correlationId(),
      result: "SUCCESS",
    })
    this.emit()
  }

  /* ----- studies and teams ----- */
  private allStudies(): Study[] {
    return [STUDY, ...this.directory.studies]
  }

  getStudy(studyId: string): ApiResult<Study> {
    const study = this.allStudies().find((s) => s.id === studyId)
    if (!study)
      return fail(
        404,
        "NOT_FOUND",
        `Study ${studyId} does not exist in this vault.`,
        { correlationId: `cor-404-${studyId.slice(0, 24)}` },
      )
    return ok({ ...study, governanceAdminIds: [...study.governanceAdminIds] })
  }

  private canSeeStudy(user: CurrentUser, study: Study) {
    return (
      !!this.activeMembership(user.id, study.id) ||
      this.enrolled(user.id, study.id) ||
      study.governanceAdminIds.includes(user.id)
    )
  }

  /** Studies the current identity works on or contributes to. */
  listMyStudies(): Study[] {
    const session = this.requireSession()
    if (!session.ok) return []
    return this.allStudies().filter((s) => this.canSeeStudy(session.data, s))
  }

  /** The current identity's team seats, including pending join requests. */
  listMyMemberships(): StudyMembership[] {
    const session = this.requireSession()
    if (!session.ok) return []
    return this.memberships()
      .filter((m) => m.identityId === session.data.id)
      .map((m) => ({ ...m }))
  }

  listMyEnrollments(): ParticipantEnrollment[] {
    const session = this.requireSession()
    if (!session.ok) return []
    return this.enrollments()
      .filter((e) => e.participantId === session.data.id)
      .map((e) => ({ ...e }))
  }

  /** Studies where the current identity is the head researcher. */
  listLedStudies(): Study[] {
    const session = this.requireSession()
    if (!session.ok || session.data.role !== "HEAD_RESEARCHER") return []
    return this.allStudies().filter(
      (s) =>
        s.headResearcherId === session.data.id &&
        !!this.activeMembership(session.data.id, s.id),
    )
  }

  getRoster(studyId: string): ApiResult<RosterEntry[]> {
    const session = this.requireSession()
    if (!session.ok) return session
    const study = this.getStudy(studyId)
    if (!study.ok) return study
    const s = study.data
    if (!this.canSeeStudy(session.data, s) || session.data.role === "PARTICIPANT")
      return fail(
        403,
        "ACCESS_DENIED",
        `The roster of ${studyId} is limited to its team and governance admins.`,
        { correlationId: `cor-403-roster-${studyId.slice(0, 20)}` },
      )
    return ok(
      this.memberships()
        .filter((m) => m.studyId === studyId)
        .map((m) => {
          const identity = this.getIdentity(m.identityId)
          return {
            ...m,
            displayName: identity?.displayName ?? m.identityId,
            roleLabel: ROLE_LABEL[m.studyRole],
            governance:
              s.headResearcherId === m.identityId
                ? "PROPOSER"
                : s.governanceAdminIds.includes(m.identityId)
                  ? "GOVERNANCE_ADMIN"
                  : "TEAM_MEMBER",
          }
        }),
    )
  }

  listInvitations(studyId: string): TeamInvitation[] {
    const session = this.requireSession()
    if (!session.ok) return []
    const study = this.getStudy(studyId)
    if (!study.ok || study.data.headResearcherId !== session.data.id) return []
    return this.directory.invitations
      .filter((i) => i.studyId === studyId)
      .map(invitationView)
  }

  private requireHeadOf(
    studyId: string,
    action: string,
  ): ApiResult<{ user: CurrentUser; study: Study }> {
    const session = this.requireSession()
    if (!session.ok) return session
    const study = this.getStudy(studyId)
    if (!study.ok) return study
    if (
      session.data.role !== "HEAD_RESEARCHER" ||
      study.data.headResearcherId !== session.data.id
    )
      return this.reject(
        session.data.id,
        `${action} on ${studyId} denied: not the head researcher`,
        403,
        "ACCESS_DENIED",
        `Only the head researcher of ${studyId} can ${action.toLowerCase()}.`,
      )
    return ok({ user: session.data, study: study.data })
  }

  private async mintInvitation(next: Directory, study: Study, createdBy: IdentityId) {
    const code = randomCode(TEAM_PREFIX)
    const ts = Date.now()
    // Reissuing revokes any invitation that is still open.
    next.invitations = next.invitations.map((i) =>
      i.studyId === study.id && i.status === "ACTIVE"
        ? { ...i, status: "REVOKED" }
        : i,
    )
    const invitation = {
      id: `inv-${randomHex(4)}`,
      studyId: study.id,
      codeHint: code.slice(-4),
      codeHash: await sha256(code),
      createdBy,
      createdAt: new Date(ts).toISOString(),
      expiresAt: new Date(ts + INVITE_TTL_MS).toISOString(),
      status: "ACTIVE" as const,
    }
    next.invitations.push(invitation)
    return { code, invitation }
  }

  async createStudy(input: {
    title: string
    code: string
  }): Promise<ApiResult<{ study: Study; invitation: IssuedSecret<TeamInvitation> }>> {
    const session = this.requireSession()
    if (!session.ok) return session
    const user = session.data
    await wait(LATENCY.fast)
    if (user.role !== "HEAD_RESEARCHER")
      return this.reject(
        user.id,
        "Study creation denied: not a head researcher",
        403,
        "ACCESS_DENIED",
        "Only head researchers can create research studies and teams.",
      )
    const invalid = validateStudyInput(input)
    if (invalid)
      return fail(422, "VALIDATION_FAILED", invalid.message, {
        field: invalid.field,
      })
    const id = normalizeStudyCode(input.code)
    const code = id
    const taken = this.allStudies().some(
      (s) => s.code.toLowerCase() === id || s.id === id,
    )
    if (taken || RESERVED_STUDY_IDS.has(id))
      return this.reject(
        user.id,
        `Study creation rejected: code ${code} already in use`,
        409,
        "CONFLICT",
        `Study code ${code} is already in use. Choose a unique code.`,
        { field: "code" },
      )
    const ts = now()
    const study: Study = {
      id,
      code,
      title: input.title.trim(),
      status: "RECRUITING",
      summary: "New study team. No records have been sealed yet.",
      headResearcherId: user.id,
      governanceAdminIds: [user.id],
      quorum: { required: 2, total: 3 },
      categories: ["INTERNAL", "RESTRICTED", "HIGHLY_RESTRICTED"],
      ethicsReference: "Pending ethics assignment",
      enrolledAt: ts,
      createdAt: ts,
      createdBy: user.id,
    }
    const next = this.draft()
    next.studies.push(study)
    next.memberships.push({
      id: `mem-${randomHex(4)}`,
      studyId: id,
      identityId: user.id,
      studyRole: "HEAD_RESEARCHER",
      status: "ACTIVE",
      via: "CREATOR",
      requestedAt: ts,
      joinedAt: ts,
    })
    const { code: inviteCode, invitation } = await this.mintInvitation(next, study, user.id)
    const failure = this.persist(next)
    if (failure) {
      this.logError(user.id, `Study ${id} not created`, failure)
      this.emit()
      return { ok: false, error: failure }
    }
    this.bumpAuthorization(user.id)
    const cor = correlationId()
    this.log({
      actorId: user.id,
      summary: `Study ${id} "${study.title}" created; ${user.id} is head researcher; 2-of-3 quorum locked`,
      source: "APPLICATION",
      correlationId: cor,
      result: "SUCCESS",
    })
    this.log({
      actorId: user.id,
      summary: `Team invitation ${invitation.id} issued for ${id} (…${invitation.codeHint}, one-time, 7 days)`,
      source: "APPLICATION",
      correlationId: cor,
      result: "SUCCESS",
    })
    this.emit()
    return ok({
      study: { ...study },
      invitation: { record: invitationView(invitation), code: inviteCode },
    })
  }

  async issueTeamInvitation(
    studyId: string,
  ): Promise<ApiResult<IssuedSecret<TeamInvitation>>> {
    const head = this.requireHeadOf(studyId, "Issue team invitations")
    if (!head.ok) return head
    await wait(LATENCY.fast)
    const next = this.draft()
    const { code, invitation } = await this.mintInvitation(next, head.data.study, head.data.user.id)
    const failure = this.persist(next)
    if (failure) {
      this.logError(head.data.user.id, `Invitation for ${studyId} not issued`, failure)
      this.emit()
      return { ok: false, error: failure }
    }
    this.log({
      actorId: head.data.user.id,
      summary: `Team invitation ${invitation.id} issued for ${studyId} (…${invitation.codeHint}); earlier open invitations revoked`,
      source: "APPLICATION",
      correlationId: correlationId(),
      result: "SUCCESS",
    })
    this.emit()
    return ok({ record: invitationView(invitation), code })
  }

  async issueParticipantToken(
    studyId: string,
  ): Promise<ApiResult<{ code: string; expiresAt: string }>> {
    const head = this.requireHeadOf(studyId, "Issue participant access tokens")
    if (!head.ok) return head
    await wait(LATENCY.fast)
    const code = randomCode(TOKEN_PREFIX)
    const ts = Date.now()
    const expiresAt = new Date(ts + INVITE_TTL_MS).toISOString()
    const next = this.draft()
    const id = `ptk-${randomHex(4)}`
    next.participantTokens.push({
      id,
      studyId,
      codeHint: code.slice(-4),
      codeHash: await sha256(code),
      createdBy: head.data.user.id,
      createdAt: new Date(ts).toISOString(),
      expiresAt,
      status: "ACTIVE",
    })
    const failure = this.persist(next)
    if (failure) {
      this.logError(head.data.user.id, `Participant token for ${studyId} not issued`, failure)
      this.emit()
      return { ok: false, error: failure }
    }
    this.log({
      actorId: head.data.user.id,
      summary: `Participant access token ${id} issued for ${studyId} (…${code.slice(-4)}, one-time, 7 days)`,
      source: "APPLICATION",
      correlationId: correlationId(),
      result: "SUCCESS",
    })
    this.emit()
    return ok({ code, expiresAt })
  }

  private requireResearcher(action: string): ApiResult<CurrentUser> {
    const session = this.requireSession()
    if (!session.ok) return session
    const role: Role = session.data.role
    if (role !== "RESEARCH_ASSISTANT" && role !== "HEAD_RESEARCHER")
      return this.reject(
        session.data.id,
        `${action} denied: not a research role`,
        403,
        "ACCESS_DENIED",
        "Only research assistants and head researchers can join research teams.",
      )
    return session
  }

  /**
   * Single entry point for the researcher join panel: invitation-shaped codes
   * (XXXX-XXXX-XXXX-XXXX) are redeemed, anything else is treated as a study ID.
   */
  joinTeam(input: string): Promise<ApiResult<StudyMembership>> {
    const code = normalizeCode(input)
    return /^[A-Z]{3,4}(-[A-Z0-9]{4}){3}$/.test(code)
      ? this.joinWithInvitation(code)
      : this.requestToJoin(input)
  }

  /** Join by study ID or code: creates a PENDING seat the head must approve. */
  async requestToJoin(studyRef: string): Promise<ApiResult<StudyMembership>> {
    const session = this.requireResearcher("Join request")
    if (!session.ok) return session
    const user = session.data
    await wait(LATENCY.fast)
    const ref = studyRef.trim()
    if (!/^[A-Za-z0-9][A-Za-z0-9-]{2,47}$/.test(ref))
      return fail(
        422,
        "VALIDATION_FAILED",
        "Enter a study ID such as study-wellbeing-01, or a study code such as SWIS-2025.",
        { field: "studyId" },
      )
    const study = this.allStudies().find(
      (s) =>
        s.id === ref.toLowerCase() ||
        s.code.toLowerCase() === ref.toLowerCase(),
    )
    if (!study)
      return fail(404, "NOT_FOUND", `No study matches ${ref}. Check the ID with the head researcher.`, {
        field: "studyId",
      })
    const existing = this.memberships().find(
      (m) => m.identityId === user.id && m.studyId === study.id,
    )
    if (existing)
      return this.reject(
        user.id,
        `Join request for ${study.id} rejected: seat already ${existing.status.toLowerCase()}`,
        409,
        "CONFLICT",
        existing.status === "ACTIVE"
          ? `You are already an active member of ${study.id}.`
          : `Your join request for ${study.id} is already pending head-researcher approval.`,
        { field: "studyId" },
      )
    const ts = now()
    const membership: StudyMembership = {
      id: `mem-${randomHex(4)}`,
      studyId: study.id,
      identityId: user.id,
      studyRole: "RESEARCH_ASSISTANT",
      status: "PENDING",
      via: "JOIN_REQUEST",
      requestedAt: ts,
    }
    const next = this.draft()
    next.memberships.push(membership)
    const failure = this.persist(next)
    if (failure) {
      this.logError(user.id, `Join request for ${study.id} not saved`, failure)
      this.emit()
      return { ok: false, error: failure }
    }
    this.log({
      actorId: user.id,
      summary: `Join request ${membership.id} for ${study.id} submitted; awaiting head researcher approval`,
      source: "APPLICATION",
      correlationId: correlationId(),
      result: "PENDING",
    })
    this.emit()
    return ok({ ...membership })
  }

  private async tokenHashMatches(code: string) {
    const hash = await sha256(code)
    const team = this.directory.invitations.find((i) => digestsEqual(i.codeHash, hash))
    const participant = this.directory.participantTokens.find((t) =>
      digestsEqual(t.codeHash, hash),
    )
    return { hash, team, participant }
  }

  /** Redeem a one-time team invitation: the seat becomes ACTIVE immediately. */
  async joinWithInvitation(raw: string): Promise<ApiResult<StudyMembership>> {
    const session = this.requireResearcher("Invitation redemption")
    if (!session.ok) return session
    const user = session.data
    await wait(LATENCY.fast)
    const code = normalizeCode(raw)
    if (!/^[A-Z]{3,4}(-[A-Z0-9]{4}){3}$/.test(code))
      return fail(
        422,
        "VALIDATION_FAILED",
        "Invitation codes look like TEAM-XXXX-XXXX-XXXX.",
        { field: "invite" },
      )
    const { team, participant } = await this.tokenHashMatches(code)
    if (code.startsWith(`${TOKEN_PREFIX}-`) || participant)
      return this.reject(
        user.id,
        "Invitation rejected: participant access token used as team invitation",
        422,
        "WRONG_CODE_TYPE",
        "That is a participant access token, not a team invitation. Participants enroll from their own workspace.",
        { field: "invite" },
      )
    const expired = team && Date.parse(team.expiresAt) <= Date.now()
    if (!team || team.status !== "ACTIVE" || expired)
      return this.reject(
        user.id,
        "Team invitation rejected: unknown, used, revoked or expired",
        422,
        "INVALID_INVITATION",
        "This invitation is not valid. It may have been used, reissued or expired. Ask the head researcher for a new one.",
        { field: "invite" },
      )
    const existing = this.memberships().find(
      (m) => m.identityId === user.id && m.studyId === team.studyId,
    )
    if (existing?.status === "ACTIVE")
      return this.reject(
        user.id,
        `Invitation for ${team.studyId} not used: already an active member`,
        409,
        "CONFLICT",
        `You are already an active member of ${team.studyId}. The invitation was left unused.`,
        { field: "invite" },
      )
    const ts = now()
    const next = this.draft()
    let membership: StudyMembership
    if (existing) {
      membership = {
        ...existing,
        status: "ACTIVE",
        via: "INVITATION",
        joinedAt: ts,
        approvedBy: team.createdBy,
      }
      next.memberships = next.memberships.map((m) =>
        m.id === existing.id ? membership : m,
      )
    } else {
      membership = {
        id: `mem-${randomHex(4)}`,
        studyId: team.studyId,
        identityId: user.id,
        studyRole: "RESEARCH_ASSISTANT",
        status: "ACTIVE",
        via: "INVITATION",
        requestedAt: ts,
        joinedAt: ts,
        approvedBy: team.createdBy,
      }
      next.memberships.push(membership)
    }
    next.invitations = next.invitations.map((i) =>
      i.id === team.id ? { ...i, status: "USED", usedBy: user.id } : i,
    )
    const failure = this.persist(next)
    if (failure) {
      this.logError(user.id, `Invitation for ${team.studyId} not redeemed`, failure)
      this.emit()
      return { ok: false, error: failure }
    }
    this.bumpAuthorization(user.id)
    this.log({
      actorId: user.id,
      summary: `Joined ${team.studyId} with invitation ${team.id}; membership ${membership.id} ACTIVE`,
      source: "APPLICATION",
      correlationId: correlationId(),
      result: "SUCCESS",
    })
    this.emit()
    return ok({ ...membership })
  }

  async reviewMembership(
    membershipId: string,
    decision: "APPROVE" | "DECLINE",
  ): Promise<ApiResult<StudyMembership | null>> {
    const target = this.directory.memberships.find((m) => m.id === membershipId)
    if (!target) return fail(404, "NOT_FOUND", `${membershipId} not found.`)
    const head = this.requireHeadOf(target.studyId, "Review join requests")
    if (!head.ok) return head
    if (target.status !== "PENDING")
      return fail(409, "CONFLICT", `${membershipId} is already ${target.status}.`)
    await wait(LATENCY.fast)
    const ts = now()
    const next = this.draft()
    const approved: StudyMembership = {
      ...target,
      status: "ACTIVE",
      joinedAt: ts,
      approvedBy: head.data.user.id,
    }
    next.memberships =
      decision === "APPROVE"
        ? next.memberships.map((m) => (m.id === membershipId ? approved : m))
        : next.memberships.filter((m) => m.id !== membershipId)
    const failure = this.persist(next)
    if (failure) {
      this.logError(head.data.user.id, `Review of ${membershipId} not saved`, failure)
      this.emit()
      return { ok: false, error: failure }
    }
    if (decision === "APPROVE") this.bumpAuthorization(target.identityId)
    this.log({
      actorId: head.data.user.id,
      summary:
        decision === "APPROVE"
          ? `Approved ${target.identityId} to join ${target.studyId}; membership ${membershipId} ACTIVE`
          : `Declined join request ${membershipId} from ${target.identityId} for ${target.studyId}`,
      source: "APPLICATION",
      correlationId: correlationId(),
      result: decision === "APPROVE" ? "SUCCESS" : "DENIED",
    })
    this.emit()
    return ok(decision === "APPROVE" ? { ...approved } : null)
  }

  /** Participant consent: redeem a one-time participant access token. */
  async enrollWithToken(raw: string): Promise<ApiResult<ParticipantEnrollment>> {
    const session = this.requireSession()
    if (!session.ok) return session
    const user = session.data
    if (user.role !== "PARTICIPANT")
      return this.reject(
        user.id,
        "Enrollment denied: not a participant",
        403,
        "ACCESS_DENIED",
        "Only participant accounts enroll with access tokens.",
      )
    await wait(LATENCY.fast)
    const code = normalizeCode(raw)
    if (!/^[A-Z]{3,4}(-[A-Z0-9]{4}){3}$/.test(code))
      return fail(
        422,
        "VALIDATION_FAILED",
        "Participant access tokens look like PTK-XXXX-XXXX-XXXX.",
        { field: "token" },
      )
    const { team, participant } = await this.tokenHashMatches(code)
    if (code.startsWith(`${TEAM_PREFIX}-`) || team)
      return this.reject(
        user.id,
        "Enrollment rejected: team invitation used as participant token",
        422,
        "WRONG_CODE_TYPE",
        "That is a team invitation, not a participant token. Team invitations are for research staff; ask the study team for a participant access token.",
        { field: "token" },
      )
    const expired = participant && Date.parse(participant.expiresAt) <= Date.now()
    if (!participant || participant.status !== "ACTIVE" || expired)
      return this.reject(
        user.id,
        "Enrollment rejected: unknown, used or expired participant token",
        422,
        "INVALID_ACCESS_TOKEN",
        "This participant access token is not valid. It may have been used or expired.",
        { field: "token" },
      )
    if (this.enrolled(user.id, participant.studyId))
      return this.reject(
        user.id,
        `Enrollment in ${participant.studyId} not repeated: already enrolled`,
        409,
        "CONFLICT",
        `You are already enrolled in ${participant.studyId}. The token was left unused.`,
        { field: "token" },
      )
    const enrollment: ParticipantEnrollment = {
      id: `enr-${randomHex(4)}`,
      studyId: participant.studyId,
      participantId: user.id,
      enrolledAt: now(),
      via: "ACCESS_TOKEN",
    }
    const next = this.draft()
    next.enrollments.push(enrollment)
    next.participantTokens = next.participantTokens.map((t) =>
      t.id === participant.id ? { ...t, status: "USED", usedBy: user.id } : t,
    )
    const failure = this.persist(next)
    if (failure) {
      this.logError(user.id, `Enrollment in ${participant.studyId} not saved`, failure)
      this.emit()
      return { ok: false, error: failure }
    }
    this.bumpAuthorization(user.id)
    this.log({
      actorId: user.id,
      summary: `Enrolled as participant in ${participant.studyId} with token ${participant.id}; no research or governance rights granted`,
      source: "APPLICATION",
      correlationId: correlationId(),
      result: "SUCCESS",
    })
    this.emit()
    return ok({ ...enrollment })
  }

  /* ----- records ----- */

  private evaluate(
    record: RecordSeed,
    user: CurrentUser,
  ): Pick<RecordSummary, "access" | "denial"> {
    // Deterministic so repeated reads (renders) don't mint new correlation IDs.
    const denialCor = `cor-deny-${record.id.slice(-3)}-${user.id.split("-")[0]}-v${user.authorizationVersion}`
    const grants = user.grants.filter(
      (g) => g.studyId === STUDY_ID && g.category === record.category,
    )
    const isOwner = record.ownerParticipantId === user.id
    const allowed = grants.some(
      (g) => g.scope === "STUDY" || (g.scope === "OWN_RECORDS" && isOwner),
    )
    if (allowed) return { access: "UNLOCKED" }

    if (record.category === "HIGHLY_RESTRICTED") {
      return {
        access: "COMPARTMENTALIZED",
        denial: {
          status: 403,
          code: "MISSING_SCOPE",
          message:
            "Highly restricted identity data is owner-only and compartmentalized. No role or governed change can grant it.",
          correlationId: denialCor,
          compartmentalized: true,
        },
      }
    }
    return {
      access: "LOCKED",
      denial: {
        status: 403,
        code: "MISSING_SCOPE",
        message: `Requires READ on ${record.category} for ${STUDY_ID}. Your authorization v${user.authorizationVersion} does not include it.`,
        correlationId: denialCor,
      },
    }
  }

  listRecords(studyId: string): ApiResult<RecordSummary[]> {
    const session = this.requireSession()
    if (!session.ok) return session
    const study = this.getStudy(studyId)
    if (!study.ok) return study
    if (!this.canSeeStudy(session.data, study.data))
      return fail(
        403,
        "ACCESS_DENIED",
        `You are not an active member, enrolled participant or governance admin of ${studyId}.`,
        { correlationId: `cor-403-records-${studyId.slice(0, 20)}` },
      )
    // Created studies start empty; only the fixture study has sealed records.
    const seeds = studyId === STUDY_ID ? RECORDS : []
    return ok(
      seeds.map((r) => ({
        id: r.id,
        studyId,
        title: r.title,
        description: r.description,
        category: r.category,
        level: CATEGORY_LEVEL[r.category],
        ownerParticipantId: r.ownerParticipantId,
        ...this.evaluate(r, session.data),
      })),
    )
  }

  async decryptRecord(recordId: string): Promise<ApiResult<RecordEnvelope>> {
    const session = this.requireSession()
    if (!session.ok) return session
    await wait(LATENCY.fast)
    // Re-check after latency: the session may have ended or changed mid-flight.
    const current = this.requireSession()
    if (!current.ok || current.data.sessionId !== session.data.sessionId)
      return fail(
        401,
        "SESSION_REQUIRED",
        "Session changed during decryption. Plaintext discarded.",
      )

    const record = RECORDS.find((r) => r.id === recordId)
    if (!record) return fail(404, "NOT_FOUND", `Record ${recordId} not found.`)
    const verdict = this.evaluate(record, current.data)
    if (verdict.access !== "UNLOCKED" && verdict.denial) {
      this.logError(
        current.data.id,
        `Decrypt ${recordId} denied${
          verdict.denial.compartmentalized
            ? ": compartmentalized, owner-only"
            : ""
        }`,
        verdict.denial,
      )
      this.emit()
      return { ok: false, error: verdict.denial }
    }
    const cor = correlationId()
    this.log({
      actorId: current.data.id,
      summary: `Decrypted ${recordId} (${record.category}) under authorization v${current.data.authorizationVersion}`,
      source: "APPLICATION",
      correlationId: cor,
      result: "SUCCESS",
    })
    this.emit()
    return ok({
      recordId,
      category: record.category,
      ciphertextRef: record.ciphertextRef,
      decryptedAt: now(),
      authorizationVersion: current.data.authorizationVersion,
      content: structuredClone(SEALED[recordId]),
    })
  }

  /* ----- access requests ----- */
  listAccessRequests(studyId: string): AccessRequest[] {
    return this.app.requests
      .filter((r) => r.scope.studyId === studyId)
      .map((r) => ({ ...r }))
  }

  async createAccessRequest(input: {
    scope: AccessScope
    reason: string
  }): Promise<ApiResult<AccessRequest>> {
    const session = this.requireSession()
    if (!session.ok) return session
    await wait(LATENCY.fast)
    const user = session.data
    const reason = input.reason.trim()

    if (user.role !== "RESEARCH_ASSISTANT") {
      const r = fail<AccessRequest>(
        403,
        "MISSING_SCOPE",
        "Only research assistants request study-category scope here.",
      )
      if (!r.ok)
        this.logError(
          user.id,
          "Access request rejected: role cannot request scope",
          r.error,
        )
      this.emit()
      return r
    }
    if (!this.activeMembership(user.id, input.scope.studyId))
      return this.reject(
        user.id,
        `Access request rejected: no active membership in ${input.scope.studyId}`,
        403,
        "ACCESS_DENIED",
        `You need an active team membership in ${input.scope.studyId} before requesting scope.`,
      )
    if (input.scope.dataCategory === "HIGHLY_RESTRICTED") {
      const r = fail<AccessRequest>(
        403,
        "MISSING_SCOPE",
        "Highly restricted data is compartmentalized and cannot be requested.",
        {
          compartmentalized: true,
        },
      )
      if (!r.ok)
        this.logError(
          user.id,
          "Access request rejected: compartmentalized category",
          r.error,
        )
      this.emit()
      return r
    }
    if (!reason)
      return fail(
        422,
        "VALIDATION_FAILED",
        "A reason is required. Governance admins review it before signing.",
      )
    if (reason.length < 20)
      return fail(
        422,
        "VALIDATION_FAILED",
        `Reason is too short (${reason.length}/20 characters). Describe the research need.`,
      )

    const existing = this.app.requests.find(
      (r) =>
        r.requesterId === user.id &&
        r.scope.studyId === input.scope.studyId &&
        r.scope.dataCategory === input.scope.dataCategory,
    )
    if (existing) {
      const r = fail<AccessRequest>(
        409,
        "REQUEST_ALREADY_PENDING",
        `${existing.id} already covers READ ${input.scope.dataCategory} on ${input.scope.studyId} (status ${existing.status}).`,
      )
      if (!r.ok)
        this.logError(
          user.id,
          `Duplicate access request rejected (${existing.id})`,
          r.error,
        )
      this.emit()
      return r
    }

    const ts = now()
    const request: AccessRequest = {
      id: `request-${String(this.app.requests.length + 1).padStart(3, "0")}`,
      requesterId: user.id,
      scope: { ...input.scope },
      reason,
      status: "REQUESTED",
      createdAt: ts,
      updatedAt: ts,
      correlationId: correlationId(),
    }
    this.app.requests = [...this.app.requests, request]
    this.log({
      actorId: user.id,
      summary: `${request.id} created: READ ${request.scope.dataCategory} on ${request.scope.studyId}`,
      source: "APPLICATION",
      correlationId: request.correlationId,
      result: "PENDING",
    })
    this.emit()
    return ok({ ...request })
  }

  /* ----- governance (application side) ----- */
  listChanges(): GovernanceChange[] {
    return this.app.changes.map((c) => ({ ...c, approvals: [...c.approvals] }))
  }

  private providerFaultError<T,>(): ApiResult<T> | null {
    if (this.provider.fault === "TIDE_UNAVAILABLE")
      return fail(
        503,
        "TIDE_UNAVAILABLE",
        "Tide network did not respond. Nothing was changed; retry when the provider is reachable.",
      )
    if (this.provider.fault === "PROVIDER_STATE_UNVERIFIED")
      return fail(
        502,
        "PROVIDER_STATE_UNVERIFIED",
        "Provider response failed signature verification. Application state was left unchanged.",
      )
    return null
  }

  async proposeGovernedChange(
    requestId: string,
  ): Promise<ApiResult<GovernanceChange>> {
    const session = this.requireSession()
    if (!session.ok) return session
    const user = session.data
    if (user.role !== "HEAD_RESEARCHER") {
      const r = fail<GovernanceChange>(
        403,
        "MISSING_SCOPE",
        "Only the head researcher can propose a governed change.",
      )
      if (!r.ok)
        this.logError(
          user.id,
          "Proposal rejected: not head researcher",
          r.error,
        )
      this.emit()
      return r
    }
    const request = this.app.requests.find((r) => r.id === requestId)
    if (!request) return fail(404, "NOT_FOUND", `${requestId} not found.`)
    const study = this.getStudy(request.scope.studyId)
    if (!study.ok) return study
    if (study.data.headResearcherId !== user.id)
      return this.reject(
        user.id,
        `Proposal for ${requestId} rejected: not head of ${study.data.id}`,
        403,
        "ACCESS_DENIED",
        `Only the head researcher of ${study.data.id} can propose this change.`,
      )
    if (request.governanceChangeId)
      return fail(
        409,
        "REQUEST_ALREADY_PENDING",
        `${requestId} is already under ${request.governanceChangeId}.`,
      )

    await wait(LATENCY.provider)
    const fault = this.providerFaultError<GovernanceChange>()
    if (fault && !fault.ok) {
      this.logError(
        user.id,
        `Proposal for ${requestId} not submitted to provider`,
        fault.error,
      )
      this.emit()
      return fault
    }

    const changeId = `change-${String(this.app.changes.length + 1).padStart(3, "0")}`
    const ts = now()
    const approval: GovernanceApproval = {
      approverId: user.id,
      signedAt: ts,
      providerSignatureRef: signatureRef(),
    }
    this.provider.changes[changeId] = {
      changeId,
      requestId,
      approvals: [approval],
      requiredApprovals: REQUIRED_APPROVALS,
      eligibleApproverIds: [...study.data.governanceAdminIds],
    }
    // The provider returned a verified receipt for the proposer's own signature.
    const change: GovernanceChange = {
      id: changeId,
      requestId,
      provider: "TIDE_QEA",
      status: "PENDING_QUORUM",
      proposedBy: user.id,
      proposedAt: ts,
      approvals: [{ ...approval }],
      requiredApprovals: REQUIRED_APPROVALS,
      eligibleApproverIds: [...study.data.governanceAdminIds],
      lastVerifiedAt: ts,
      correlationId: correlationId(),
    }
    this.app.changes = [...this.app.changes, change]
    this.app.requests = this.app.requests.map((r) =>
      r.id === requestId
        ? {
            ...r,
            status: "PENDING_GOVERNANCE",
            governanceChangeId: changeId,
            updatedAt: ts,
          }
        : r,
    )
    this.log({
      actorId: user.id,
      summary: `${changeId} proposed for ${requestId}`,
      source: "APPLICATION",
      correlationId: change.correlationId,
      result: "PENDING",
    })
    this.log({
      actorId: user.id,
      summary: `Approval 1 of ${REQUIRED_APPROVALS} signed for ${changeId} (proposer)`,
      source: "TIDE_QEA",
      correlationId: change.correlationId,
      result: "SUCCESS",
    })
    this.emit()
    return ok({ ...change })
  }

  /** POST /api/governance/changes/:changeId/sync */
  async syncProviderStatus(
    changeId: string,
  ): Promise<ApiResult<GovernanceChange>> {
    const session = this.requireSession()
    if (!session.ok) return session
    const user = session.data
    if (!user.isGovernanceAdmin) {
      const r = fail<GovernanceChange>(
        403,
        "MISSING_SCOPE",
        "Only governance admins can sync provider state.",
      )
      if (!r.ok)
        this.logError(
          user.id,
          `Sync ${changeId} rejected: not a governance admin`,
          r.error,
        )
      this.emit()
      return r
    }
    const change = this.app.changes.find((c) => c.id === changeId)
    if (!change) return fail(404, "NOT_FOUND", `${changeId} not found.`)

    await wait(LATENCY.provider)
    const fault = this.providerFaultError<GovernanceChange>()
    if (fault && !fault.ok) {
      this.logError(
        user.id,
        `POST /api/governance/changes/${changeId}/sync failed`,
        fault.error,
      )
      this.emit()
      return fault
    }

    const remote = this.provider.changes[changeId]
    const known = new Set(change.approvals.map((a) => a.approverId))
    const fresh = remote.approvals.filter((a) => !known.has(a.approverId))
    const ts = now()
    const approvals = remote.approvals.map((a) => ({ ...a }))
    const committed = approvals.length >= change.requiredApprovals
    const cor = correlationId()

    fresh.forEach((a) => {
      const index = remote.approvals.indexOf(a) + 1
      this.log({
        timestamp: a.signedAt,
        actorId: a.approverId,
        summary: `Approval ${index} of ${change.requiredApprovals} signed for ${changeId}`,
        source: "TIDE_QEA",
        correlationId: change.correlationId,
        result: "SUCCESS",
      })
    })

    const updated: GovernanceChange = {
      ...change,
      approvals,
      status: committed ? "COMMITTED" : "PENDING_QUORUM",
      lastVerifiedAt: ts,
    }
    this.app.changes = this.app.changes.map((c) =>
      c.id === changeId ? updated : c,
    )
    if (committed && change.status !== "COMMITTED") {
      this.app.requests = this.app.requests.map((r) =>
        r.id === change.requestId
          ? { ...r, status: "COMMITTED", updatedAt: ts }
          : r,
      )
    }
    this.log({
      actorId: user.id,
      summary: committed
        ? `Synced ${changeId}: quorum ${approvals.length}/${change.requiredApprovals} verified, change committed`
        : `Synced ${changeId}: ${approvals.length}/${change.requiredApprovals} verified${
            fresh.length ? "" : ", no new signatures"
          }`,
      source: "APPLICATION",
      correlationId: cor,
      result: committed ? "SUCCESS" : "PENDING",
    })
    this.emit()
    return ok({ ...updated })
  }

  async refreshAuthorization(): Promise<ApiResult<CurrentUser>> {
    const session = this.requireSession()
    if (!session.ok) return session
    const user = session.data
    await wait(LATENCY.provider)
    if (this.provider.fault === "TIDE_UNAVAILABLE") {
      const r = fail<CurrentUser>(
        503,
        "TIDE_UNAVAILABLE",
        "Could not refresh authorization: Tide network unavailable. Retry shortly.",
      )
      if (!r.ok) this.logError(user.id, "Authorization refresh failed", r.error)
      this.emit()
      return r
    }

    const ts = now()
    const activated: string[] = []
    const grants = [...(this.app.governedGrants[user.id] ?? [])]
    this.app.requests = this.app.requests.map((r) => {
      const change = this.app.changes.find((c) => c.id === r.governanceChangeId)
      if (
        r.requesterId !== user.id ||
        r.status !== "COMMITTED" ||
        change?.status !== "COMMITTED"
      )
        return r
      grants.push({
        category: r.scope.dataCategory,
        scope: "STUDY",
        studyId: r.scope.studyId,
        source: "GOVERNED_CHANGE",
        changeId: change.id,
      })
      activated.push(r.id)
      return { ...r, status: "ACTIVE", updatedAt: ts }
    })
    this.app.governedGrants[user.id] = grants
    this.bumpAuthorization(user.id)
    this.log({
      actorId: user.id,
      summary: activated.length
        ? `Authorization refreshed to v${this.authVersion(user.id)}; ${activated.join(", ")} now ACTIVE`
        : `Authorization refreshed to v${this.authVersion(user.id)}; no new grants`,
      source: "APPLICATION",
      correlationId: correlationId(),
      result: "SUCCESS",
    })
    this.emit()
    return this.getSession()
  }

  /** Issued authorizations per identity (governance read model). */
  listAuthorizations(): {
    identityId: IdentityId
    displayName: string
    authorizationVersion: number
    grants: Grant[]
  }[] {
    return this.listIdentities().map((i) => ({
      identityId: i.id,
      displayName: i.displayName,
      authorizationVersion: this.authVersion(i.id),
      grants: this.grantsFor(i.id),
    }))
  }

  /* ----- activity ----- */
  listActivity(): ApiResult<ActivityEvent[]> {
    const session = this.requireSession()
    if (!session.ok) return session
    if (!canViewEvidence(session.data.role))
      return fail(
        403,
        "ACCESS_DENIED",
        "The evidence log is limited to research staff and governance roles.",
        { correlationId: "cor-403-evidence" },
      )
    return ok(this.app.activity.map((e) => ({ ...e })))
  }

  /* ----- simulated Tide approval console (provider side only) ----- */
  async openProviderConsole(
    changeId: string,
  ): Promise<ApiResult<ProviderChangeView>> {
    const session = this.requireSession()
    if (!session.ok) return session
    if (!session.data.isGovernanceAdmin)
      return fail(
        403,
        "MISSING_SCOPE",
        "Tide approval console is limited to governance admins.",
      )
    await wait(LATENCY.fast)
    if (this.provider.fault === "TIDE_UNAVAILABLE")
      return fail(
        503,
        "TIDE_UNAVAILABLE",
        "Tide approval console is unreachable. Try again shortly.",
      )
    const remote = this.provider.changes[changeId]
    if (!remote)
      return fail(404, "NOT_FOUND", `${changeId} is unknown to the provider.`)
    return ok(structuredClone(remote))
  }

  async signProviderApproval(
    changeId: string,
  ): Promise<ApiResult<ProviderChangeView>> {
    const session = this.requireSession()
    if (!session.ok) return session
    const user = session.data
    const remote = this.provider.changes[changeId]
    if (!remote)
      return fail(404, "NOT_FOUND", `${changeId} is unknown to the provider.`)
    if (!remote.eligibleApproverIds.includes(user.id))
      return fail(
        403,
        "MISSING_SCOPE",
        `${user.id} is not an eligible approver for ${changeId}.`,
      )
    if (remote.approvals.some((a) => a.approverId === user.id))
      return fail(
        409,
        "REQUEST_ALREADY_PENDING",
        `${user.id} has already signed ${changeId}.`,
      )
    await wait(LATENCY.provider)
    if (this.provider.fault === "TIDE_UNAVAILABLE")
      return fail(
        503,
        "TIDE_UNAVAILABLE",
        "Signature not recorded: Tide network unavailable.",
      )
    remote.approvals.push({
      approverId: user.id,
      signedAt: now(),
      providerSignatureRef: signatureRef(),
    })
    // Intentionally no app-state change and no emit of app data: the app learns of this only via sync.
    return ok(structuredClone(remote))
  }
}

export function fixedRestrictedScope(): AccessScope {
  return {
    kind: "STUDY_CATEGORY",
    studyId: STUDY_ID,
    dataCategory: "RESTRICTED",
    action: "READ",
    contextRecordId: CODED_RECORD_ID,
  }
}

export const vault = new FixtureAdapter()
export type Vault = FixtureAdapter
