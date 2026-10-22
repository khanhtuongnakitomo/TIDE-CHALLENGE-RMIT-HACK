export const PERSONAS = [
  "participant-01",
  "assistant-01",
  "head-01",
  "steward-01",
  "ethics-01",
] as const;

export type PersonaId = (typeof PERSONAS)[number];
export type Category = "INTERNAL" | "RESTRICTED" | "HIGHLY_RESTRICTED";
export type RequestState =
  | "REQUESTED"
  | "PENDING_GOVERNANCE"
  | "COMMITTED"
  | "ACTIVE";

export interface Persona {
  id: PersonaId;
  label: string;
  audiences: string[];
  capabilities: string[];
  summary?: string;
}

export interface Study {
  id: string;
  title: string;
  description: string;
  code?: string;
  ethicsRef?: string;
}

export interface RecordSummary {
  id: string;
  studyId: string;
  category: Category;
  safeLabel: string;
  access: {
    canRequest: boolean;
    mayAttemptDecrypt: boolean;
    reasonCode: string | null;
  };
  simulatedGrantState?: string | null;
}

export interface AccessRequest {
  id: string;
  requesterId: string;
  scope: {
    kind: "STUDY_CATEGORY";
    studyId: string;
    dataCategory: Category;
    action: "READ";
    contextRecordId: string;
  };
  reason: string;
  state: RequestState;
  governanceChangeId: string | null;
  approvals: number;
  requiredApprovals: number;
  source?: string;
}

export const personas: Persona[] = [
  {
    id: "participant-01",
    label: "Maya Chen · Participant",
    audiences: ["PARTICIPANT"],
    capabilities: ["record:read:own"],
    summary: "Reads own interview contribution & sharing scope only.",
  },
  {
    id: "assistant-01",
    label: "Riley Park · Research assistant",
    audiences: ["RESEARCHER"],
    capabilities: ["study:read", "request:create"],
    summary: "Starts with INTERNAL access; requests RESTRICTED study access.",
  },
  {
    id: "head-01",
    label: "Dr. Sam Taylor · Head researcher",
    audiences: ["RESEARCHER", "GOVERNANCE"],
    capabilities: ["study:read", "governance:propose", "governance:approve"],
    summary: "Proposes scoped changes and supplies 1 of 2 required approvals.",
  },
  {
    id: "steward-01",
    label: "Jordan Lee · Data steward",
    audiences: ["GOVERNANCE"],
    capabilities: ["governance:approve"],
    summary: "Independent governance approver; no automatic data read rights.",
  },
  {
    id: "ethics-01",
    label: "Alex Morgan · Ethics representative",
    audiences: ["GOVERNANCE"],
    capabilities: ["governance:approve"],
    summary: "Independent ethics reviewer; supplies a distinct quorum approval.",
  },
];

export const study: Study = {
  id: "study-wellbeing-01",
  code: "RMIT-WELLBEING-2026",
  ethicsRef: "SYNTH-HREC-2026-014",
  title: "Student Wellbeing Interview Study",
  description:
    "A fictional study exploring how students find support during demanding study periods.",
};

export const presetRequestReasons: readonly string[] = [
  "I need to code the interview themes assigned to me.",
  "Cross-checking peer-support and workload-spike themes across coded responses P-014, P-019, and P-023.",
  "Preparing de-identified thematic tables for the interim wellbeing study review.",
];

export interface WorkflowStepGuide {
  step: number;
  title: string;
  personaId: PersonaId;
  personaLabel: string;
  instruction: string;
  expectedOutcome: string;
}

export const userTestWorkflowSteps: readonly WorkflowStepGuide[] = [
  {
    step: 1,
    title: "Participant inspects own contribution",
    personaId: "participant-01",
    personaLabel: "Maya Chen (Participant)",
    instruction:
      "Sign in as Maya Chen and open her coded interview response (P-014) and identity mapping.",
    expectedOutcome:
      "Participant reads her own contribution; other participants' records (P-019, P-023) are hidden.",
  },
  {
    step: 2,
    title: "Assistant hits boundary & requests access",
    personaId: "assistant-01",
    personaLabel: "Riley Park (Assistant)",
    instruction:
      "Switch to Riley Park, open an INTERNAL guide, try reading a RESTRICTED response (denied), then click Request access.",
    expectedOutcome:
      "INTERNAL opens; RESTRICTED returns 403 MISSING_SCOPE; access request is created in REQUESTED state.",
  },
  {
    step: 3,
    title: "Head researcher proposes & approves (1/2)",
    personaId: "head-01",
    personaLabel: "Dr. Sam Taylor (Head)",
    instruction:
      "Switch to Dr. Sam Taylor, open Governance review, click Propose simulated change, then Approve (1 of 2).",
    expectedOutcome:
      "Request moves to PENDING_GOVERNANCE with 1/2 approvals; single admin cannot unilaterally commit.",
  },
  {
    step: 4,
    title: "Second governance persona completes 2-of-3 quorum",
    personaId: "steward-01",
    personaLabel: "Jordan Lee (Steward) or Alex Morgan (Ethics)",
    instruction:
      "Switch to Jordan Lee (or Alex Morgan) and click Approve to supply the second independent signature.",
    expectedOutcome:
      "Quorum (2/2) is met; request state transitions to COMMITTED.",
  },
  {
    step: 5,
    title: "Assistant refreshes & reads RESTRICTED records",
    personaId: "assistant-01",
    personaLabel: "Riley Park (Assistant)",
    instruction:
      "Return to Riley Park and open the RESTRICTED coded responses (P-014, P-019, P-023).",
    expectedOutcome:
      "All study-scoped RESTRICTED responses decrypt; request transitions from COMMITTED to ACTIVE.",
  },
  {
    step: 6,
    title: "Verify HIGHLY_RESTRICTED identity stays locked",
    personaId: "assistant-01",
    personaLabel: "Riley Park (Assistant)",
    instruction:
      "As Riley Park, click Try read on Participant identity mapping (HIGHLY_RESTRICTED).",
    expectedOutcome:
      "Access is still denied (403 MISSING_SCOPE), proving category compartmentalisation.",
  },
];

export function hasCapability(persona: Persona, capability: string): boolean {
  return persona.capabilities.includes(capability);
}
