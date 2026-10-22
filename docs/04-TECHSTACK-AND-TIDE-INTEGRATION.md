# Technology stack and Tide integration

Status: the local application scaffold and simulation are implemented. Docker runs TideCloak 0.14.41 on loopback, and the canonical `researchvault` realm plus `researchvault-web` client have been imported. `setUpTideRealm` failed with HTTP 500 after Midgard `FinalizeWallet` returned HTTP 503; the realm has a Tide IdP but licensing is unresolved, IGA remains off, and no admin invite or adapter export is available. Protected live payload/governance APIs remain fail-closed and unverified.

## Stack proposal

| Layer | Proposed choice | Job in this product | Why keep it |
|---|---|---|---|
| Web application | Next.js App Router + TypeScript | Landing, User UI, Researcher UI, API routes | One deployable application and documented Tide SDK path |
| Styling | Tailwind CSS | Shared page layout, status badges, responsive tables | Fast coworker implementation; no custom component framework needed |
| Tide SDK | `@tidecloak/nextjs` | Browser/session integration and documented crypto hooks | Avoid handwritten authentication or encryption protocols |
| Identity/governance | TideCloak development instance | Roles, sign-in, governed changes, approval console | Real challenge integration |
| Cryptographic enforcement | Supported Tide Fabric operations | Protected encrypt/decrypt or policy-governed operation | The material difference from app-only permissions |
| Database | SQLite | Metadata, ciphertext envelopes, requests, QEA references | Sufficient for one local demo with a small dataset |
| Database access | A minimal SQLite driver or existing project ORM | Parameterised persistence | Backend owner selects; do not add an ORM solely for the handoff |
| Tide server runtime | Docker Desktop on Windows | Run the development TideCloak container | Matches the development workflow; verify Docker is working first |
| Package manager | pnpm | App dependency management | Project preference; retain vendor initializer requirements if it expects npm |
| Integration assistant | Tide MCP / Raziel | Serve current Tide playbooks to the coding agent | Development guidance, not runtime enforcement |
| Motion graphics | Owner's chosen editor | Final narrated video | No specific editor or asset pipeline imposed |

The runnable app currently uses Next.js App Router, TypeScript, pnpm, and Node's built-in SQLite support. It includes the official Tide SDK packages and a prepared browser-side shared-vault helper. The local TideCloak container and realm are present, but failed licensing means the app has no usable realm configuration yet. The app's `local-simulation` mode is synthetic server-side AES-GCM and app-enforced governance; it is not the Tide/Fabric security design described below. See the README for tested setup commands and exact mode boundaries.

The official [Next.js SDK](https://docs.tide.org/Languages/NextJS/tidecloak-nextjs-intro) documents session integration, roles, API verification, and tagged encryption. The [Quickstart](https://docs.tide.org/get-started/Tidecloak%20Quickstart) describes a Docker-backed template and an interactive first-administrator enrolment step. Its Linux setup examples require Windows adaptation; local development still needs network access to Tide services.

The challenge page at <https://tide.org/unlocked/#challenge> links to MCP and Quickstart material; it does not provide a ResearchVault-specific realm or hosted credentials. Local hosting was selected, the owner supplied the license email and accepted Tide's terms, and the full canonical template was imported. Bootstrap is incomplete because Midgard returned HTTP 503 during wallet finalization. No admin was invited or enrolled, and no adapter configuration was exported. Do not retry setup against this partial realm or treat its pending-license status as proof of a complete license; resume after the upstream failure is resolved.

For DPoP URL binding, direct loopback development derives the origin from a strictly validated `Host` header and ignores `X-Forwarded-*`. A reverse-proxy deployment must configure the exact browser-facing `TIDE_PUBLIC_ORIGIN`; forwarded headers are not trusted by the app.

## What Tide contributes

| Capability | Product mapping | Evidence needed in our application |
|---|---|---|
| Authentication | Distinct participant, assistant, and governance accounts | Real sign-in and identity-derived permissions |
| Governed roles/QEA | Head researcher cannot alone commit the demonstrated sensitive grant | Actual pending change after one approval and commitment at quorum |
| Browser crypto | Sensitive content stored encrypted and opened in authorised browser | Ciphertext persistence, allowed decryption, denied decryption |
| Forseti | Optional resource/category/approver constraints beyond fixed roles | Chosen supported policy, trusted parameter binding, end-to-end test |
| Raziel MCP | Agent follows integration guidance | Live read-only tool discovery and one successful guidance call |

Use three distinct administrators as the intended demo target, but verify the actual signed `tide-realm-admin` policy and provider quorum behavior. The live commit gate uses the threshold encoded in that signed policy; `max(1, floor(0.7 × N))` is only a fallback/projection and does not establish the active threshold. A changed threshold requires a committed `REGEN_ADMIN_POLICY` change. Tide's master realm is outside QEA, so assess that administrative boundary rather than claiming universal protection.

Tide's [encryption guide](https://docs.tide.org/Admin/e2ee) uses committed role/tag configuration and demonstrates `selfencrypt`/`selfdecrypt`. That example is not proof of cross-user sharing. Do not give sensitive decrypt roles to the default user group merely because the tutorial uses a broad default for illustration.

## Minimum implementation strategy

Start with supported SDK behavior, fixed categories, and the native Tide approval console. Defer a general-purpose policy builder. A dropdown with labels like Restricted does not establish an actual cryptographic policy.

If a custom policy is necessary for shared records, use the MCP's current sharing/encryption guidance and the official [Forseti documentation](https://docs.tide.org/Core-Concepts/forseti-engine). Forseti uses programmable contracts for roles, data checks, and approvals; do not assume an arbitrary `studyId` supplied by the browser is trustworthy. Bind the selected ciphertext/resource and committed policy to the operation being authorised.

An ordinary API authorisation check remains necessary even when crypto is enforced. Governance approval alone neither anonymises records nor guarantees participant consent.

## Connecting and using Tide MCP

1. Inspect the actual agent client's supported MCP configuration method. Do not copy potentially stale client-specific config examples blindly.
2. Use Tide's [current setup page](https://tide.org/agent-plugins). Its advertised remote endpoint is `https://mcp.tide.org/mcp`; the [MCP documentation](https://docs.tide.org/ai-agent-pack) also describes the local package `@tideorg/mcp`.
3. Confirm tool discovery and make a read-only playbook/router request. A config entry alone does not prove connection.
4. Ask for the current Next.js authentication/API protection guidance and a multi-user encrypted sharing scenario.
5. Ask how to bind a resource/category to protected decryption and how a governed grant changes access for an existing ciphertext.
6. Validate returned guidance against the actual SDK/server versions, especially bootstrap, QEA, role mapping, and session refresh.

Suggested prompts for the integration agent:

> Find the supported architecture for a participant to encrypt a record and share it with a different, explicitly authorised research account. Explain the key/resource scope and how existing ciphertext becomes accessible after a governed grant.

> Set up a Next.js application with verified API identity, three governance administrators, and a real pending-to-committed permission change. Keep application request tracking separate from Tide's authoritative status.

> Identify gaps in our research-vault design, including master-realm administration, browser compromise, data export, stale permissions, and any part still enforced only by application code.

The pack describes Raziel as a guidance server. Agent code performs implementation; the MCP is not the vault backend. The native Tide MCP is registered and available. A local `researchvault` realm was imported from the official full template, but licensing setup failed upstream during vendor key generation (Midgard returned HTTP 503); the realm is therefore not yet licensed or usable for live authentication and governance.

## Integration gates, in order

| Gate | Owner's experiment | Pass evidence | Consequence if it fails |
|---|---|---|---|
| G1 Environment | Start Tide realm, enrol accounts, perform actual sign-in | Real authenticated identities; versions recorded | Resolve setup before presenting live security behavior |
| G2 Shared decryption | Participant A encrypts; intended researcher B reads; assistant C is denied | Actual payload and account-specific results | Cross-user vault claim remains unproven |
| G3 Governed grant | Configure three admins; correlate exact grant; approve once then twice | Pending below quorum; authentic committed change | Do not replace with app-only approval booleans |
| G4 Grant affects crypto | Assistant refreshes and opens the existing intended payload | Real successful crypto result; identity payload still denied | Narrow scope or revise key/policy design before frontend integration |
| G5 Account isolation | Switch accounts/logout and direct-call protected APIs | No leaked caches, wrong-owner records, or permissive API paths | Fix isolation before capturing the demonstration |

Treat G2 and G4 as stop/go decisions for the sharing architecture. Test the intended grant against existing ciphertext; success with newly re-encrypted data alone is a different workflow and must be described as such.

## What is real and what can be simulated

**Must be real for the intended claim:** authentication, protected read result, governed change correlation, sourced approval status, and current permissions after grant. These remain unverified for this app; live protected routes fail closed.

**Implemented only in local simulation:** participant records, synthetic transcripts, study description, five persona selector entries, request/proposal/approval flow, and an application activity timeline. The local two-of-three quorum and AES-GCM payloads are functional demo behavior, not Tide evidence.

**Live integration still required:** real Tide sign-in, identity-to-persona mapping in a provisioned realm, signed policy configuration, cross-user decrypt of existing ciphertext, native governance change correlation, permission refresh, and admin policy-issuance threat review. The interface labels the current simulation and live mode does not silently fall back to it.

**Optional:** fresh submissions, second-study scope, request notifications, and a custom approval UI. Each is independently labelled until integrated.

## Operational boundaries

- Publish no credentials, tokens, real participant data, runtime databases, private keys, or environment secrets. An eventual `.env.example` must contain blank values.
- Do not change global agent settings as part of implementation without the owner's direction.
- No new cloud backend, Redis queue, blockchain, model training, or separate microservice is required for this MVP.
- Do not change this repository's visibility or deploy it merely because the challenge eventually requires public access. Publication is a separate owner action.
