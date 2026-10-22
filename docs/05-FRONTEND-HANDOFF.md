# Frontend handoff

Audience: coworker(s) building the frontend. The project owner builds backend, logic, integrated demo, and motion graphic video. This is a screen and behavior specification, not a finished design or existing UI.

## Confirmed surfaces and proposed interpretation

**Landing page**, **User UI**, **Researcher UI**, and secondary demo UI are required. User UI is confirmed to mean **participant**. Researcher UI contains assistant and head-researcher views; secondary governance views serve the data steward/ethics representative.

Routes below are proposed. Keep the feature IDs aligned with the [feature map](03-FEATURE-MAP.md) and response shapes aligned with the [API contract](06-API-AND-DATA-CONTRACT.md).

| Surface | Proposed route | Audience | Priority |
|---|---|---|---|
| Landing | `/` | Public | P0 |
| Sign-in | `/login` | All | P0 |
| Auth return | `/auth/redirect` | Tide SDK callback | P0; confirm exact SDK configuration |
| User home | `/user` | Participant | P0 |
| User study | `/user/studies/:studyId` | Participant | P0 |
| User contribution | `/user/records/:recordId` | Record owner | P0 |
| Researcher home | `/researcher` | Study team | P0 |
| Researcher study | `/researcher/studies/:studyId` | Assigned study team | P0 |
| Researcher record | `/researcher/records/:recordId` | Verified entitled reader | P0 |
| Researcher access requests | `/researcher/requests` | Assistant's own / head's review scope | P0 |
| Permission management | `/researcher/studies/:studyId/permissions` | Governed administrators | P0, fixed categories |
| Approval detail | `/governance/changes/:changeId` | Governance administrators | P0, native-console handoff acceptable |
| Evidence | `/evidence` | Authorised reviewers | P0, sanitised/source-labelled |
| Demo preparation | `/demo` | Local development operator only | P1; absent/blocked in public build |

The role used to route a signed-in person comes from verified identity. Landing buttons express intended destination, not a trusted choice of identity.

## Landing page

**Job:** explain the benefit in one screen, then offer an appropriate entry.

Suggested hero: **Research together. Keep participant data under controlled access.**

Include:

1. One sentence explaining participant contributions and scoped research access.
2. Two actions: **Participant workspace** and **Research workspace**.
3. Three short benefits: separate sensitive identifiers; grant access for a defined task; require independent approval for protected changes.
4. A simple three-step illustration: contribute → request access → independently approve.
5. A synthetic-data/hackathon-prototype label.

Avoid unsupported customer logos, fabricated metrics, compliance badges, and claims such as Unhackable or Military-grade. Long technical explanations belong in documentation rather than the main product journey.

## User UI: participant

### Home and study detail

- Study card with synthetic study title, plain-language purpose, and participation status.
- My contribution card with safe metadata and a link to the owned record.
- Sharing explanation: which categories are configured for the research team, who may request access, and what has not been implemented.
- Activity summary only for events actually available and permitted to this participant. It is not a claim of a complete per-view cryptographic audit.

### Contribution viewer

- Show the participant's own encrypted contribution only after successful authorised decryption.
- Keep identity details and response content in separate sections.
- Show permission/provider/session errors distinctly.
- Use a seeded contribution for P0. Add an editable encrypted submission form only after the backend owner proves cross-user sharing.

If withdrawal is not implemented, show explanatory text or an explicitly labelled request workflow. Do not place a live-looking Revoke access toggle that changes only fixture state. Do not expose another participant's record by changing a URL.

## Researcher UI: assistant

### Dashboard and study page

- Assigned study card; task/protocol link; safe record list.
- Record rows with category, coded identifier, and accessible/locked state.
- Own access requests with REQUESTED/PENDING_GOVERNANCE/COMMITTED/ACTIVE status.
- Do not expose identity mapping in previews, tooltips, hidden DOM, search suggestions, or notification text.

### Record viewer

Display three sections: internal protocol, restricted response, highly restricted identity mapping. The backend may represent these as separate records/payloads; use the contract rather than assuming one decryption opens all sections.

Locked state: **Additional permission required** and **Request access**. Request dialog contains the exact data category/resource, intended task, and reason. Prevent blank reasons and repeated submission while pending. Display server-confirmed outcome, not an optimistic success grant.

After a grant commits: show **Permission committed. Refresh access to continue.** Retry the protected operation after session refresh. Only actual success unlocks content.

## Researcher UI: head researcher

Reuse the study page with an additional permission-management surface:

- Team members and separately labelled study role/data entitlements.
- Fixed proposed category grants; no arbitrary policy-script editor.
- Request review showing requester, resource, category, and safe justification.
- **Propose governed change** action or exact instructions/link to the native Tide console.
- Pending change reference, authoritative state, sourced approval count where available, and last reconciliation time.

An app review action is not the same as a cryptographic approval. Label these actions differently. Do not convert Review into an approval counter increment or assume the head can assign data access instantly.

## Secondary demo screens

### Approval detail

Show the target identity, study, exact permission change, request ID, and current governance state. For P0, **Open Tide approval console** is an acceptable action. The actual approver authenticates and reviews there. Return to the app and refresh sourced status.

If the console link cannot deep-link to a particular request, link to the verified console and display the change ID to locate; do not invent a URL scheme. An unauthorised viewer sees access denied.

### Evidence view

Use a timeline/table with event time, safe action summary, source (Application or Tide governance), result, and correlation ID. Distinguish REQUESTED, one approval/pending, COMMITTED, and successful protected read. Display actual timestamps from data. A local activity entry must not be styled as a cryptographic signature proof.

### Error, empty, and expired states

Provide first-class views for no records, no requests, sign-in expired, permission denied, missing resource, provider unavailable, and unverified governance status. Keep restricted identifiers out of error messages.

### Development preview

Fixture account selectors and replay controls are permissible for design review only with a persistent **Fixture preview — simulated data and authority** label. The real demo uses actual authenticated accounts in separate profiles/windows. Preview controls must not reach privileged live endpoints.

## Shared components

AppShell; audience navigation; study card; record table; category badge; locked-content panel; access-request dialog; request-status timeline; governance summary; error panel; toast; empty-state panel; session indicator.

Use text and icons as well as colour. Proposed category colours are slate/amber/rose with readable contrast; these are suggestions, not an established brand. Keep motion restrained in the app so the owner can add motion graphics around clear captures.

## Interaction and accessibility requirements

- Usable at desktop recording size and narrow mobile width; tables may become cards.
- Visible keyboard focus, labelled fields, keyboard-operable dialogs, and clear error associations.
- Never indicate locked/approved state through colour alone.
- Async buttons disable only while their own operation is pending; show retry when safe.
- No secrets or sensitive payloads in browser logging, URLs, or analytics.
- Clear plaintext from view on logout/session change; isolate cached data by authenticated subject.
- Use the backend's canonical actor/permissions/status, not localStorage role flags.

## Frontend/backend handoff

Coworkers can first implement against fixture responses matching the API document. Preserve the same screen components when the owner provides a live adapter. Fixture completion is a layout milestone only.

Integration handoff includes: implemented routes, screenshots of major states, unresolved API questions, operations still simulated, and the exact adapter used. The owner provides: endpoint behavior, session method, supported crypto adapter, governance correlation, test accounts, and the live verification results.
