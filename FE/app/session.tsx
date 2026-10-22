import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import type {
  ApiError,
  ApiResult,
  CurrentUser,
  FixtureScenario,
  Identity,
  PersonaId,
  RecordEnvelope,
  RegistrationInput,
} from "@/lib/contracts"
import { vault } from "@/lib/fixtureAdapter"

/** Why the last session ended; drives the confirmation on /login. */
export type SessionEnd = "SIGNED_OUT" | "EXPIRED" | null

interface SessionValue {
  /** Changes whenever adapter state changes; read adapter getters during render. */
  version: number
  user: CurrentUser | null
  sessionError: ApiError | null
  /** Identity currently being signed in, or "password" for the credential form. */
  pending: PersonaId | "password" | null
  lastEnd: SessionEnd
  /** Decrypted envelopes for this session only. Purged on every session change. */
  decrypted: Record<string, RecordEnvelope>
  decrypt: (recordId: string) => Promise<ApiError | null>
  lockRecord: (recordId: string) => void
  /** Study the researcher is working in, scoped to the current session. */
  activeStudyId: string | null
  setActiveStudyId: (studyId: string | null) => void
  signInPersona: (id: PersonaId) => Promise<ApiResult<CurrentUser>>
  signInWithPassword: (
    login: string,
    password: string,
  ) => Promise<ApiResult<CurrentUser>>
  register: (input: RegistrationInput) => Promise<ApiResult<Identity>>
  signOut: () => void
  resetScenario: (scenario: FixtureScenario) => void
}

const SessionContext = createContext<SessionValue | null>(null)
const EMPTY: Record<string, RecordEnvelope> = {}

interface Scoped<T> {
  sessionId: string | null
  value: T
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const version = useSyncExternalStore(vault.subscribe, vault.getVersion)
  // Plaintext and study context are bound to the session that produced them;
  // a different (or no) session never sees them.
  const [vaultState, setVaultState] = useState<
    Scoped<Record<string, RecordEnvelope>>
  >({ sessionId: null, value: {} })
  const [study, setStudy] = useState<Scoped<string | null>>({
    sessionId: null,
    value: null,
  })
  const [pending, setPending] = useState<SessionValue["pending"]>(null)
  const [lastEnd, setLastEnd] = useState<SessionEnd>(null)

  const session = useMemo(() => vault.getSession(), [version])
  const user = session.ok ? session.data : null
  const sessionId = user?.sessionId ?? null
  const sessionIdRef = useRef<string | null>(sessionId)
  sessionIdRef.current = sessionId

  const purge = useCallback(() => {
    setVaultState({ sessionId: null, value: {} })
    setStudy({ sessionId: null, value: null })
  }, [])

  // Session lifetime: expire exactly at expiresAt, and re-check when the tab
  // wakes up (background timers can be throttled).
  const expiresAt = !session.ok
    ? session.error.code === "SESSION_EXPIRED"
      ? "now"
      : null
    : session.data.expiresAt
  useEffect(() => {
    if (!expiresAt) return
    const expire = () => {
      if (expiresAt !== "now" && Date.parse(expiresAt) > Date.now()) return
      purge()
      setLastEnd("EXPIRED")
      vault.expireSession()
    }
    if (expiresAt === "now") {
      expire()
      return
    }
    const delay = Math.max(0, Date.parse(expiresAt) - Date.now())
    const timer = window.setTimeout(expire, Math.min(delay, 2 ** 31 - 1))
    const onWake = () => document.visibilityState === "visible" && expire()
    document.addEventListener("visibilitychange", onWake)
    window.addEventListener("focus", expire)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener("visibilitychange", onWake)
      window.removeEventListener("focus", expire)
    }
  }, [expiresAt, purge])

  const decrypted =
    vaultState.sessionId && vaultState.sessionId === sessionId
      ? vaultState.value
      : EMPTY
  const activeStudyId =
    study.sessionId && study.sessionId === sessionId ? study.value : null

  const decrypt = useCallback(async (recordId: string) => {
    const startedIn = sessionIdRef.current
    const result = await vault.decryptRecord(recordId)
    if (!result.ok) return result.error
    // Drop plaintext if the session changed or ended while decryption was in flight.
    if (!startedIn || sessionIdRef.current !== startedIn) return null
    setVaultState((prev) => ({
      sessionId: startedIn,
      value:
        prev.sessionId === startedIn
          ? { ...prev.value, [recordId]: result.data }
          : { [recordId]: result.data },
    }))
    return null
  }, [])

  const lockRecord = useCallback((recordId: string) => {
    setVaultState((prev) => {
      const value = { ...prev.value }
      delete value[recordId]
      return { ...prev, value }
    })
  }, [])

  const setActiveStudyId = useCallback((studyId: string | null) => {
    setStudy({ sessionId: sessionIdRef.current, value: studyId })
  }, [])

  const signInPersona = useCallback(
    async (id: PersonaId) => {
      purge()
      setPending(id)
      const result = await vault.signIn(id)
      setPending(null)
      if (result.ok) setLastEnd(null)
      return result
    },
    [purge],
  )

  const signInWithPassword = useCallback(
    async (login: string, password: string) => {
      setPending("password")
      const result = await vault.signInWithPassword(login, password)
      setPending(null)
      if (result.ok) {
        purge()
        setLastEnd(null)
      }
      return result
    },
    [purge],
  )

  const register = useCallback(
    (input: RegistrationInput) => vault.register(input),
    [],
  )

  const signOut = useCallback(() => {
    purge()
    setLastEnd("SIGNED_OUT")
    vault.signOut()
  }, [purge])

  const resetScenario = useCallback(
    (scenario: FixtureScenario) => {
      purge()
      vault.reset(scenario)
    },
    [purge],
  )

  const value: SessionValue = {
    version,
    user,
    sessionError: session.ok ? null : session.error,
    pending,
    lastEnd,
    decrypted,
    decrypt,
    lockRecord,
    activeStudyId,
    setActiveStudyId,
    signInPersona,
    signInWithPassword,
    register,
    signOut,
    resetScenario,
  }
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error("useSession must be used inside SessionProvider")
  return ctx
}
