# ResearchVault

## Project overview

ResearchVault is a proposed research participation vault where participants contribute sensitive data and research teams collaborate through scoped permissions and independently approved access changes.

### 1. Vision & originality

Combine a participant workspace with a research workspace: assistants receive access for their assigned work, while the head researcher coordinates permissions without being the sole approver of protected changes. The proposed distinction is research collaboration with visible, accountable authority.

### 2. Trust constraint insight

Participants and institutions hesitate to share sensitive information when one operator can broaden access alone. ResearchVault is designed to separate data access, study management, and governance authority.

### 3. Value & impact

A student wellbeing study could let assistants analyse approved coded interviews while keeping participant identifiers restricted. Participants can see their contributions and the stated sharing scope.

### 4. Why TideCloak matters

The design uses TideCloak for identity and governed permissions, with protected encryption/decryption through Tide. Three governance administrators provide the proposed two-approval configuration. Shared decryption between participant and researcher accounts remains an integration checkpoint, not a demonstrated capability of this repository.

### 5. Prototype & storytelling

This repository currently contains the implementation handoff, not a working application or video. The planned demonstration follows a denied assistant request, one insufficient approval, quorum approval, and access to the permitted content while identifiers remain restricted.

## Start here

Prepared 22 October 2026. **Documentation only; application behavior has not been tested.** Product details labelled proposed are implementation recommendations. The confirmed User UI audience is the participant.

| Document | Read it to understand |
|---|---|
| [Proposal](docs/01-PROPOSAL.md) | Product, use cases, hackathon fit, scope, and ownership |
| [System architecture](docs/02-SYSTEM-ARCHITECTURE.md) | Components, trust boundaries, storage, and workflows |
| [Feature map](docs/03-FEATURE-MAP.md) | Priorities, role permissions, and observable outcomes |
| [Stack and Tide integration](docs/04-TECHSTACK-AND-TIDE-INTEGRATION.md) | Technology choices, MCP usage, integration checkpoints |
| [Frontend handoff](docs/05-FRONTEND-HANDOFF.md) | Landing page, User UI, Researcher UI, secondary screens |
| [API and data contract](docs/06-API-AND-DATA-CONTRACT.md) | Proposed interface between frontend and backend |
| [Demo and video brief](docs/07-DEMO-FLOW-AND-VIDEO-BRIEF.md) | App operation, capture sequence, motion graphic cues |
| [Acceptance and sources](docs/08-ACCEPTANCE-AND-SOURCES.md) | Verification criteria, open decisions, source register |

### Responsibilities

- **Project owner (the requester):** backend, permission logic, Tide integration, demo application integration, and motion graphic video.
- **Frontend coworker(s):** Landing page, participant User UI, Researcher UI, secondary UI, interaction states, and frontend integration against the agreed contract.
- **Joint review:** API contract, evidence behind security claims, and final demo rehearsal.

### Reading order

Everyone: proposal → feature map → demo. Frontend: frontend handoff → API contract. Backend: architecture → Tide integration → API contract → acceptance criteria.

### Repository and submission status

The existing repository was private when inspected. Pushing this handoff does not change its visibility. The challenge requires a public repository containing working code and a two-minute MP4 under 100 MB, plus a README overview of at most 300 words. Submission is through the [official form](https://forms.gle/HRHYjnqB86j1LFS97). Current code, video, setup instructions, and verified implementation claims must be added before submission. See [official requirements](https://tide.org/unlocked/#submit).

The earlier local `mock.md` brief is preserved as historical input. This pack supersedes its four-account demo and omission of participant UI: the current proposal has **five personas**, including a participant. That pre-existing file is not part of the new documentation commit.

### Setup

There is no runnable application in this handoff. No install/start command, Tide realm, MCP connection, deployment, or runtime verification has been created by these documents. Follow the integration checkpoints before writing executable setup instructions.
