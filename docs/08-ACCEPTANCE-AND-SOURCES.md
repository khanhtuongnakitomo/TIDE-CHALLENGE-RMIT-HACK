# Acceptance criteria, open decisions, and sources

Prepared 22 October 2026. This checklist remains the target for a real Tide-backed application. The local simulation passes only the application-level portions described in the README and HTTP tests; it does not satisfy claims requiring Tide identities, governance, or cross-user cryptography. See the [index](../README.md) for runnable setup and current boundaries.

## Sources of truth

1. The project owner's latest instructions decide product scope and ownership.
2. The agreed API contract decides the frontend/backend interface; sample fields remain proposals until adopted.
3. Actual Tide configuration and successful operations decide runtime capability.
4. Official Tide material establishes documented capability and challenge requirements, not proof of this application's behavior.
5. UI fixtures establish only that a layout/state can be presented.

The earlier local `mock.md` is historical input. The participant User UI is now confirmed, so the current demo uses five personas rather than its earlier four-account outline.

## Acceptance checklist

**Current evidence boundary:** the executable local app covers ownership, study membership, denial before approval, scoped request persistence, distinct local approvers, session isolation, and identity-category denial. These are verified against the local simulator, not Tide. A local `researchvault` realm has been imported, but upstream licensing/vendor key generation is incomplete, so a licensed and usable real realm plus end-to-end runtime evidence are still required for A07–A11 and the Tide-backed portions of A13–A16. The UI, APIs, and activity timeline identify local simulation events as such.

| ID | Check | Pass condition | Evidence to keep |
|---|---|---|---|
| A01 | Participant identity | User UI belongs to authenticated participant | Real session and actor mapping |
| A02 | Ownership | Participant cannot fetch another participant's record | Direct API attempt, safe denial |
| A03 | Study filtering | Researcher list exposes only permitted study metadata | Filtered response and direct-call check |
| A04 | Internal access | Assistant can read study protocol | Successful actual request |
| A05 | Restricted denial | Assistant cannot open protected response before grant | API and/or actual crypto denial; exact enforcing layer stated |
| A06 | Encrypted storage | Sensitive synthetic payload is ciphertext in stored data | Sanitised sample inspection; no plaintext logging |
| A07 | Shared decryption | Different intended account opens participant-created payload | Account-specific operation result; provider/SDK versions |
| A08 | Exact grant mapping | App request refers to intended target, study/category, action | Correlated real provider change |
| A09 | One approval insufficient | Demonstrated change remains pending and access remains denied | Tide status and retry |
| A10 | Quorum commits | Configured second approval commits exact change | Provider commitment/reference |
| A11 | Authorisation refresh | Updated user entitlement and protected read succeed | Actual refresh/re-auth and decrypt result |
| A12 | Identifier boundary | Restricted grant does not open identity payload | Separate denial after successful response read |
| A13 | Administrator data separation | Governance account does not inherit all data rights | Role/data mapping and actual denied read |
| A14 | Status integrity | UI uses provider-backed state; does not activate on local flags | Mutation/direct-call checks and source labels |
| A15 | Session/cache isolation | Logout/account switch clears prior plaintext | Manual account-switch check |
| A16 | Failure behavior | Tide/network failure displays unavailable, not fake success | Controlled failed-provider response |
| A17 | Fixture separation | Preview is visibly simulated and cannot mutate live authority | Adapter/config inspection and screen check |
| A18 | Navigation and accessibility | Main three surfaces plus secondary flow work at desktop/narrow width | Manual keyboard/layout review |
| A19 | Demo reproducibility | Starting denial and pending grant can be recreated safely | Rehearsal run with scoped setup/reset |
| A20 | Video truthfulness | Recording matches verified states and distinguishes graphics/replay | Review of final narration and video |

Tests should protect consequential behavior: identity, ownership, grant scope, provider reconciliation, and cache isolation. Do not create tests that merely assert that a badge has the same text as a fixture. Reuse project checks when the application exists.

## Claims to avoid

- Military-grade or certified security, regulatory compliance, or ethical approval inferred from the prototype.
- No administrator can ever override anything, without reviewing bootstrap/master realm/offboarding paths and the deployed policy.
- Two administrator accounts imply two required approvals.
- A role named Ethics means an ethics approver is mandatory under standard any-two quorum.
- A pending/committed application row is a cryptographic permission grant.
- An internal protocol displayed successfully proves shared encrypted access.
- Coded responses are anonymous, or permission withdrawal erases downloaded data.
- A local event log is a complete, immutable record of every decryption.
- Participant consent is enforced merely because a checkbox exists.

## Open implementation decisions

| Decision | Recommended baseline | Who resolves / when |
|---|---|---|
| Final product name | ResearchVault working title | Owner before branding/video |
| Framework and version pinning | Next.js App Router/TypeScript and pinned Tide SDK dependencies are implemented; versions are in `package.json` | Change only if a supported live integration requires it |
| Actual sharing/key policy | Supported multi-user Tide path | Owner at G2, before integrated record UI |
| Grant granularity | Study/category READ in the local simulation; real Tide mapping remains unverified | Joint at G2/G3 |
| Fixed roles versus custom Forseti | Start supported fixed configuration; custom policy only when required | Owner at sharing/policy gate |
| Fresh participant submission | Seeded owned record P0; live submission P1 | Owner after G2/G4 |
| Consent controls | Explanation and existing scope only; no unverified live revocation | Owner before exposing consent actions |
| Native console versus custom approvals | Native Tide console P0 | Joint before secondary UI implementation |
| Session transport/refresh | Supported current SDK pattern | Owner before live adapter |
| Database driver | Node built-in SQLite for local persistence; no ORM | Revisit only if deployment needs another store |
| Deployment and visibility | Local demo, private handoff repository | Owner before any public release |

## Build sequence and team handoff

1. **Finish realm provisioning:** local Docker hosting and Tide terms are confirmed, and the `researchvault` realm/client are imported. Licensing is blocked by a Midgard `FinalizeWallet` HTTP 503; IGA, the admin invite, identity enrollment, and adapter export are still incomplete. Resume after the upstream licensing failure is resolved; do not treat the pending-license flag as proof of a usable realm.
2. **Prove live sharing:** sign the supported browser policy, encrypt as participant, and verify cross-user decrypt for the existing ciphertext.
3. **Prove live governance:** correlate the exact scope with Tide's pending/committed change and verify refresh, denial below quorum, and identity denial after grant.
4. **Review authority boundaries:** assess policy issuance by realm admins and master-realm/QEA limitations before making resistance claims.
5. **Rehearse only verified states:** keep simulation and live evidence visibly separate; motion graphics remain a separate owner task.

This is a sequence, not a promise of a particular build duration. If the remaining event time is short, preserve the real integration and reduce screen breadth before adding optional features.

## Source register

Official sources checked 22 October 2026. The challenge page was read in the browser because the web text retriever could not access it. Product, UI, API, scope, fixture, and video recommendations in this pack are our proposed design, not statements copied from these sources.

| ID | Source | What it supports / limit |
|---|---|---|
| S1 | [UNLOCKED challenge](https://tide.org/unlocked/) | Working TideCloak prototype; useful possibility enabled by reduced unilateral authority; examples are inspiration |
| S2 | [Submission requirements](https://tide.org/unlocked/#submit) | Public repository, short README overview, two-minute MP4 under 100 MB, form and venue deadlines |
| S3 | [Judging](https://tide.org/unlocked/#judging) | Vision 25%; trust insight 20%; value 20%; Tide relevance 20%; prototype/story 15% |
| S4 | [TideCloak Next.js SDK](https://docs.tide.org/Languages/NextJS/tidecloak-nextjs-intro) | Supported Next.js integration features; does not establish our installed version |
| S5 | [TideCloak Quickstart](https://docs.tide.org/get-started/Tidecloak%20Quickstart) | Docker/template and interactive bootstrap; examples are not a verified Windows setup |
| S6 | [Setting up E2EE](https://docs.tide.org/Admin/e2ee) | Browser SDK crypto and governed role/tag setup; basic self-access is not our multi-user proof |
| S7 | [QEA governance](https://docs.tide.org/Core-Concepts/iga-workflow) | Governed change lifecycle, threshold table, master-realm exception |
| S8 | [Forseti](https://docs.tide.org/Core-Concepts/forseti-engine) | Programmable policy capability; our policy/deployment remains unverified |
| S9 | [Raziel MCP](https://docs.tide.org/ai-agent-pack) | MCP guidance package and integration playbooks; client-specific setup must match current host |
| S10 | [Agent setup page](https://tide.org/agent-plugins) | Current advertised MCP endpoint and guidance purpose |

## Application and handoff status

The repository now includes a runnable local Next.js application, a SQLite-backed synthetic workflow, local persona UI, security-focused HTTP tests, and a fail-closed Tide integration boundary. This is not a live Tide deployment, cryptographic sharing proof, production service, or generated video. The README records exact local commands and current verification. The proposals and source-backed limits in this document continue to govern claims about unverified live behavior.
