"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AccessRequest, PersonaId, RecordSummary } from "@/lib/domain";
import {
  personas,
  presetRequestReasons,
  userTestWorkflowSteps,
} from "@/lib/domain";
import { useLiveSession } from "./providers";

type ApiResult<T> = {
  data?: T;
  error?: { code: string; message: string; requestId?: string };
  meta?: Record<string, unknown>;
};

type OpenRecord = {
  id: string;
  safeLabel: string;
  category: string;
  content: string;
};

type ActorView = {
  id: string;
  label: string;
  audiences: string[];
  capabilities: string[];
  summary?: string;
  mode?: string;
  rolesMapped?: boolean;
};

async function api<T>(
  url: string,
  init?: RequestInit,
  secureFetch: (
    url: string | URL | RequestInfo,
    init?: RequestInit,
  ) => Promise<Response> = fetch,
): Promise<ApiResult<T>> {
  const response = await secureFetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(json.error?.message ?? "Request failed."), {
      code: json.error?.code,
      requestId: json.error?.requestId,
    });
  }
  return json;
}

export default function Home() {
  const auth = useLiveSession();
  const [actor, setActor] = useState<ActorView | null>(null);
  const [records, setRecords] = useState<RecordSummary[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [opened, setOpened] = useState<OpenRecord | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>(
    presetRequestReasons[0],
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState<"workspace" | "governance" | "evidence">(
    "workspace",
  );
  const [status, setStatus] = useState("Starting local demo…");
  const sessionGeneration = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++sessionGeneration.current;
    try {
      if (auth.live && !auth.authenticated) {
        setActor(null);
        setRecords([]);
        setRequests([]);
        setOpened(null);
        setStatus(
          auth.initializing
            ? "Connecting to Tide identity…"
            : "Tide identity not signed in",
        );
        return;
      }

      const me = await api<ActorView>(
        "/api/me",
        undefined,
        auth.live ? auth.secureFetch : fetch,
      );
      if (generation !== sessionGeneration.current) return;

      setActor(me.data ?? null);
      if (!me.data) return;

      if (auth.live) {
        setRecords([]);
        setRequests([]);
        setOpened(null);
        setStatus(
          me.data.rolesMapped
            ? "Tide identity and DPoP session verified · protected data operations not configured"
            : "Tide identity and DPoP verified · role mapping is incomplete",
        );
        return;
      }

      const mayListStudyRecords =
        me.data.capabilities.includes("study:read") ||
        me.data.capabilities.includes("record:read:own");

      const [recordList, requestList] = await Promise.all([
        mayListStudyRecords
          ? api<RecordSummary[]>("/api/records?studyId=study-wellbeing-01")
          : Promise.resolve({ data: [] as RecordSummary[] }),
        api<AccessRequest[]>("/api/access-requests"),
      ]);

      if (generation !== sessionGeneration.current) return;
      setRecords(recordList.data ?? []);
      setRequests(requestList.data ?? []);
      setError("");
      setStatus("Local simulation · browser session active");
    } catch (e) {
      const err = e as Error & { code?: string };
      if (generation !== sessionGeneration.current) return;
      if (err.code === "SESSION_REQUIRED") {
        setActor(null);
        setRecords([]);
        setRequests([]);
        setOpened(null);
        setPage("workspace");
        setStatus("Local simulation · choose a persona");
      } else {
        setError(err.message);
        setStatus("Local demo unavailable");
      }
    }
  }, [auth.live, auth.authenticated, auth.initializing, auth.secureFetch]);

  useEffect(() => {
    void fetch("/api/status", { cache: "no-store" })
      .then(async (r) => {
        const result = await r.json();
        if (r.ok) {
          setStatus("LOCAL SIMULATION · no Tide realm configured");
        } else {
          setStatus(result.error?.message ?? "Live provider unavailable");
        }
      })
      .catch(() => setStatus("Demo server unavailable"));
    void refresh();
  }, [refresh]);

  const login = async (personaId: PersonaId) => {
    sessionGeneration.current += 1;
    setActor(null);
    setRecords([]);
    setRequests([]);
    setOpened(null);
    setPage(
      personaId === "steward-01" || personaId === "ethics-01"
        ? "governance"
        : "workspace",
    );
    setBusy(true);
    setError("");
    try {
      if (auth.live) {
        await auth.login();
        await refresh();
      } else {
        await api("/api/demo/login", {
          method: "POST",
          body: JSON.stringify({ personaId }),
        });
        await refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    sessionGeneration.current += 1;
    setActor(null);
    setRecords([]);
    setRequests([]);
    setOpened(null);
    setPage("workspace");
    setBusy(true);
    try {
      if (auth.live) {
        await auth.logout();
      } else {
        await api("/api/logout", { method: "POST" });
      }
      setStatus(
        auth.live ? "Tide session ended" : "Local simulation · session ended",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const resetLocalWorkflow = async () => {
    sessionGeneration.current += 1;
    setOpened(null);
    setError("");
    setBusy(true);
    try {
      await api("/api/demo/reset", { method: "POST", body: "{}" });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openRecord = async (id: string) => {
    const generation = sessionGeneration.current;
    setBusy(true);
    setError("");
    setOpened(null);
    try {
      const result = await api<OpenRecord>(`/api/records/${id}`);
      if (generation !== sessionGeneration.current) return;
      setOpened(result.data ?? null);
      void refresh();
    } catch (e) {
      if (generation !== sessionGeneration.current) return;
      const err = e as Error & { code?: string };
      setError(`${err.code ? `${err.code}: ` : ""}${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const createRequest = async (contextRecordId = "record-coded-001") => {
    setBusy(true);
    setError("");
    try {
      await api("/api/access-requests", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          scope: {
            kind: "STUDY_CATEGORY",
            studyId: "study-wellbeing-01",
            dataCategory: "RESTRICTED",
            action: "READ",
            contextRecordId,
          },
          reason: selectedReason,
        }),
      });
      await refresh();
    } catch (e) {
      const err = e as Error & { code?: string; requestId?: string };
      setError(
        `${err.code ? `${err.code}: ` : ""}${err.message}${err.requestId ? ` Request ${err.requestId}` : ""}`,
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const propose = async (id: string) => {
    await mutateRequest(id, "propose");
  };

  const approve = async (id: string) => {
    await mutateRequest(id, "approve");
  };

  async function mutateRequest(id: string, action: "propose" | "approve") {
    setBusy(true);
    setError("");
    try {
      await api(`/api/access-requests/${id}/${action}`, {
        method: "POST",
        body: "{}",
      });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const isGovernance = actor?.audiences.includes("GOVERNANCE") ?? false;
  const restricted = records.find((record) => record.id === "record-coded-001");
  const activeRequest = requests[0] ?? null;

  // Compute current guided step (1..6) for user testing feedback
  const currentGuidedStep = (() => {
    if (!actor) return 1;
    if (activeRequest?.state === "ACTIVE") return 6;
    if (activeRequest?.state === "COMMITTED") return 5;
    if (
      activeRequest?.state === "PENDING_GOVERNANCE" &&
      activeRequest.approvals >= 1
    ) {
      return 4;
    }
    if (
      activeRequest?.state === "REQUESTED" ||
      activeRequest?.state === "PENDING_GOVERNANCE"
    ) {
      return 3;
    }
    if (actor.id === "participant-01") return 1;
    return 2;
  })();

  if (auth.live) {
    return (
      <LiveSessionView
        actor={actor}
        status={status}
        initializing={auth.initializing}
        authenticated={auth.authenticated}
        busy={busy}
        login={() => void login("assistant-01")}
        logout={() => void logout()}
      />
    );
  }

  return (
    <main className="app-shell">
      <div className="mode-banner">
        <span className="mode-dot" />
        {status}
        <span className="banner-right">
          Synthetic data · server-held demo encryption · no Tide-backed
          identity, approval, or E2EE
        </span>
      </div>

      <header className="topbar">
        <a
          href="#home"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setPage("workspace");
          }}
        >
          <span className="brand-mark">R</span>
          <span>
            ResearchVault
            <small>RMIT research participation demo</small>
          </span>
        </a>

        <div className="top-actions">
          {actor && (
            <>
              <div className="persona-switcher" aria-label="Quick switch persona">
                {personas.map((persona) => (
                  <button
                    key={persona.id}
                    className={`persona-chip ${actor.id === persona.id ? "active" : ""}`}
                    disabled={busy || actor.id === persona.id}
                    onClick={() => void login(persona.id)}
                    title={`Switch to ${persona.label}`}
                  >
                    {persona.label.split("·")[0].trim().split(" ")[0]}
                  </button>
                ))}
              </div>
              <span className="account-pill">
                <span className="avatar">{actor.label.charAt(0)}</span>
                {actor.label.split("·")[0]}
              </span>
              <button
                className="quiet-button"
                onClick={() => void resetLocalWorkflow()}
                disabled={busy}
                title="Reset local SQLite demo requests and approvals"
              >
                Reset demo
              </button>
              <button className="quiet-button" onClick={logout} disabled={busy}>
                Sign out
              </button>
            </>
          )}
        </div>
      </header>

      {!actor ? (
        <section className="hero-layout">
          <div className="hero-copy">
            {error && (
              <div className="error-banner" role="alert">
                {error}
              </div>
            )}
            <div className="eyebrow">
              <span className="eyebrow-line" />
              RESEARCH, WITH ACCOUNTABILITY
            </div>
            <h1>People deserve clarity about how their research is used.</h1>
            <p>
              ResearchVault separates participant identity from study responses,
              then makes protected access changes visible and reviewable.
            </p>
            <div className="hero-tags">
              <span>Participant-owned contributions</span>
              <span>Purpose-scoped access</span>
              <span>Independent review</span>
            </div>
            <div className="hero-note">
              <span className="lock-icon">◈</span>
              <span>
                <b>This is a functional local simulation.</b>
                <br />
                The workspace uses synthetic content and a local demo key. It is
                not connected to Tide.
              </span>
            </div>
          </div>

          <div className="sign-in-card">
            <div className="card-eyebrow">LOCAL DEMO ENTRY</div>
            <h2>Choose a demo persona</h2>
            <p>
              Each persona has its own server session and permissions. Switching
              accounts clears the current session.
            </p>
            <div className="persona-list">
              {personas.map((persona) => (
                <button
                  className="persona-choice"
                  key={persona.id}
                  disabled={busy}
                  onClick={() => void login(persona.id as PersonaId)}
                >
                  <span
                    className={`persona-avatar ${persona.id.split("-")[0]}`}
                  >
                    {persona.label.charAt(0)}
                  </span>
                  <span className="persona-label">
                    <b>{persona.label.split("·")[0].trim()}</b>
                    <small>
                      {persona.label.split("·")[1]?.trim()}
                      {persona.summary ? ` — ${persona.summary}` : ""}
                    </small>
                  </span>
                  <span className="choice-arrow">↗</span>
                </button>
              ))}
            </div>
            <div className="card-foot">
              <span className="small-dot" />
              Local persona simulator · no real account
            </div>
          </div>
        </section>
      ) : (
        <>
          <div className="workspace-head">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                {actor.audiences.includes("PARTICIPANT")
                  ? "PARTICIPANT SPACE"
                  : actor.audiences.includes("RESEARCHER")
                    ? "RESEARCH WORKSPACE"
                    : "GOVERNANCE REVIEW"}
              </div>
              <h1>
                {actor.audiences.includes("PARTICIPANT")
                  ? "Your participation, clearly."
                  : actor.audiences.includes("RESEARCHER")
                    ? "Study workspace"
                    : "Review protected access"}
              </h1>
              <p>
                {actor.audiences.includes("PARTICIPANT")
                  ? "See the study and your own contribution. Governance roles do not grant access to your records."
                  : actor.audiences.includes("RESEARCHER")
                    ? "Work with study material within the current access scope."
                    : "Review a local-only access simulation. These actions do not change a Tide realm."}
              </p>
            </div>
            <span className="study-chip">
              <span className="study-chip-dot" />1 active study · 7 synthetic
              records
            </span>
          </div>

          <section
            className="workflow-strip"
            aria-label="Guided user test workflow"
          >
            <div className="workflow-strip-head">
              <div>
                <span className="section-label">
                  INTERACTIVE USER TEST WORKFLOW
                </span>
                <strong>
                  Step {currentGuidedStep} of {userTestWorkflowSteps.length}:{" "}
                  {userTestWorkflowSteps[currentGuidedStep - 1]?.title}
                </strong>
              </div>
              <span className="workflow-hint">
                {userTestWorkflowSteps[currentGuidedStep - 1]?.instruction}
              </span>
            </div>
            <div className="workflow-steps-grid">
              {userTestWorkflowSteps.map((item) => {
                const isCurrent = item.step === currentGuidedStep;
                const isDone = item.step < currentGuidedStep;
                return (
                  <button
                    key={item.step}
                    type="button"
                    disabled={busy}
                    onClick={() => void login(item.personaId)}
                    className={`workflow-step-pill ${isCurrent ? "current" : ""} ${isDone ? "done" : ""}`}
                    title={`${item.instruction} (Click to switch to ${item.personaLabel})`}
                  >
                    <span className="workflow-step-num">
                      {isDone ? "✓" : `0${item.step}`}
                    </span>
                    <span className="workflow-step-text">
                      <b>{item.title}</b>
                      <small>{item.personaLabel}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {isGovernance && (
            <nav className="tabs" aria-label="Workspace views">
              <button
                className={page === "workspace" ? "tab active" : "tab"}
                onClick={() => setPage("workspace")}
              >
                Workspace
              </button>
              <button
                className={page === "governance" ? "tab active" : "tab"}
                onClick={() => setPage("governance")}
              >
                Governance review{" "}
                <span className="tab-count">
                  {requests.filter((r) => r.state !== "ACTIVE").length}
                </span>
              </button>
              <button
                className={page === "evidence" ? "tab active" : "tab"}
                onClick={() => setPage("evidence")}
              >
                Evidence timeline
              </button>
            </nav>
          )}

          {error && (
            <div role="alert" className="error-box">
              <strong>Action blocked</strong>
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}

          {page === "workspace" && (
            <div className="content-grid">
              <section className="panel study-panel">
                <div className="panel-header">
                  <div>
                    <div className="section-label">YOUR STUDY</div>
                    <h2>Student Wellbeing Interview Study</h2>
                  </div>
                  <span className="status-pill">ACTIVE</span>
                </div>
                <p className="study-description">
                  A fictional study exploring how students find support during
                  demanding study periods.
                </p>

                {actor.audiences.includes("PARTICIPANT") ? (
                  <div className="participant-summary">
                    <span className="summary-icon">✓</span>
                    <div>
                      <b>Your contribution is included (Participant P-014)</b>
                      <small>
                        Sharing scope: coded response for authorised research
                        use · other participants&apos; records (P-019, P-023)
                        are isolated
                      </small>
                    </div>
                  </div>
                ) : (
                  <div className="study-stats">
                    <div>
                      <span>Study ID</span>
                      <b>study-wellbeing-01</b>
                    </div>
                    <div>
                      <span>Ethics Ref</span>
                      <b>SYNTH-HREC-2026-014</b>
                    </div>
                    <div>
                      <span>Access scope</span>
                      <b>Study category</b>
                    </div>
                  </div>
                )}

                {actor.id === "assistant-01" && !activeRequest && (
                  <div className="reason-picker">
                    <label
                      htmlFor="request-reason-select"
                      className="section-label"
                    >
                      ACCESS REQUEST JUSTIFICATION (USED WHEN REQUESTING
                      RESTRICTED READ)
                    </label>
                    <select
                      id="request-reason-select"
                      value={selectedReason}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      disabled={busy}
                    >
                      {presetRequestReasons.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="divider" />
                <div className="section-label records-label">
                  STUDY MATERIAL ({records.length} VISIBLE RECORDS)
                </div>

                <div className="record-list">
                  {records.map((record) => {
                    const isOpen = opened?.id === record.id;
                    const label =
                      record.category === "INTERNAL"
                        ? "Internal"
                        : record.category === "RESTRICTED"
                          ? "Restricted"
                          : "Highly restricted";

                    return (
                      <article
                        className={`record-row ${isOpen ? "record-open" : ""}`}
                        key={record.id}
                      >
                        <div
                          className={`record-icon ${record.category.toLowerCase()}`}
                        >
                          {record.category === "INTERNAL"
                            ? "▤"
                            : record.category === "RESTRICTED"
                              ? "◈"
                              : "⌑"}
                        </div>
                        <div className="record-main">
                          <div className="record-title">
                            <b>{record.safeLabel}</b>
                            <span
                              className={`category-tag ${record.category.toLowerCase()}`}
                            >
                              {label}
                            </span>
                          </div>
                          <small>
                            {record.category === "INTERNAL"
                              ? "Study instructions & coding framework"
                              : record.category === "RESTRICTED"
                                ? "Coded participant content"
                                : "Identity mapping & consent ledger"}
                          </small>
                          {isOpen && (
                            <div className="opened-content">
                              <div className="content-preview">
                                {opened.content}
                              </div>
                              <small className="simulated-note">
                                Opened through local demo permission logic · not
                                a Tide crypto operation
                              </small>
                            </div>
                          )}
                        </div>
                        <div className="record-action">
                          {record.access.mayAttemptDecrypt ? (
                            <button
                              className="text-button"
                              disabled={busy}
                              onClick={() =>
                                void (isOpen
                                  ? setOpened(null)
                                  : openRecord(record.id))
                              }
                            >
                              {isOpen ? "Close" : "View"} <span>↗</span>
                            </button>
                          ) : (
                            <div className="action-stack">
                              <button
                                className="text-button denied-text"
                                disabled={busy}
                                onClick={() => void openRecord(record.id)}
                              >
                                Try read ↗
                              </button>
                              {record.access.canRequest && (
                                <button
                                  className="text-button request-text"
                                  disabled={busy}
                                  onClick={() => void createRequest(record.id)}
                                >
                                  Request access ↗
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="scope-note">
                  <span>ⓘ</span>
                  <span>
                    Governance review is separate from data access. A granted
                    RESTRICTED study scope unlocks coded responses (P-014,
                    P-019, P-023) but does not unlock HIGHLY_RESTRICTED identity
                    records.
                  </span>
                </div>
              </section>

              <aside className="side-column">
                <section className="panel access-panel">
                  <div className="section-label">ACCESS STATUS</div>
                  <h3>Current permissions</h3>

                  <div className="permission-row">
                    <span
                      className={`permission-icon ${actor.id === "participant-01" || actor.capabilities.includes("study:read") ? "granted" : "pending"}`}
                    >
                      {actor.id === "participant-01" ||
                      actor.capabilities.includes("study:read")
                        ? "✓"
                        : "⌑"}
                    </span>
                    <span>
                      <b>Internal protocol</b>
                      <small>Study instructions & codebook</small>
                    </span>
                    <span
                      className={
                        actor.id === "participant-01" ||
                        actor.capabilities.includes("study:read")
                          ? "granted-text"
                          : "pending-text"
                      }
                    >
                      {actor.id === "participant-01" ||
                      actor.capabilities.includes("study:read")
                        ? "Available"
                        : "Needs access"}
                    </span>
                  </div>

                  <div className="permission-row">
                    <span
                      className={`permission-icon ${restricted?.access.mayAttemptDecrypt ? "granted" : "pending"}`}
                    >
                      {restricted?.access.mayAttemptDecrypt ? "✓" : "⌑"}
                    </span>
                    <span>
                      <b>Coded responses</b>
                      <small>Study-wide RESTRICTED (P-014, P-019, P-023)</small>
                    </span>
                    <span
                      className={
                        restricted?.access.mayAttemptDecrypt
                          ? "granted-text"
                          : "pending-text"
                      }
                    >
                      {restricted?.access.mayAttemptDecrypt
                        ? actor.id === "participant-01"
                          ? "Your record"
                          : "Granted"
                        : "Needs review"}
                    </span>
                  </div>

                  <div className="permission-row">
                    <span
                      className={`permission-icon ${actor.id === "participant-01" ? "granted" : "locked"}`}
                    >
                      {actor.id === "participant-01" ? "✓" : "▣"}
                    </span>
                    <span>
                      <b>Identity mapping</b>
                      <small>HIGHLY_RESTRICTED</small>
                    </span>
                    <span
                      className={
                        actor.id === "participant-01"
                          ? "granted-text"
                          : "locked-text"
                      }
                    >
                      {actor.id === "participant-01" ? "Your record" : "Locked"}
                    </span>
                  </div>

                  <div className="access-foot">
                    {actor.id === "assistant-01"
                      ? "The assistant starts with internal access only."
                      : actor.id === "participant-01"
                        ? "Your ownership gives you access to your own contribution."
                        : "Governance permissions are distinct from research data rights."}
                  </div>
                </section>

                {actor.id === "assistant-01" && (
                  <section className="panel flow-card">
                    <div className="section-label">MY ACCESS REQUESTS</div>
                    <h3>Request progress</h3>
                    {requests.length === 0 ? (
                      <p className="empty-inline">
                        No request yet. Ask for the coded response when your
                        work needs it.
                      </p>
                    ) : (
                      requests.map((request) => (
                        <div className="my-request" key={request.id}>
                          <span
                            className={`request-state ${request.state.toLowerCase()}`}
                          >
                            {request.state.replaceAll("_", " ")}
                          </span>
                          <p>
                            {request.approvals}/{request.requiredApprovals}{" "}
                            local approvals
                          </p>
                          <small>Scope: RESTRICTED for the study</small>
                          {request.state === "COMMITTED" && (
                            <button
                              className="text-button"
                              disabled={busy}
                              onClick={() =>
                                void openRecord("record-coded-001")
                              }
                            >
                              Retry protected read ↗
                            </button>
                          )}
                          {request.state === "ACTIVE" && (
                            <small className="success-hint">
                              A local simulated read succeeded.
                            </small>
                          )}
                        </div>
                      ))
                    )}
                  </section>
                )}

                <section className="panel flow-card">
                  <div className="section-label">HOW ACCESS CHANGES</div>
                  <h3>Two independent approvals</h3>
                  <div className="flow-steps">
                    <div className="flow-step">
                      <span className="step-number">01</span>
                      <span>Researcher requests a defined study category</span>
                    </div>
                    <div className="flow-step">
                      <span className="step-number">02</span>
                      <span>Head researcher proposes the change</span>
                    </div>
                    <div className="flow-step">
                      <span className="step-number">03</span>
                      <span>Two distinct governance personas approve</span>
                    </div>
                  </div>
                  <div className="local-callout">
                    Local simulation only · approvals are stored in this demo
                    database.
                  </div>
                </section>
              </aside>
            </div>
          )}

          {page === "governance" && (
            <section className="panel review-panel">
              <div className="panel-header">
                <div>
                  <div className="section-label">
                    LOCAL SIMULATION · APPLICATION WORKFLOW
                  </div>
                  <h2>Access requests</h2>
                </div>
                <span className="approval-chip">
                  Two distinct approvals required
                </span>
              </div>
              <p className="study-description">
                This approval panel is a rehearsal interface. It does not create
                or approve a real Tide governance change.
              </p>

              {requests.length === 0 ? (
                <div className="empty-state">
                  No access requests yet. Switch to the research assistant to
                  create one.
                </div>
              ) : (
                <div className="review-list">
                  {requests.map((request) => (
                    <article className="review-card" key={request.id}>
                      <div className="review-card-top">
                        <div>
                          <span className="category-tag restricted">
                            STUDY · RESTRICTED · READ
                          </span>
                          <h3>Access request from {request.requesterId}</h3>
                          <p>“{request.reason}”</p>
                        </div>
                        <span
                          className={`request-state ${request.state.toLowerCase()}`}
                        >
                          {request.state.replaceAll("_", " ")}
                        </span>
                      </div>
                      <div className="request-meta">
                        <span>
                          Origin: <b>{request.scope.contextRecordId}</b>
                        </span>
                        <span>
                          Study scope: <b>{request.scope.studyId}</b>
                        </span>
                        <span>
                          Local approvals:{" "}
                          <b>
                            {request.approvals}/{request.requiredApprovals}
                          </b>
                        </span>
                        {request.governanceChangeId && (
                          <span>
                            Simulation reference:{" "}
                            <b>{request.governanceChangeId}</b>
                          </span>
                        )}
                      </div>
                      <div className="review-actions">
                        {request.state === "REQUESTED" &&
                          actor.id === "head-01" && (
                            <button
                              className="primary-button"
                              disabled={busy}
                              onClick={() => void propose(request.id)}
                            >
                              Propose simulated change
                            </button>
                          )}
                        {request.state === "PENDING_GOVERNANCE" && (
                          <>
                            <span className="approval-hint">
                              {request.approvals} of 2 distinct approvals ·
                              access remains locked
                            </span>
                            <button
                              className="primary-button"
                              disabled={busy}
                              onClick={() => void approve(request.id)}
                            >
                              Approve as{" "}
                              {actor.id === "head-01"
                                ? "head"
                                : actor.id === "steward-01"
                                  ? "steward"
                                  : "ethics representative"}
                            </button>
                          </>
                        )}
                        {request.state === "COMMITTED" && (
                          <span className="success-hint">
                            Simulated quorum met. Refresh as the assistant and
                            retry the read.
                          </span>
                        )}
                        {request.state === "ACTIVE" && (
                          <span className="success-hint">
                            Simulated permission is active after the assistant
                            opened the record.
                          </span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {page === "evidence" && <EvidencePanel />}
        </>
      )}

      <footer className="footer">
        <div>
          <span className="footer-mark">R</span>
          <span>
            ResearchVault <small>Prototype · synthetic content</small>
          </span>
        </div>
        <span>Local application events are not Tide audit evidence.</span>
        <button onClick={() => void refresh()}>Refresh workspace ↻</button>
      </footer>
    </main>
  );
}

function EvidencePanel() {
  const [items, setItems] = useState<Array<Record<string, string>>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<Array<Record<string, string>>>("/api/activity")
      .then((r) => setItems(r.data ?? []))
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <section className="panel review-panel">
      <div className="panel-header">
        <div>
          <div className="section-label">SOURCE-LABELLED EVENTS</div>
          <h2>Application evidence timeline</h2>
        </div>
        <span className="application-only">APPLICATION ONLY</span>
      </div>
      <p className="study-description">
        These sanitised events come from ResearchVault&apos;s local database.
        They are not signatures or a complete Tide audit trail.
      </p>
      {error && <div className="empty-state">{error}</div>}
      {items.length === 0 ? (
        <div className="empty-state">No local application events yet.</div>
      ) : (
        <div className="timeline">
          {items.map((item, i) => (
            <div
              className="timeline-event"
              key={`${item.correlation_id}-${i}`}
            >
              <span className="timeline-dot" />
              <div>
                <b>{item.action}</b>
                <small>
                  {item.occurred_at} · {item.source} · {item.result}
                </small>
                <code>Correlation: {item.correlation_id}</code>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function LiveSessionView({
  actor,
  status,
  initializing,
  authenticated,
  busy,
  login,
  logout,
}: {
  actor: ActorView | null;
  status: string;
  initializing: boolean;
  authenticated: boolean;
  busy: boolean;
  login: () => void;
  logout: () => void;
}) {
  return (
    <main className="app-shell">
      <div className="mode-banner">
        <span className="mode-dot" />
        LIVE MODE · Tide provider path{" "}
        {actor ? "· local personas disabled" : ""}
      </div>
      <header className="topbar">
        <a href="#home" className="brand">
          <span className="brand-mark">R</span>
          <span>
            ResearchVault
            <small>RMIT research participation demo</small>
          </span>
        </a>
        {authenticated && (
          <button className="quiet-button" disabled={busy} onClick={logout}>
            Sign out
          </button>
        )}
      </header>
      <section className="live-shell">
        <div className="eyebrow">
          <span className="eyebrow-line" />
          TIDE IDENTITY INTEGRATION
        </div>
        <h1>
          {initializing
            ? "Connecting to Tide…"
            : authenticated
              ? "Your Tide session is connected."
              : "Sign in with your Tide identity."}
        </h1>
        <p>{status}</p>
        {!authenticated && !initializing && (
          <button
            className="primary-button live-login"
            disabled={busy}
            onClick={login}
          >
            Continue with TideCloak
          </button>
        )}
        {actor && (
          <div className="panel live-proof">
            <div className="section-label">SERVER-VERIFIED SESSION</div>
            <h2>{actor.label}</h2>
            <div className="live-facts">
              <div>
                <span>Subject</span>
                <code>{actor.id}</code>
              </div>
              <div>
                <span>Application roles</span>
                <b>
                  {actor.rolesMapped
                    ? actor.capabilities.join(", ")
                    : "No explicit app role mapping"}
                </b>
              </div>
              <div>
                <span>Token binding</span>
                <b>DPoP proof verified on /api/me</b>
              </div>
              <div>
                <span>Workspace operations</span>
                <b>
                  Unavailable until shared encrypted payload and governed grant
                  paths are configured
                </b>
              </div>
            </div>
            <div className="local-callout">
              Live mode never falls back to synthetic personas or the local
              database. Tide identity alone does not grant research data access.
            </div>
          </div>
        )}
        <section className="panel live-proof">
          <div className="section-label">
            LIVE SHARED-VAULT READINESS · BLOCKED
          </div>
          <h2>RelationshipAttestation:1 adapter prepared</h2>
          <p>
            The browser adapter calls Tide’s official policy build, admin
            signing, encrypt, and decrypt helpers. It is gated until a real
            realm supplies vendor ID, signed admin policy, and enrolled
            identities. Those calls have not been tested against this project’s
            realm.
          </p>
          <div className="local-callout">
            Realm-admin policy signing is separate from the app’s simulated
            2-of-3 role-change flow. An admin may be able to sign an alternate
            policy for an existing decryptor; resistance to that path remains
            unverified.
          </div>
        </section>
        <div className="integration-gaps">
          <b>Live proof still required</b>
          <span>Real participant-to-researcher payload sharing</span>
          <span>Verified category policy and exact role mapping</span>
          <span>Real QEA change correlation and quorum results</span>
          <span>
            Existing ciphertext becomes readable after the verified grant
          </span>
        </div>
      </section>
      <footer className="footer">
        <div>
          <span className="footer-mark">R</span>
          <span>
            ResearchVault{" "}
            <small>Live identity · protected operations gated</small>
          </span>
        </div>
        <span>Identity does not imply access to protected study records.</span>
      </footer>
    </main>
  );
}
