# Proposed API and data contract

Audience: project owner/backend implementer and frontend coworker(s). This document began as a proposed contract. The local-simulation routes listed below are implemented and backed by SQLite; they are application behavior, not Tide provider APIs. Live `GET /api/me` validates a Tide JWT and DPoP proof when configured, while live payload and governance operations remain unavailable (503). Proposed endpoints that do not exist are marked separately.

## Identity and transport

Use one documented session mechanism selected during Tide integration. Browser requests to the app must resolve to a verified Tide identity; do not accept an identity/role supplied in the JSON body. If cookie-based, protect mutations against CSRF and use appropriate cookie settings. If token-based, use supported token/session handling and required sender-bound verification; do not store long-lived credentials in localStorage.

The frontend receives no administrator secret. Do not create an unauthenticated endpoint that approves requests on behalf of every administrator. Dates are ISO 8601 with timezone, stored in UTC and rendered for the viewer. Identifiers are opaque strings.

## Grant scope: decide this once

**P0 recommendation: a study/category grant.** Granting RESTRICTED access permits the configured restricted dataset in that study, not only the record from which the request was opened. Say this clearly in the request dialog and approval detail.

```json
{
  "kind": "STUDY_CATEGORY",
  "studyId": "study-wellbeing-01",
  "dataCategory": "RESTRICTED",
  "action": "READ",
  "contextRecordId": "record-coded-001"
}
```

`contextRecordId` explains the request's origin; it does not narrow the grant. If the owner selects per-record grants instead, update the policy mapping, API shape, UI language, and acceptance checks together. Never advertise narrower access than the actual crypto configuration enforces.

## Shared models

| Model | Key fields | Authority and privacy |
|---|---|---|
| CurrentUser | `id`, `audiences`, `studyMemberships`, `capabilities`, `mode` | Derived from verified identity and configured mapping |
| Study | `id`, `title`, `description`, `participationStatus` | Safe study metadata; no sensitive participant list by default |
| RecordSummary | `id`, `studyId`, `category`, `safeLabel`, `access` | Filtered by ownership/scope; labels must be safe to disclose |
| RecordEnvelope | Summary + `payload`, `policyRef` | Supported Tide-produced opaque ciphertext and bound policy metadata |
| AccessRequest | `id`, `requesterId`, `scope`, `reason`, `state`, `governanceChangeId` | Requester set server-side; scope validated; reason treated as potentially sensitive |
| GovernanceChange | `id`, `providerChangeId`, `state`, `approvals`, `requiredApprovals`, `source`, `observedAt` | Sourced from actual Tide change, never a client counter |
| ActivityEvent | `id`, `occurredAt`, `action`, `source`, `correlationId`, `result` | Sanitised; coverage/source explicitly described |

Suggested categories: `INTERNAL`, `RESTRICTED`, `HIGHLY_RESTRICTED`. Suggested audiences: `PARTICIPANT`, `RESEARCHER`, `GOVERNANCE`. A participant can also be a researcher, so audiences are not necessarily mutually exclusive.

Suggested access view:

```json
{
  "canRequest": true,
  "mayAttemptDecrypt": false,
  "reasonCode": "MISSING_SCOPE",
  "verifiedAt": "2026-10-22T05:00:00Z"
}
```

This view guides the UI. `mayAttemptDecrypt: true` means the current entitlement check permits an attempt, not that every subsequent crypto call is guaranteed to succeed.

## Endpoint map: implemented local routes

| Method and path | Caller | Current behavior |
|---|---|---|
| `GET /api/status` | Anyone on loopback in local mode | Mode/readiness only; live reports provider/auth readiness and explicitly false payload/governance readiness |
| `POST /api/demo/login` | Local demo user | Select one of five synthetic personas; rotates the HTTP-only session |
| `POST /api/logout` | Signed-in local persona | Clears the session |
| `GET /api/me` | Signed in | Local persona in simulation; in live mode, verified Tide actor, mapped roles, and DPoP status |
| `GET /api/studies` | Local participant or study reader | One safe synthetic study; unavailable to other personas |
| `GET /api/records?studyId=...` | Local participant or member | Actor-filtered record summaries, access projection, and simulated grant state |
| `GET /api/records/:recordId` | Local permitted owner/member | Opens the local server-encrypted payload or returns safe denial; never a live Tide decrypt |
| `GET /api/access-requests` | Local requester or governance reviewer | Requester's records or reviewable requests, with local approval count/source |
| `POST /api/access-requests` | Local research assistant | Validated study/category READ request; returns `REQUESTED` and supports idempotency key |
| `POST /api/access-requests/:requestId/propose` | Local head researcher | Moves one request to `PENDING_GOVERNANCE`; creates only a labelled simulated change reference |
| `POST /api/access-requests/:requestId/approve` | Local steward, ethics, or head persona | Distinct local approvals; second qualifying approval moves it to `COMMITTED` |
| `GET /api/activity` | Local governance persona | Sanitised local application events only |

All local simulator routes are loopback- and mode-gated. Live `POST /api/demo/login`, `POST /api/logout`, and local data/workflow routes fail closed. There is no implemented `POST /api/records`, study-detail route, request-detail route, Tide change lookup/sync route, or provider approval route. The approval endpoint above is exclusively for local simulation and does not replace the native Tide console.

## Proposed, not implemented live endpoints

The following paths describe future adapter capabilities only; do not call them from the current app or present them as implemented:

| Proposed path | Intended live purpose |
|---|---|
| `POST /api/records` | Participant contribution using a verified Tide encryption flow |
| `GET /api/access-requests/:requestId` | Request detail for requester/reviewer |
| `GET /api/governance/changes/:changeId` | Provider-sourced change and quorum state |
| `POST /api/governance/changes/:changeId/sync` | Reconcile provider commitment and effective entitlement |

Tide provider endpoints remain vendor-owned and must be discovered from the selected realm/SDK; the app has not guessed them.

The approval action itself uses the native Tide console for P0. Do not invent a ResearchVault approval endpoint before the owner validates the authenticated approval/signature flow. Participant activity visibility, if added, must be independently filtered.

## Response convention

Successful application responses:

```json
{
  "data": {
    "id": "request-001",
    "state": "PENDING_GOVERNANCE",
    "governanceChangeId": "change-001"
  },
  "meta": {
    "mode": "fixture",
    "source": "APPLICATION",
    "correlationId": "demo-correlation-001"
  }
}
```

This example is a **fixture shape**, not evidence. In the integrated adapter use `mode: live` only when backed by actual integration. Governance evidence additionally names `TIDE_QEA`, its real provider reference, and the observation time. Do not fill absent provider evidence with fabricated IDs.

Error responses:

```json
{
  "error": {
    "code": "MISSING_SCOPE",
    "message": "Additional permission is required for this data category.",
    "correlationId": "demo-correlation-002"
  }
}
```

| HTTP/code | UI behavior |
|---|---|
| 401 `SESSION_REQUIRED` | Clear sensitive view and offer sign-in |
| 403 `MISSING_SCOPE` | Safe locked state; access request only if eligible |
| 404 `NOT_FOUND` | Generic missing/unavailable view; do not reveal other users' resource existence |
| 409 `REQUEST_ALREADY_PENDING` | Link existing request; do not create another provider change |
| 409 `STATE_CONFLICT` | Reload current state; no optimistic activation |
| 422 `INVALID_INPUT` | Associate validation errors with fields |
| 503 `TIDE_UNAVAILABLE` | Provider unavailable/retry; no fallback approval or plaintext |
| 502 `PROVIDER_STATE_UNVERIFIED` | Show unverified state and retry reconciliation |

Tide can return its own statuses/codes, such as a quorum-not-met response. The integration adapter maps them deliberately; these application codes are not direct claims about provider responses.

## Mutation example

Request:

```json
{
  "scope": {
    "kind": "STUDY_CATEGORY",
    "studyId": "study-wellbeing-01",
    "dataCategory": "RESTRICTED",
    "action": "READ",
    "contextRecordId": "record-coded-001"
  },
  "reason": "Code the interview themes assigned to me."
}
```

Server derives the requester from session, validates membership and resource category, validates the reason, and prevents duplicate active requests. Use an idempotency key or equivalent server constraint for retries. The body must not accept `approved`, `role`, `requesterId`, or `approvalCount` as authority.

On proposal, bind provider change to the exact target subject, study/category, action, and policy version. A second click or retry must reuse or safely reconcile the same logical change. A different permission change cannot satisfy the request merely because it has enough approvals.

## Status mapping

Application states are REQUESTED, PENDING_GOVERNANCE, COMMITTED, ACTIVE, REJECTED, FAILED. Map provider states explicitly rather than relying on identical names.

- REQUESTED means an app request only.
- PENDING_GOVERNANCE means a correlated real change is awaiting commitment.
- COMMITTED means confirmed provider commitment; refresh/retry may still be required.
- ACTIVE is a **display projection** after effective entitlement is observed and the intended protected read succeeds in the actual session. It is not an independent source of authorisation.

A browser's report of decryption success can drive its own viewer and a labelled client-reported event, but must never create a server entitlement or be presented as independent cryptographic audit proof. Keep effective rights and transient viewer results separate in implementation.

**Current implementation boundary:** local simulation stores these states in SQLite and changes a request to ACTIVE after a successful simulated read. That is test-app behavior only. In `RESEARCHVAULT_MODE=live`, the app returns an explicit unavailable response for protected payload and governance-change operations; it does not create a Tide change request, observe a provider quorum, or grant access from a client-reported result. Local AES-GCM uses a server-held demo key and does not implement the proposed client-side E2EE boundary below.

## Ciphertext handling

The intended live integration still needs a verified `cryptoAdapter` using supported Tide operations:

```text
encryptContribution(plaintext, verifiedScope) → opaque ciphertext envelope
decryptRecord(envelope, currentSession) → plaintext or explicit crypto/session/provider error
```

These names are local adapter proposals. They are not Tide method names. A browser-only wrapper around the official `RelationshipAttestation:1` sample helpers is prepared in `src/lib/tide/shared-vault.ts`, but it has not been run against a ResearchVault realm and is not wired to live record storage or governance. Keep the provider's envelope intact; do not hand-roll key distribution or invent its wire format. The server validates allowed bindings and stores ciphertext without receiving transcript plaintext under the proposed E2EE boundary.

The policy-signing operation is performed by a realm admin through the supported browser enclave flow. It is separate from the local app's two-of-three approval simulation. Whether a realm admin can issue an alternate policy for an existing decryptor remains an open threat-model question; the local quorum does not establish resistance to that path.

The viewer must distinguish backend denial from a failed crypto operation. A UI fixture can populate either state but is never proof of enforcement. Record-view events cannot imply a complete Fabric audit unless a verified source supports that claim.

## Fixture contract and minimum dataset

Use five persona keys: `participant-01`, `assistant-01`, `head-01`, `steward-01`, `ethics-01`. These are fictional app fixture IDs, not real Tide account identifiers or login credentials.

Use one study and three payloads: `record-protocol-001` INTERNAL, `record-coded-001` RESTRICTED, and `record-identity-001` HIGHLY_RESTRICTED. Participant owns the contribution. Assistant starts with internal access; head/steward/ethics have governance capabilities independent of explicit data rights.

Fixture adapter covers loading, locked, requested, pending with one approval, committed, permitted content, identifiers still locked, session expiry, and provider unavailable. It must not mix simulated approvals into a live session. Real account IDs and encrypted blobs are generated during setup and stay out of documentation.

## Joint acceptance before integration

Agree session mechanism; study/category versus record grant scope; SDK/version; sharing/key model; governance correlation; ownership checks; error mapping; session refresh timing; and fixture/live switch boundaries. Frontend should not infer these from sample text or the earlier `mock.md`.
