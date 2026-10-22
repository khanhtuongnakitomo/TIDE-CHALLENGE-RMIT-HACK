/**
 * ResearchVault shared data contract.
 * Every adapter (this fixture, or a live TideCloak / Tide Fabric adapter)
 * returns these shapes so views never depend on where authority comes from.
 */

export type PersonaId = "participant-01" | "assistant-01" | "head-01" | "steward-01" | "ethics-01"

/** Any identity in the directory: a fixture persona or a registered demo account. */
export type IdentityId = string

export type Role = "PARTICIPANT" | "RESEARCH_ASSISTANT" | "HEAD_RESEARCHER" | "DATA_STEWARD" | "ETHICS_REPRESENTATIVE"

export type DataCategory = "INTERNAL" | "RESTRICTED" | "HIGHLY_RESTRICTED"

/** L1 metadata, L2 internal, L3 restricted, L4 highly restricted. */
export type ClearanceLevel = 1 | 2 | 3 | 4

export interface Grant {
  category: DataCategory
  /** STUDY = whole category in a study; OWN_RECORDS = the participant's own records only. */
  scope: "STUDY" | "OWN_RECORDS"
  studyId: string
  source: "BASELINE" | "GOVERNED_CHANGE"
  changeId?: string
}

/** FIXTURE_PERSONA = one-click simulated sign-in; FIXTURE_PASSWORD = registered demo account. */
export type AuthMethod = "FIXTURE_PERSONA" | "FIXTURE_PASSWORD"

export interface Identity {
  id: IdentityId
  email: string
  displayName: string
  role: Role
  roleLabel: string
  isGovernanceAdmin: boolean
  kind: "FIXTURE_PERSONA" | "REGISTERED"
  createdAt: string
}

export interface CurrentUser {
  id: IdentityId
  email: string
  displayName: string
  role: Role
  roleLabel: string
  sessionId: string
  authMethod: AuthMethod
  authenticatedAt: string
  /** Sessions last 30 minutes; after this the adapter answers 401 SESSION_EXPIRED. */
  expiresAt: string
  /** Bumps each time authorization is refreshed from the provider. */
  authorizationVersion: number
  /** Studies with an ACTIVE membership or participant enrollment. */
  studyIds: string[]
  grants: Grant[]
  isGovernanceAdmin: boolean
}

export interface RegistrationInput {
  identityId: string
  email: string
  displayName: string
  password: string
  confirmPassword: string
  accountType: "PARTICIPANT" | "RESEARCH_ASSISTANT"
}

/* ----- study teams (research staff) and participant enrollment ----- */

export type MembershipStatus = "PENDING" | "ACTIVE"

/** A research-staff seat on a study team. Participants are never members. */
export interface StudyMembership {
  id: string
  studyId: string
  identityId: IdentityId
  /** Role inside this study; may differ from the identity's app role. */
  studyRole: Exclude<Role, "PARTICIPANT">
  status: MembershipStatus
  via: "SEED" | "CREATOR" | "INVITATION" | "JOIN_REQUEST"
  requestedAt: string
  joinedAt?: string
  approvedBy?: IdentityId
}

export interface RosterEntry extends StudyMembership {
  displayName: string
  roleLabel: string
  governance: "PROPOSER" | "GOVERNANCE_ADMIN" | "TEAM_MEMBER"
}

/** Team invitation metadata. The code itself is shown once and stored only as a hash. */
export interface TeamInvitation {
  id: string
  studyId: string
  codeHint: string
  createdBy: IdentityId
  createdAt: string
  expiresAt: string
  status: "ACTIVE" | "USED" | "REVOKED" | "EXPIRED"
  usedBy?: IdentityId
}

/** Participant enrollment is consent to contribute, not a research role. */
export interface ParticipantEnrollment {
  id: string
  studyId: string
  participantId: IdentityId
  enrolledAt: string
  via: "SEED" | "ACCESS_TOKEN"
}

/** A secret shown exactly once at issue time. */
export interface IssuedSecret<T> {
  record: T
  code: string
}

export interface Study {
  id: string
  /** Unique, human-readable study code (lower-case, hyphenated); doubles as the study ID. */
  code: string
  title: string
  status: "RECRUITING" | "ACTIVE" | "CLOSED"
  summary: string
  headResearcherId: IdentityId
  governanceAdminIds: IdentityId[]
  quorum: { required: number; total: number }
  categories: DataCategory[]
  ethicsReference: string
  enrolledAt: string
  createdAt: string
  createdBy: IdentityId
}

export type RecordAccess = "UNLOCKED" | "LOCKED" | "COMPARTMENTALIZED"

export interface RecordSummary {
  id: string
  studyId: string
  title: string
  description: string
  category: DataCategory
  level: ClearanceLevel
  ownerParticipantId?: IdentityId
  /** Evaluated for the current session only. */
  access: RecordAccess
  denial?: ApiError
}

export interface TranscriptTurn {
  speaker: "INTERVIEWER" | "P-01"
  text: string
  codes?: string[]
}

export type RecordContent = {
  kind: "PROTOCOL"
  sections: { heading: string; body: string }[]
} | { kind: "TRANSCRIPT"; pseudonym: string; turns: TranscriptTurn[] } | {
  kind: "IDENTITY"
  pseudonym: string
  fields: { label: string; value: string }[]
}

export interface RecordEnvelope {
  recordId: string
  category: DataCategory
  ciphertextRef: string
  decryptedAt: string
  authorizationVersion: number
  content: RecordContent
}

export interface AccessScope {
  kind: "STUDY_CATEGORY"
  studyId: string
  dataCategory: DataCategory
  action: "READ"
  contextRecordId: string
}

export type AccessRequestStatus = "REQUESTED" | "PENDING_GOVERNANCE" | "COMMITTED" | "ACTIVE"

export interface AccessRequest {
  id: string
  requesterId: IdentityId
  scope: AccessScope
  reason: string
  status: AccessRequestStatus
  createdAt: string
  updatedAt: string
  governanceChangeId?: string
  correlationId: string
}

export interface GovernanceApproval {
  approverId: IdentityId
  signedAt: string
  providerSignatureRef: string
}

export type GovernanceChangeStatus = "PENDING_QUORUM" | "COMMITTED"

export interface GovernanceChange {
  id: string
  requestId: string
  provider: "TIDE_QEA"
  status: GovernanceChangeStatus
  proposedBy: IdentityId
  proposedAt: string
  /** Approvals the application has verified with the provider. */
  approvals: GovernanceApproval[]
  requiredApprovals: number
  eligibleApproverIds: IdentityId[]
  lastVerifiedAt: string
  correlationId: string
}

export type ActivitySource = "APPLICATION" | "TIDE_QEA"
export type ActivityResult = "SUCCESS" | "DENIED" | "PENDING" | "ERROR"

export interface ActivityEvent {
  id: string
  timestamp: string
  actorId: IdentityId | "system" | "anonymous"
  summary: string
  source: ActivitySource
  correlationId: string
  result: ActivityResult
  error?: { status: ApiError["status"]; code: ApiErrorCode }
}

export type ApiErrorCode =
  | "SESSION_REQUIRED"
  | "SESSION_EXPIRED"
  | "INVALID_CREDENTIALS"
  | "ACCESS_DENIED"
  | "MISSING_SCOPE"
  | "VALIDATION_FAILED"
  | "CONFLICT"
  | "INVALID_INVITATION"
  | "INVALID_ACCESS_TOKEN"
  | "WRONG_CODE_TYPE"
  | "REQUEST_ALREADY_PENDING"
  | "PERSISTENCE_FAILED"
  | "PROVIDER_STATE_UNVERIFIED"
  | "TIDE_UNAVAILABLE"
  | "NOT_FOUND"

export interface ApiError {
  status: 401 | 403 | 404 | 409 | 422 | 502 | 503
  code: ApiErrorCode
  message: string
  correlationId: string
  compartmentalized?: boolean
  /** Form field the error applies to, when the cause is a single input. */
  field?: string
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError }

/** Fixture-only fault injection for the simulated provider. */
export type ProviderFault = "NONE" | "TIDE_UNAVAILABLE" | "PROVIDER_STATE_UNVERIFIED"

/** Fixture-only fault injection for the demo directory's browser storage. */
export type DirectoryFault = "NONE" | "PERSISTENCE_FAILED"

export type FixtureScenario = "LOCKED" | "AWAITING_QUORUM"

/** What the provider's own approval console sees (never read by app state directly). */
export interface ProviderChangeView {
  changeId: string
  approvals: GovernanceApproval[]
  requiredApprovals: number
  eligibleApproverIds: IdentityId[]
}
