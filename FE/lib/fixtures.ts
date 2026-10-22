import type {
  ActivityEvent,
  ClearanceLevel,
  CurrentUser,
  DataCategory,
  Grant,
  ParticipantEnrollment,
  PersonaId,
  RecordContent,
  RecordSummary,
  Study,
  StudyMembership,
} from "./contracts"

/* ---------------------------------------------------------------------------
 * Synthetic seed data aligned with the ResearchVault SQLite backend
 * (src/lib/domain.ts & src/lib/seed.server.ts). Shapes follow ./contracts.
 * ------------------------------------------------------------------------- */

export const STUDY_ID = "study-wellbeing-01"
export const PROTOCOL_RECORD_ID = "record-protocol-001"
export const CODEBOOK_RECORD_ID = "record-protocol-002"
export const CODED_RECORD_ID = "record-coded-001"
export const CODED_RECORD_002_ID = "record-coded-002"
export const CODED_RECORD_003_ID = "record-coded-003"
export const IDENTITY_RECORD_ID = "record-identity-001"
export const IDENTITY_RECORD_002_ID = "record-identity-002"

/** L1 metadata, L2 internal, L3 restricted, L4 highly restricted. */
export const CATEGORY_LEVEL: Record<DataCategory, ClearanceLevel> = {
  INTERNAL: 2,
  RESTRICTED: 3,
  HIGHLY_RESTRICTED: 4,
}

export interface Persona
  extends Pick<
    CurrentUser,
    "displayName" | "role" | "roleLabel" | "isGovernanceAdmin" | "email"
  > {
  id: PersonaId
  /** Grants issued at sign-in before any governed change. */
  baselineGrants: Grant[]
  /** Landing route for this persona (mirrors the role default in app/policy). */
  home: string
}

const grant = (
  category: DataCategory,
  scope: Grant["scope"] = "STUDY",
): Grant => ({ category, scope, studyId: STUDY_ID, source: "BASELINE" })

export const PERSONAS: Persona[] = [
  {
    id: "participant-01",
    email: "maya.chen@fixture.researchvault.test",
    displayName: "Maya Chen (participant-01)",
    role: "PARTICIPANT",
    roleLabel: "Study participant · Maya Chen",
    isGovernanceAdmin: false,
    baselineGrants: [
      grant("INTERNAL"),
      grant("RESTRICTED", "OWN_RECORDS"),
      grant("HIGHLY_RESTRICTED", "OWN_RECORDS"),
    ],
    home: "/user",
  },
  {
    id: "assistant-01",
    email: "riley.park@fixture.researchvault.test",
    displayName: "Riley Park (assistant-01)",
    role: "RESEARCH_ASSISTANT",
    roleLabel: "Research assistant · Riley Park",
    isGovernanceAdmin: false,
    baselineGrants: [grant("INTERNAL")],
    home: "/researcher",
  },
  {
    id: "head-01",
    email: "sam.taylor@fixture.researchvault.test",
    displayName: "Dr. Sam Taylor (head-01)",
    role: "HEAD_RESEARCHER",
    roleLabel: "Head researcher · Dr. Sam Taylor",
    isGovernanceAdmin: true,
    baselineGrants: [grant("INTERNAL"), grant("RESTRICTED")],
    home: "/governance",
  },
  {
    id: "steward-01",
    email: "jordan.lee@fixture.researchvault.test",
    displayName: "Jordan Lee (steward-01)",
    role: "DATA_STEWARD",
    roleLabel: "Data steward · Jordan Lee",
    isGovernanceAdmin: true,
    baselineGrants: [],
    home: "/governance",
  },
  {
    id: "ethics-01",
    email: "alex.morgan@fixture.researchvault.test",
    displayName: "Alex Morgan (ethics-01)",
    role: "ETHICS_REPRESENTATIVE",
    roleLabel: "Ethics representative · Alex Morgan",
    isGovernanceAdmin: true,
    baselineGrants: [],
    home: "/governance",
  },
]

export function isPersonaId(id: string): id is PersonaId {
  return PERSONAS.some((p) => p.id === id)
}

export function personaById(id: PersonaId): Persona {
  const persona = PERSONAS.find((p) => p.id === id)
  if (!persona) throw new Error(`Unknown persona ${id}`)
  return persona
}

export const STUDY: Study = {
  id: STUDY_ID,
  code: "RMIT-WELLBEING-2026",
  title: "Student Wellbeing Interview Study",
  status: "ACTIVE",
  summary:
    "A fictional study exploring how students find support during demanding study periods, with compartmentalised protocol, coded transcript, and participant identity tiers.",
  headResearcherId: "head-01",
  governanceAdminIds: ["head-01", "steward-01", "ethics-01"],
  quorum: { required: 2, total: 3 },
  categories: ["INTERNAL", "RESTRICTED", "HIGHLY_RESTRICTED"],
  ethicsReference: "SYNTH-HREC-2026-014",
  enrolledAt: "2025-02-27T08:05:00.000Z",
  createdAt: "2025-02-20T09:00:00.000Z",
  createdBy: "head-01",
}

/** Research-staff seats on the fixture study. All active; never persisted. */
export const SEED_MEMBERSHIPS: StudyMembership[] = (
  [
    ["head-01", "HEAD_RESEARCHER", "2025-02-20T09:00:00.000Z"],
    ["assistant-01", "RESEARCH_ASSISTANT", "2025-02-24T10:15:00.000Z"],
    ["steward-01", "DATA_STEWARD", "2025-02-21T13:30:00.000Z"],
    ["ethics-01", "ETHICS_REPRESENTATIVE", "2025-02-21T14:05:00.000Z"],
  ] as const
).map(([identityId, studyRole, joinedAt]): StudyMembership => ({
  id: `mem-seed-${identityId}`,
  studyId: STUDY_ID,
  identityId,
  studyRole,
  status: "ACTIVE",
  via: "SEED",
  requestedAt: joinedAt,
  joinedAt,
}))

export const SEED_ENROLLMENTS: ParticipantEnrollment[] = [
  {
    id: "enr-seed-participant-01",
    studyId: STUDY_ID,
    participantId: "participant-01",
    enrolledAt: STUDY.enrolledAt,
    via: "SEED",
  },
]

export type RecordSeed = Pick<
  RecordSummary,
  "id" | "title" | "description" | "category" | "ownerParticipantId"
> & { ciphertextRef: string }

export const RECORDS: RecordSeed[] = [
  {
    id: PROTOCOL_RECORD_ID,
    title: "Interview guide · v1",
    description:
      "Semi-structured interview protocol, consent script, and wellbeing support resource handoff.",
    category: "INTERNAL",
    ownerParticipantId: "participant-01",
    ciphertextRef: "tide://fabric/study-wellbeing-01/internal/9f2c41ab",
  },
  {
    id: CODEBOOK_RECORD_ID,
    title: "Thematic codebook · v2.1",
    description:
      "Coding frame for PEER_SUPPORT, WORKLOAD_SPIKE, and HELP_SEEKING themes used by study researchers.",
    category: "INTERNAL",
    ciphertextRef: "tide://fabric/study-wellbeing-01/internal/4b8d19e0",
  },
  {
    id: CODED_RECORD_ID,
    title: "Coded interview response · P-014",
    description:
      "Pseudonymised interview responses from Maya Chen (P-014 · Year 2 CS · 42m).",
    category: "RESTRICTED",
    ownerParticipantId: "participant-01",
    ciphertextRef: "tide://fabric/study-wellbeing-01/restricted/c71e0d93",
  },
  {
    id: CODED_RECORD_002_ID,
    title: "Coded interview response · P-019",
    description:
      "Pseudonymised cohort interview transcript for P-019 (Year 3 Design · 38m).",
    category: "RESTRICTED",
    ownerParticipantId: "participant-02",
    ciphertextRef: "tide://fabric/study-wellbeing-01/restricted/a35f82c1",
  },
  {
    id: CODED_RECORD_003_ID,
    title: "Coded interview response · P-023",
    description:
      "Pseudonymised cohort interview transcript for P-023 (Postgraduate IT · 45m).",
    category: "RESTRICTED",
    ownerParticipantId: "participant-03",
    ciphertextRef: "tide://fabric/study-wellbeing-01/restricted/d90b47f6",
  },
  {
    id: IDENTITY_RECORD_ID,
    title: "Participant identity mapping · P-014",
    description:
      "Links pseudonym P-014 to Maya Chen. Compartmentalized, owner-only.",
    category: "HIGHLY_RESTRICTED",
    ownerParticipantId: "participant-01",
    ciphertextRef: "tide://fabric/study-wellbeing-01/highly-restricted/58aae7f2",
  },
  {
    id: IDENTITY_RECORD_002_ID,
    title: "Cohort identity linkage · P-019 & P-023",
    description:
      "Custodian-only re-identification ledger for P-019 and P-023. Never granted to research assistants.",
    category: "HIGHLY_RESTRICTED",
    ownerParticipantId: "participant-02",
    ciphertextRef: "tide://fabric/study-wellbeing-01/highly-restricted/71ef03c9",
  },
]

/*
 * Synthetic plaintext fallback & structured formatting. When connected to the
 * Next.js SQLite backend, decryptRecord() verifies and decrypts ciphertext via
 * GET /api/records/:recordId before returning these structured envelopes.
 */
export const SEALED: Record<string, RecordContent> = {
  [PROTOCOL_RECORD_ID]: {
    kind: "PROTOCOL",
    sections: [
      {
        heading: "Purpose",
        body: "Explore how students find support during demanding study periods across transition, peer networks, and formal services.",
      },
      {
        heading: "Interview guide · v1",
        body: "Use open questions, let participants skip any topic, and close by sharing support resources. Focus areas: (1) Transition to university workload, (2) Informal peer study networks, (3) Barriers to seeking formal academic or wellbeing support.",
      },
      {
        heading: "De-identification rule",
        body: "Interviewers avoid collecting names, course codes or residence details in the coded transcript.",
      },
    ],
  },
  [CODEBOOK_RECORD_ID]: {
    kind: "PROTOCOL",
    sections: [
      {
        heading: "Theme A · PEER_SUPPORT",
        body: "Peer study groups, studio check-ins, and informal accountability networks.",
      },
      {
        heading: "Theme B · WORKLOAD_SPIKE",
        body: "Week 8–11 assessment clustering, sleep disruption, and overlapping project milestones.",
      },
      {
        heading: "Theme C · HELP_SEEKING",
        body: "Hesitation to contact formal academic or wellbeing services before assessment deadlines.",
      },
    ],
  },
  [CODED_RECORD_ID]: {
    kind: "TRANSCRIPT",
    pseudonym: "P-014",
    turns: [
      {
        speaker: "INTERVIEWER",
        text: "How did your peer networks or study sessions affect how you handled heavy coursework weeks?",
      },
      {
        speaker: "P-014",
        text: "Synthetic response: Weekly peer study sessions made it much easier to ask for help early instead of waiting until deadlines piled up.",
        codes: ["PEER_SUPPORT", "HELP_SEEKING"],
      },
      {
        speaker: "INTERVIEWER",
        text: "When things got heavy, who did you talk to first?",
      },
      {
        speaker: "P-014",
        text: "Mostly my study group peers (Cohort: Year 2 CS · Duration: 42m). I only reached out to formal wellbeing support after a tutor mentioned it.",
        codes: ["PEER_SUPPORT", "HELP_SEEKING"],
      },
    ],
  },
  [CODED_RECORD_002_ID]: {
    kind: "TRANSCRIPT",
    pseudonym: "P-019",
    turns: [
      {
        speaker: "INTERVIEWER",
        text: "How did assessment clustering in the second half of semester affect your routine?",
      },
      {
        speaker: "P-019",
        text: "Synthetic response: Participant P-019 reported that overlapping week-9 project milestones disrupted sleep routines, but studio peer check-ins reduced feelings of isolation. (Cohort: Year 3 Design · Duration: 38m)",
        codes: ["WORKLOAD_SPIKE", "PEER_SUPPORT"],
      },
    ],
  },
  [CODED_RECORD_003_ID]: {
    kind: "TRANSCRIPT",
    pseudonym: "P-023",
    turns: [
      {
        speaker: "INTERVIEWER",
        text: "What stood out when deciding whether to request an academic extension or wellbeing check-in?",
      },
      {
        speaker: "P-023",
        text: "Synthetic response: Participant P-023 noted uncertainty about whether academic extension requests were shared with course coordinators, delaying formal wellbeing outreach. (Cohort: Postgraduate IT · Duration: 45m)",
        codes: ["HELP_SEEKING"],
      },
    ],
  },
  [IDENTITY_RECORD_ID]: {
    kind: "IDENTITY",
    pseudonym: "P-014",
    fields: [
      { label: "Legal name", value: "Maya Chen (synthetic · P-014)" },
      { label: "Email", value: "maya.chen@example.edu" },
      {
        label: "Consent & tier",
        value:
          "Active · Coded responses permitted for study-wellbeing-01 · Direct identifiers restricted to custodian/owner tier",
      },
      { label: "Enrolled", value: "2025-02-27T08:05:00.000Z" },
    ],
  },
  [IDENTITY_RECORD_002_ID]: {
    kind: "IDENTITY",
    pseudonym: "P-019 & P-023",
    fields: [
      { label: "P-019 identity", value: "Liam Nguyen (synthetic)" },
      { label: "P-023 identity", value: "Priya Nair (synthetic)" },
      {
        label: "Custodian policy",
        value:
          "Custodian-only re-identification ledger · Never exposed to general research assistants",
      },
    ],
  },
}

/** Historical events, oldest first. */
export const SEED_ACTIVITY: ActivityEvent[] = [
  {
    id: "evt-seed-0001",
    timestamp: "2025-02-27T08:05:00.000Z",
    actorId: "participant-01",
    summary: `${IDENTITY_RECORD_ID} sealed under HIGHLY_RESTRICTED (owner-only)`,
    source: "APPLICATION",
    correlationId: "cor-seed-0001",
    result: "SUCCESS",
  },
  {
    id: "evt-seed-0002",
    timestamp: "2025-03-04T09:12:00.000Z",
    actorId: "head-01",
    summary: `${PROTOCOL_RECORD_ID} & ${CODEBOOK_RECORD_ID} published to ${STUDY_ID} (INTERNAL)`,
    source: "APPLICATION",
    correlationId: "cor-seed-0002",
    result: "SUCCESS",
  },
  {
    id: "evt-seed-0003",
    timestamp: "2025-03-11T14:40:00.000Z",
    actorId: "head-01",
    summary: `${CODED_RECORD_ID}, ${CODED_RECORD_002_ID}, ${CODED_RECORD_003_ID} sealed under RESTRICTED`,
    source: "APPLICATION",
    correlationId: "cor-seed-0003",
    result: "SUCCESS",
  },
  {
    id: "evt-seed-0004",
    timestamp: "2025-03-11T14:41:12.000Z",
    actorId: "system",
    summary: `Governance policy for ${STUDY_ID} verified: 2 of 3 quorum`,
    source: "TIDE_QEA",
    correlationId: "cor-seed-0004",
    result: "SUCCESS",
  },
]
