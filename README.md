[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

# ResearchVault

## Project overview

_ResearchVault is a study-scoped research participation vault where sensitive participant contributions are compartmentalised by category and broadening team access requires independent quorum approval rather than a single administrator._

Built with [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked).

### 1. Vision & originality

ResearchVault connects a **participant workspace** and a **research-team workspace** around compartmentalised data categories (`INTERNAL`, `RESTRICTED`, `HIGHLY_RESTRICTED`). Instead of treating a study folder as a single permission boundary, protocols, coded interview responses, and participant identity mappings are separated and governed independently.

### 2. Trust constraint insight

Sensitive qualitative research today forces an uncomfortable trade-off: giving assistants broad shared-drive access risks exposing participant identities, while concentrating gatekeeping in one head researcher or IT admin creates a single point of compromise or unilateral override. Removing unilateral administrative authority makes least-privilege research collaboration practical.

### 3. Value & impact

In a university **Student Wellbeing Interview Study** (`study-wellbeing-01`), participant **Maya Chen** can view her own contribution (`P-014`) while knowing her identity mapping stays isolated. Research assistant **Riley Park** can immediately read study protocols and request access to coded transcripts (`P-014`, `P-019`, `P-023`) for thematic coding—without ever unlocking direct participant identifiers.

### 4. Why TideCloak matters

TideCloak enables sender-constrained authentication (**RFC 9449 DPoP**), **Quorum-Enforced Authority (IGA)** so one administrator cannot alone commit a sensitive permission grant, and **`RelationshipAttestation:1`** policy-bound encryption.

> **Current prototype boundary:** Live JWT + DPoP verification (`GET /api/me`), public adapter filtering, `RelationshipAttestation:1` browser helpers, and a local `tideorg/tidecloak-dev:0.14.41` container are implemented. Because upstream Midgard `FinalizeWallet` returned HTTP `503`/`500` during local realm license bootstrap, live payload/governance routes fail closed (`503`) and the default runnable demo operates as an explicitly labelled **local simulation** (SQLite + server-held AES-256-GCM demo key).

### 5. Prototype & storytelling

Judges can experience a complete **6-step interactive workflow** across **5 personas** and **7 synthetic records**:

1. **Participant isolation:** `participant-01` reads her own record (`P-014`); other participants' records (`P-019`, `P-023`) remain hidden.
2. **Access boundary:** `assistant-01` reads `INTERNAL` guides, is denied `RESTRICTED` coded responses (`403 MISSING_SCOPE`), and submits a scoped study-category `READ` request.
3. **Single-admin insufficiency:** `head-01` proposes the change and approves once (`1/2`); the request stays `PENDING_GOVERNANCE` and retries still fail.
4. **Independent quorum:** `steward-01` or `ethics-01` supplies the second distinct approval (`2/2`), moving the grant to `COMMITTED`.
5. **Scoped unlock:** `assistant-01` retries and reads all three `RESTRICTED` coded responses (`P-014`, `P-019`, `P-023`), transitioning the grant to `ACTIVE`.
6. **Continued compartmentalisation:** `HIGHLY_RESTRICTED` identity mappings remain locked (`403 MISSING_SCOPE`).

---

## Setup

No cloud deployment is required. Everything runs locally on loopback (`http://127.0.0.1:3100`).

### Prerequisites

- **Node.js** `>= 22.13.0` (uses Node's built-in `node:sqlite`)
- **pnpm** `10+`

### 1. Install and start the local application

From this folder in PowerShell or bash:

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm dev
```

Open **<http://127.0.0.1:3100>** in your browser. No passwords are needed in `local-simulation` mode.

### 2. How to test the user workflow

#### Option A — Interactive Browser Walkthrough (Recommended for Judges)

Once <http://127.0.0.1:3100> is open, use the **Interactive User Test Workflow** strip at the top of the workspace (or the quick persona switcher in the header) to step through the 6 stages:

| Step | Persona to select | Action in UI | Expected result |
|---|---|---|---|
| **01** | `participant-01` (Maya Chen) | Click **View** on `record-coded-001` (`P-014`) and `record-identity-001` | Reads own records; `P-019` and `P-023` are not visible |
| **02** | `assistant-01` (Riley Park) | Click **Try read** on `record-coded-001` (blocked), pick a justification, and click **Request access** | `403 MISSING_SCOPE` banner; request created in `REQUESTED` state |
| **03** | `head-01` (Dr. Sam Taylor) | Open **Governance review** tab → click **Propose simulated change** → click **Approve as head** | Moves to `PENDING_GOVERNANCE` (`1 of 2` approvals); access stays locked |
| **04** | `steward-01` (Jordan Lee) or `ethics-01` (Alex Morgan) | In **Governance review**, click **Approve as steward / ethics representative** | Reaches `2/2` quorum; state becomes `COMMITTED` |
| **05** | `assistant-01` (Riley Park) | Click **View** on `record-coded-001`, `record-coded-002`, and `record-coded-003` | All 3 `RESTRICTED` coded responses open; state becomes `ACTIVE` |
| **06** | `assistant-01` (Riley Park) | Click **Try read** on `record-identity-001` or `record-identity-002` (`HIGHLY_RESTRICTED`) | Still denied (`403 MISSING_SCOPE`); identifiers stay protected |

Click **Reset demo** in the top navigation bar at any time to reset the SQLite workflow state without restarting the server.

#### Option B — Automated CLI Workflow & Verification Suite

Run the end-to-end 6-step user workflow verification and security boundary tests directly from the terminal:

```powershell
# Run the 6-step user workflow verification script (isolated temp SQLite DB)
pnpm test:workflow

# Run TypeScript checks
pnpm typecheck

# Run full HTTP workflow + live JWT/DPoP boundary & adapter unit tests
pnpm test

# Build production bundle and verify runtime mode isolation (local-simulation vs live)
pnpm build
pnpm smoke:production-mode
```

To reset the persisted `.data/researchvault.sqlite` database from the CLI when the dev server is stopped:

```powershell
pnpm demo:reset
```

---

## Synthetic & Mock Dataset

All data in this repository is **100% synthetic** (see [`fixtures/synthetic-wellbeing-study.json`](fixtures/synthetic-wellbeing-study.json) and [`src/lib/seed.server.ts`](src/lib/seed.server.ts)):

| Record ID | Category | Owner | Label | Purpose in Test Workflow |
|---|---|---|---|---|
| `record-protocol-001` | `INTERNAL` | `participant-01` | Interview guide · v1 | Readable by participant and assigned study researchers |
| `record-protocol-002` | `INTERNAL` | `study-team` | Thematic codebook · v2.1 | Readable by assigned study researchers (`assistant-01`, `head-01`) |
| `record-coded-001` | `RESTRICTED` | `participant-01` | Coded interview response · P-014 | Maya's coded transcript; unlocks for assistant after 2-of-3 quorum |
| `record-coded-002` | `RESTRICTED` | `participant-02` | Coded interview response · P-019 | Cohort coded transcript; unlocks under study-category `RESTRICTED` grant |
| `record-coded-003` | `RESTRICTED` | `participant-03` | Coded interview response · P-023 | Cohort coded transcript; unlocks under study-category `RESTRICTED` grant |
| `record-identity-001` | `HIGHLY_RESTRICTED` | `participant-01` | Participant identity mapping | Readable by Maya (`participant-01`); stays locked to assistant after grant |
| `record-identity-002` | `HIGHLY_RESTRICTED` | `participant-02` | Cohort identity linkage · P-019 & P-023 | Custodian-only linkage ledger; stays locked to assistant and Maya |

---

## Documentation Index

- [01 — Product Proposal](docs/01-PROPOSAL.md)
- [02 — System Architecture](docs/02-SYSTEM-ARCHITECTURE.md)
- [03 — Feature Map & Permission Matrix](docs/03-FEATURE-MAP.md)
- [04 — Tech Stack & TideCloak Integration Gates](docs/04-TECHSTACK-AND-TIDE-INTEGRATION.md)
- [05 — Frontend Handoff](docs/05-FRONTEND-HANDOFF.md)
- [06 — API & Data Contract](docs/06-API-AND-DATA-CONTRACT.md)
- [07 — Demo Flow & Video Brief](docs/07-DEMO-FLOW-AND-VIDEO-BRIEF.md)
- [08 — Acceptance Criteria & Sources](docs/08-ACCEPTANCE-AND-SOURCES.md)
- [09 — Local TideCloak Docker Setup](docs/09-TIDECLOAK-LOCAL-SETUP.md)
