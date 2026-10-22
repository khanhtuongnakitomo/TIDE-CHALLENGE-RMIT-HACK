import type { Category } from "./domain.ts";

export interface SeedRecord {
  id: string;
  ownerId: string;
  category: Category;
  safeLabel: string;
  plaintext: string;
}

export const seedRecords: readonly SeedRecord[] = [
  {
    id: "record-protocol-001",
    ownerId: "participant-01",
    category: "INTERNAL",
    safeLabel: "Interview guide · v1",
    plaintext:
      "Use open questions, let participants skip any topic, and close by sharing support resources. Focus areas: (1) Transition to university workload, (2) Informal peer study networks, (3) Barriers to seeking formal academic or wellbeing support.",
  },
  {
    id: "record-protocol-002",
    ownerId: "study-team",
    category: "INTERNAL",
    safeLabel: "Thematic codebook · v2.1",
    plaintext:
      "Synthetic codebook: Theme A [PEER_SUPPORT] — peer study groups and studio check-ins; Theme B [WORKLOAD_SPIKE] — week 8-11 assessment clustering; Theme C [HELP_SEEKING] — hesitation to contact formal services before deadlines.",
  },
  {
    id: "record-coded-001",
    ownerId: "participant-01",
    category: "RESTRICTED",
    safeLabel: "Coded interview response · P-014",
    plaintext:
      "Synthetic response: A participant said weekly peer study sessions made it easier to ask for help. [Themes: PEER_SUPPORT, HELP_SEEKING | Cohort: Year 2 CS | Duration: 42m]",
  },
  {
    id: "record-coded-002",
    ownerId: "participant-02",
    category: "RESTRICTED",
    safeLabel: "Coded interview response · P-019",
    plaintext:
      "Synthetic response: Participant P-019 reported that overlapping week-9 project milestones disrupted sleep routines, but studio peer check-ins reduced feelings of isolation. [Themes: WORKLOAD_SPIKE, PEER_SUPPORT | Cohort: Year 3 Design | Duration: 38m]",
  },
  {
    id: "record-coded-003",
    ownerId: "participant-03",
    category: "RESTRICTED",
    safeLabel: "Coded interview response · P-023",
    plaintext:
      "Synthetic response: Participant P-023 noted uncertainty about whether academic extension requests were shared with course coordinators, delaying formal wellbeing outreach. [Themes: HELP_SEEKING | Cohort: Postgraduate IT | Duration: 45m]",
  },
  {
    id: "record-identity-001",
    ownerId: "participant-01",
    category: "HIGHLY_RESTRICTED",
    safeLabel: "Participant identity mapping",
    plaintext:
      "Synthetic identity mapping: P-014 is Maya Chen. [Consent status: Active · Coded responses permitted for study-wellbeing-01 · Direct identifiers restricted to custodian tier]",
  },
  {
    id: "record-identity-002",
    ownerId: "participant-02",
    category: "HIGHLY_RESTRICTED",
    safeLabel: "Cohort identity linkage · P-019 & P-023",
    plaintext:
      "Synthetic identity mapping: P-019 is Liam Nguyen; P-023 is Priya Nair. [Custodian-only re-identification ledger · Never exposed to general research assistants]",
  },
];

export const RESTRICTED_RECORD_IDS = seedRecords
  .filter((record) => record.category === "RESTRICTED")
  .map((record) => record.id);
