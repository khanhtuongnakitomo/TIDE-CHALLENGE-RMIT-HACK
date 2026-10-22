[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

# ResearchVault

## Project overview

ResearchVault is a study-scoped research participation vault where sensitive participant contributions are compartmentalised by clearance tier and broadening team access requires a 2-of-3 governance quorum rather than a single administrator.

### 1. Vision & originality

ResearchVault unifies a **participant portal** and a **research-team workspace** around compartmentalised data tiers (`INTERNAL`, `RESTRICTED`, `HIGHLY_RESTRICTED`). Rather than treating a study folder as one all-or-nothing permission boundary, protocols, coded interview transcripts, and direct identity mappings are encrypted and governed independently.

### 2. Trust constraint insight

Qualitative research teams face a painful trade-off: shared drives over-expose participant identities to every assistant, while centralising control in one lead researcher or IT admin creates a single point of compromise or unilateral override. Removing unilateral administrative authority makes least-privilege research collaboration safe and auditable.

### 3. Value & impact

In a university **Student Wellbeing Study** (`study-wellbeing-01`), participant **Maya Chen** can inspect her own contribution (`P-014`) knowing her identity mapping stays isolated. Research assistant **Riley Park** can immediately read study protocols and request scoped access to coded transcripts (`P-014`, `P-019`, `P-023`) for thematic coding—without ever unlocking direct participant identifiers.

### 4. Why TideCloak matters

Planned with **Tide's MCP (`Raziel`)**, ResearchVault integrates TideCloak across four boundaries: **RFC 9449 DPoP** sender-constrained sessions (`src/lib/auth/`), `resource_access` client role mapping, **2-of-3 Quorum-Enforced Authority (IGA)** so no single admin can self-approve a `RESTRICTED` grant, and **`RelationshipAttestation:1`** policy-bound encryption (`src/lib/tide/`). While TideCloak's network licensing is under load, sign-in, roles, quorum approvals, and AES-256-GCM decryption are simulated end-to-end.

### 5. Prototype & storytelling

Judges can run a **6-step interactive flow** across **5 personas** and **7 encrypted records**:

- **Maya (`participant-01`)** decrypts her own record (`P-014`); others stay hidden.
- **Riley (`assistant-01`)** reads `INTERNAL` guides, hits `403 MISSING_SCOPE` on `RESTRICTED` transcripts, and requests access.
- **Dr. Taylor (`head-01`)** proposes and signs (`1/2`)—access remains locked.
- **Jordan (`steward-01`)** signs (`2/2`), committing the grant; Riley refreshes authorization to decrypt `P-014`, `P-019`, and `P-023`, while `HIGHLY_RESTRICTED` identity records stay locked.

---

## Setup

No cloud deployment is required. Everything runs locally on loopback (`http://127.0.0.1:5173` for the Caldera Frontend UI and `http://127.0.0.1:3100` for the Next.js + SQLite Backend API).

### Prerequisites

- **Node.js** `>= 22.13.0` (uses Node's built-in `node:sqlite`)
- **pnpm** `10+`

### 1. Install and start the local application

From this folder in PowerShell or bash:

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

`pnpm dev` automatically clears stale listeners on ports `3100`/`5173` and starts both servers concurrently:

- **Frontend (Caldera UI):** **<http://127.0.0.1:5173>** (Vite + React Router 7 + Tailwind v4, proxying `/api/*` to the backend)
- **Backend API & Classic Workspace:** **<http://127.0.0.1:3100>** (Next.js 16 + SQLite + AES-256-GCM)

No passwords are needed for the 5 seeded study personas in `local-simulation` mode.

### 2. How to test the user workflow

#### Option A — Interactive Browser Walkthrough on Caldera Frontend (`http://127.0.0.1:5173`)

Once **<http://127.0.0.1:5173>** is open, use either **`/login`** (Quick Demo Authentication) or the **Demo controls → Quick Persona Switcher** in the top banner to step through the 6 stages:

| Step | Persona to select | Route | Action in UI | Expected result |
|---|---|---|---|---|
| **01** | `participant-01` (Maya Chen) | `/user` | Click **Decrypt my record** on `record-coded-001` (`P-014`) and `record-identity-001` | Reads own records via `GET /api/records/:id`; `P-019` and `P-023` remain hidden |
| **02** | `assistant-01` (Riley Park) | `/researcher` | Decrypt `record-protocol-001` (`INTERNAL`), click **Attempt decrypt** on `record-coded-001` (`403 MISSING_SCOPE`), then click **Request access** and submit a reason (`>= 20` chars) | Request created via `POST /api/access-requests` in `REQUESTED` state |
| **03** | `head-01` (Dr. Sam Taylor) | `/governance` | In **Governed change**, click **Propose governed change** | Calls `/propose` + `/approve` (`1 of 2` approvals); status moves to `PENDING_GOVERNANCE`; access stays locked |
| **04** | `steward-01` (Jordan Lee) or `ethics-01` (Alex Morgan) | `/governance` | Click **Open Tide approval console** → click **Sign as steward-01** → close modal and click **Sync provider status** | Reaches `2/2` quorum in SQLite; state becomes `COMMITTED` |
| **05** | `assistant-01` (Riley Park) | `/researcher` | Click **Refresh Authorization & Decrypt** on the committed banner, then click **Decrypt** on `record-coded-002` and `record-coded-003` | All 3 `RESTRICTED` coded responses (`P-014`, `P-019`, `P-023`) decrypt; state becomes `ACTIVE` |
| **06** | `assistant-01` (Riley Park) | `/researcher` | Click **Attempt decrypt** on `record-identity-001` or `record-identity-002` (`HIGHLY_RESTRICTED`) | Denied (`403 MISSING_SCOPE`, compartmentalized); participant identities stay protected |

Use **Demo controls → Scenario → Start: access locked** at any time to reset the SQLite database (`POST /api/demo/reset`) and purge decrypted state. Open **`/documentation#tidecloak`** while signed in to inspect the live simulated TideCloak JWT claims (`iss`, `sub`, `azp`, `cnf.jkt`, `resource_access`, and `RelationshipAttestation:1`).

#### Option B — Automated CLI Workflow & Verification Suite

Run the end-to-end 6-step user workflow verification and security boundary tests directly from the terminal:

```powershell
# Run the 6-step user workflow verification script (isolated temp SQLite DB)
pnpm test:workflow

# Run TypeScript checks across both backend and frontend
pnpm typecheck

# Build frontend production bundle
pnpm build:fe

# Run full HTTP workflow + live JWT/DPoP boundary & adapter unit tests
pnpm test

# Build Next.js production bundle and verify runtime mode isolation
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
