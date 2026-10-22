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
 * Synthetic seed data for the fixture adapter. Shapes follow ./contracts.
 * ------------------------------------------------------------------------- */

export const STUDY_ID = "study-wellbeing-01"
export const PROTOCOL_RECORD_ID = "record-protocol-001"
export const CODED_RECORD_ID = "record-coded-001"
export const IDENTITY_RECORD_ID = "record-identity-001"

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
    email: "participant-01@fixture.researchvault.test",
    displayName: "Participant 01",
    role: "PARTICIPANT",
    roleLabel: "Study participant",
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
    email: "assistant-01@fixture.researchvault.test",
    displayName: "Research Assistant 01",
    role: "RESEARCH_ASSISTANT",
    roleLabel: "Research assistant",
    isGovernanceAdmin: false,
    baselineGrants: [grant("INTERNAL")],
    home: "/researcher",
  },
  {
    id: "head-01",
    email: "head-01@fixture.researchvault.test",
    displayName: "Head Researcher 01",
    role: "HEAD_RESEARCHER",
    roleLabel: "Head researcher",
    isGovernanceAdmin: true,
    baselineGrants: [grant("INTERNAL"), grant("RESTRICTED")],
    home: "/governance",
  },
  {
    id: "steward-01",
    email: "steward-01@fixture.researchvault.test",
    displayName: "Data Steward 01",
    role: "DATA_STEWARD",
    roleLabel: "Data steward",
    isGovernanceAdmin: true,
    baselineGrants: [],
    home: "/governance",
  },
  {
    id: "ethics-01",
    email: "ethics-01@fixture.researchvault.test",
    displayName: "Ethics Representative 01",
    role: "ETHICS_REPRESENTATIVE",
    roleLabel: "Ethics representative",
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
  code: "SWIS-2025",
  title: "Student Wellbeing Interview Study",
  status: "ACTIVE",
  summary:
    "Semi-structured interviews on how first-year students experience stress, sleep and belonging in their first teaching term.",
  headResearcherId: "head-01",
  governanceAdminIds: ["head-01", "steward-01", "ethics-01"],
  quorum: { required: 2, total: 3 },
  categories: ["INTERNAL", "RESTRICTED", "HIGHLY_RESTRICTED"],
  ethicsReference: "HREC-2025-0142",
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
    title: "Study protocol",
    description:
      "Interview guide, consent language and coding frame for the study team.",
    category: "INTERNAL",
    ciphertextRef: "tide://fabric/study-wellbeing-01/internal/9f2c41ab",
  },
  {
    id: CODED_RECORD_ID,
    title: "Coded interview transcript",
    description:
      "Pseudonymised interview responses linked only to pseudonym P-01.",
    category: "RESTRICTED",
    ownerParticipantId: "participant-01",
    ciphertextRef: "tide://fabric/study-wellbeing-01/restricted/c71e0d93",
  },
  {
    id: IDENTITY_RECORD_ID,
    title: "Identity mapping",
    description:
      "Links pseudonym P-01 to a real-world identity. Compartmentalized, owner-only.",
    category: "HIGHLY_RESTRICTED",
    ownerParticipantId: "participant-01",
    ciphertextRef: "tide://fabric/study-wellbeing-01/highly-restricted/58aae7f2",
  },
]

/*
 * Synthetic plaintext. Lives only inside the adapter boundary and is returned
 * exclusively through an authorized decrypt call.
 */
export const SEALED: Record<string, RecordContent> = {
  [PROTOCOL_RECORD_ID]: {
    kind: "PROTOCOL",
    sections: [
      {
        heading: "Purpose",
        body: "Explore how first-year students describe stress, sleep and belonging during the first teaching term.",
      },
      {
        heading: "Interview guide",
        body: "Six open questions, 40 minutes. Interviewers avoid collecting names, course codes or residence details in the transcript.",
      },
      {
        heading: "Coding frame",
        body: "Themes: workload, sleep, social connection, help-seeking. Assistants code transcripts by pseudonym only.",
      },
    ],
  },
  [CODED_RECORD_ID]: {
    kind: "TRANSCRIPT",
    pseudonym: "P-01",
    turns: [
      {
        speaker: "INTERVIEWER",
        text: "How would you describe your sleep over the last month?",
      },
      {
        speaker: "P-01",
        text: "Patchy. Around deadlines I drop to four or five hours, then try to catch up at the weekend.",
        codes: ["SLEEP", "WORKLOAD"],
      },
      {
        speaker: "INTERVIEWER",
        text: "When things get heavy, who do you talk to first?",
      },
      {
        speaker: "P-01",
        text: "Mostly my flatmates. I only found the wellbeing service after a tutor mentioned it in week six.",
        codes: ["SOCIAL CONNECTION", "HELP-SEEKING"],
      },
    ],
  },
  [IDENTITY_RECORD_ID]: {
    kind: "IDENTITY",
    pseudonym: "P-01",
    fields: [
      { label: "Legal name", value: "Jordan Ellis (synthetic)" },
      { label: "Email", value: "j.ellis@example.edu" },
      { label: "Enrolled", value: "2025-02-27T08:05:00.000Z" },
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
    summary: `${PROTOCOL_RECORD_ID} published to ${STUDY_ID} (INTERNAL)`,
    source: "APPLICATION",
    correlationId: "cor-seed-0002",
    result: "SUCCESS",
  },
  {
    id: "evt-seed-0003",
    timestamp: "2025-03-11T14:40:00.000Z",
    actorId: "head-01",
    summary: `${CODED_RECORD_ID} sealed under RESTRICTED`,
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
