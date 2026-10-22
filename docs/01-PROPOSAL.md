# ResearchVault — proposal

Status: proposed product and implementation brief, 22 October 2026. User-confirmed decisions are separated below from recommendations. Start at the [document index](../README.md).

## Product in one sentence

A research participation vault where people contribute sensitive information and research teams access only the material their work requires, with independent approval for protected permission changes.

## Problem and opportunity

A research team may include a head researcher, temporary assistants, external collaborators, and data custodians. Giving everyone broad access is convenient but exposes participant information. Making one head researcher the unrestricted gatekeeper concentrates the power to change access in a single account.

The opportunity is practical collaboration: assistants can work with approved coded responses while identifiers remain compartmentalised. Participants have a separate place to understand the study and view their own contributions. The team can explain who proposed and approved broader access.

The concept is inspired by research consent vaults; originality should come from a convincing research workflow, not a claim that encrypted research storage is entirely new.

## Confirmed direction

- Research participation/research-team vault with different permission levels.
- Head researcher manages the study and sets up permissions and security measures.
- Frontend includes **Landing page**, **User UI**, **Researcher UI**, and secondary demo screens.
- **User UI means participant**, as confirmed by the project owner.
- The project owner handles backend, logic, demo application, and motion graphic video.
- Coworker handoff is documentation in this repository; no application is implemented here.

## Recommended interpretation

Use military-style clearance as an analogy for sensitivity and need to know, without claiming military certification. Separate:

1. **Role:** participant, assistant, head researcher, data steward, ethics representative.
2. **Study scope:** the specific study to which an operation belongs.
3. **Data category:** INTERNAL, RESTRICTED, HIGHLY_RESTRICTED.
4. **Action:** view metadata, read/decrypt, propose grant, approve change.

The head researcher drafts or proposes protected changes. For the demo, their approval alone is insufficient. Governance administrators do not automatically receive every data-reading permission.

Participant consent and institutional access governance are separate concepts. Governance approval must not silently override a participant's stated sharing scope. A complete, cryptographically enforced consent lifecycle is not assumed in this MVP.

## Example study and personas

Use the fictional **Student Wellbeing Interview Study**, identifier `study-wellbeing-01`. All names, transcripts, and records are synthetic; no real health information is required.

| Persona | Work to be done | What they must not automatically gain |
|---|---|---|
| Participant | Read study information, view own contribution, understand sharing scope | Other participants' records or governance controls |
| Research assistant | Work on assigned study material and request additional access | All identifiable records or administrative powers |
| Head researcher | Coordinate work and propose permission changes | Sole approval authority or unrestricted decryption |
| Data steward | Handle explicitly authorised sensitive material and review changes | Unchecked power to broaden everyone's permissions |
| Ethics representative | Independently review governed changes | Blanket access to research content |

Five personas do not require five team members. One operator can use separate authenticated browser profiles/windows. Do not simulate real identity changes with a role dropdown in the integrated demo.

## Core use cases

**UC-01 Participant contribution visibility:** participant opens the User UI and sees their own synthetic contribution and sharing explanation. A seeded record is sufficient for the minimum demo; a real encrypted submission form follows if the sharing integration passes.

**UC-02 Research access boundary:** assistant reads an internal protocol but cannot decrypt restricted interview content. The UI explains that additional approval is required without revealing the protected content.

**UC-03 Governed access expansion:** assistant requests access. Head researcher proposes the mapped role grant in Tide. One approval leaves it pending; the configured quorum permits commitment. The assistant refreshes authorisation and retries.

**UC-04 Continued compartmentalisation:** the newly permitted restricted content opens, while participant identifiers remain inaccessible to that assistant.

**UC-05 Evidence review:** an authorised reviewer inspects actual change identifiers and approval evidence. The app does not fabricate a universal audit trail for operations it cannot observe.

## MVP boundary

P0 is one study, five demo personas, a small synthetic dataset, three data categories, real Tide identity, one governed grant, and one verified shared-decryption path. Landing and participant views are deliberately compact. The main research interaction remains the strongest security proof.

P1 includes fresh participant submissions, expanded participant sharing history, a second study to demonstrate cross-study denial, and denial/revocation workflows after backend semantics are verified.

Later work includes full consent enforcement, expiring grants, export governance, AI analysis, large-scale study management, and real institutional deployment. They must not appear as working features in the submission unless built and checked.

## Why it fits a hackathon

| Judging theme | Proposed evidence |
|---|---|
| Vision and originality | Participant and research workspaces connected by accountable access governance |
| Trust constraint | Show the authority concentrated in a single unrestricted research administrator |
| Value and impact | Let assistants contribute without broad disclosure of participant information |
| Tide's contribution | Actual governed role change and protected data operation |
| Prototype and storytelling | One request moves from denied to quorum-approved to usable |

The [challenge](https://tide.org/unlocked/) asks for a small working integration and a clear newly enabled possibility. The product should lead the story; the permission interface supports it.

## Delivery split

| Responsibility | Owner | Handoff needed |
|---|---|---|
| Backend, data model, application logic | Project owner | Agree contract and error semantics with frontend |
| Tide integration, encryption sharing, governance | Project owner | Supply authentic session, permission, and approval states |
| Landing, User UI, Researcher UI, secondary UI | Frontend coworker(s) | Implement the screen/state specification; no local permission overrides |
| Demo application integration and fixtures | Project owner | Supply repeatable rehearsal state and accounts |
| Motion graphic video | Project owner | Receive clean screen captures, factual captions, and evidence from team |
| Acceptance review and rehearsal | Joint | Confirm the story matches observed behavior |

These responsibilities do not assign work to named people who have not agreed to it.

## Success and failure boundaries

Success means a coworker can build the specified screens without inventing permission behavior, and the final application can demonstrate the actual access boundary. If shared decryption cannot be established, do not claim a working multi-user research vault: narrow the demo to the functioning Tide governance path, clearly label the remaining sharing interaction as simulated, and recognise the reduced product proof.

The proposal does not promise regulatory compliance, irreversible deletion, anonymous data, protection against authorised screenshots, or security against every privileged deployment path. See [acceptance and sources](08-ACCEPTANCE-AND-SOURCES.md).
