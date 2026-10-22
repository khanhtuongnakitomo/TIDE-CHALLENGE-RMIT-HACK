# Acceptance criteria, open decisions, and sources

Prepared 22 October 2026. This is an implementation handoff and verification specification, not a claim that the application checks below passed. See the [index](../README.md) for document responsibilities.

## Sources of truth

1. The project owner's latest instructions decide product scope and ownership.
2. The agreed API contract decides the frontend/backend interface; sample fields remain proposals until adopted.
3. Actual Tide configuration and successful operations decide runtime capability.
4. Official Tide material establishes documented capability and challenge requirements, not proof of this application's behavior.
5. UI fixtures establish only that a layout/state can be presented.

The earlier local `mock.md` is historical input. The participant User UI is now confirmed, so the current demo uses five personas rather than its earlier four-account outline.

## Acceptance checklist

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
| Framework and version pinning | Next.js/TypeScript, compatible Tide SDK | Owner before app scaffolding |
| Actual sharing/key policy | Supported multi-user Tide path | Owner at G2, before integrated record UI |
| Grant granularity | Study/category for P0 | Joint before API implementation |
| Fixed roles versus custom Forseti | Start supported fixed configuration; custom policy only when required | Owner at sharing/policy gate |
| Fresh participant submission | Seeded owned record P0; live submission P1 | Owner after G2/G4 |
| Consent controls | Explanation and existing scope only; no unverified live revocation | Owner before exposing consent actions |
| Native console versus custom approvals | Native Tide console P0 | Joint before secondary UI implementation |
| Session transport/refresh | Supported current SDK pattern | Owner before live adapter |
| Database driver | Minimal SQLite access or familiar ORM | Owner before persistence |
| Deployment and visibility | Local demo, private handoff repository | Owner before any public release |

## Build sequence and team handoff

1. **Agree boundaries:** adopt/revise contract and grant scope. Frontend coworker begins public/fixture layouts.
2. **Prove integration:** backend owner resolves shared crypto, governance, refresh, and identity separation.
3. **Connect one vertical slice:** denied read → real grant → actual protected read. Avoid building every secondary page first.
4. **Connect participant workspace:** show real own-record access; use live submission only if supported.
5. **Verify and rehearse:** run relevant acceptance checks, capture evidence, then prepare owner-produced motion graphics.

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

## Handoff completion versus application completion

This pack provides the proposal, architecture, feature map, technology plan, frontend specification, proposed contract, demo script, and acceptance criteria. Its verification is documentation consistency, source checking, and repository delivery. It does not install Tide, change agent settings, implement the backend/frontend, generate a video, establish a deployment, or prove runtime security. Those outcomes remain the owners' implementation work.
