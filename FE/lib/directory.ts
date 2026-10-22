import type {
  AuthMethod,
  IdentityId,
  ParticipantEnrollment,
  Role,
  Study,
  StudyMembership,
  TeamInvitation,
} from "./contracts"

/* ---------------------------------------------------------------------------
 * Demo directory persistence. Only non-sensitive directory data and salted
 * password hashes go to localStorage; the session pointer goes to
 * sessionStorage. Decrypted payloads, grants and plaintext credentials are
 * never written anywhere.
 * ------------------------------------------------------------------------- */

export interface StoredIdentity {
  id: IdentityId
  email: string
  displayName: string
  role: Extract<Role, "PARTICIPANT" | "RESEARCH_ASSISTANT">
  createdAt: string
  passwordSalt: string
  passwordHash: string
}

export interface StoredInvitation extends TeamInvitation {
  codeHash: string
}

export interface StoredParticipantToken {
  id: string
  studyId: string
  codeHint: string
  codeHash: string
  createdBy: IdentityId
  createdAt: string
  expiresAt: string
  status: "ACTIVE" | "USED" | "REVOKED" | "EXPIRED"
  usedBy?: IdentityId
}

export interface Directory {
  version: 1
  identities: StoredIdentity[]
  studies: Study[]
  memberships: StudyMembership[]
  invitations: StoredInvitation[]
  participantTokens: StoredParticipantToken[]
  enrollments: ParticipantEnrollment[]
}

export interface StoredSession {
  identityId: IdentityId
  sessionId: string
  authMethod: AuthMethod
  authenticatedAt: string
  expiresAt: string
}

const DIRECTORY_KEY = "researchvault.directory.v1"
const SESSION_KEY = "researchvault.session.v1"

export const emptyDirectory = (): Directory => ({
  version: 1,
  identities: [],
  studies: [],
  memberships: [],
  invitations: [],
  participantTokens: [],
  enrollments: [],
})

function storage(kind: "local" | "session"): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

export function loadDirectory(): Directory {
  const raw = storage("local")?.getItem(DIRECTORY_KEY)
  if (!raw) return emptyDirectory()
  try {
    const parsed = JSON.parse(raw) as Partial<Directory>
    if (parsed.version !== 1) return emptyDirectory()
    return { ...emptyDirectory(), ...parsed, version: 1 }
  } catch {
    return emptyDirectory()
  }
}

/** Throws when the browser refuses the write (quota, privacy mode). */
export function saveDirectory(directory: Directory) {
  const store = storage("local")
  if (!store) throw new Error("localStorage unavailable")
  store.setItem(DIRECTORY_KEY, JSON.stringify(directory))
}

export function clearDirectory() {
  storage("local")?.removeItem(DIRECTORY_KEY)
}

export function loadSession(): StoredSession | null {
  const raw = storage("session")?.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as StoredSession
    return s && typeof s.identityId === "string" && typeof s.expiresAt === "string"
      ? s
      : null
  } catch {
    return null
  }
}

export function saveSession(session: StoredSession | null) {
  const store = storage("session")
  if (!store) return
  try {
    if (session) store.setItem(SESSION_KEY, JSON.stringify(session))
    else store.removeItem(SESSION_KEY)
  } catch {
    // A session that cannot be persisted still works until reload.
  }
}
