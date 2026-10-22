/** Browser-only adapter around Tide's official RelationshipAttestation example.
 *
 * This deliberately does not acquire admin policy, write ciphertext, or perform
 * governance. The app may call these functions only after a real realm supplies
 * its public vendor id and an authorized admin policy in the browser enclave.
 */
import {
  buildRelationshipPolicy,
  decryptForRecord,
  encryptForRecord,
  signRelationshipPolicy,
  type RelationshipGrant,
  type RelationshipSubject,
} from "./relationship";

export type VaultCategory = "INTERNAL" | "RESTRICTED" | "HIGHLY_RESTRICTED";
export type VaultOperation = "encrypt" | "decrypt" | "sign-policy";

export interface LiveVaultReadiness {
  configured: boolean;
  authenticated: boolean;
  vendorIdPresent: boolean;
  adminPolicyPresent: boolean;
  blockedReasons: string[];
  status: "BLOCKED" | "READY_FOR_POLICY_TEST";
}

export interface SignedVaultPolicy {
  recordId: string;
  category: VaultCategory;
  subject: RelationshipSubject;
  access: "read" | "write" | "read-write";
  signedPolicyB64: string;
  provenance: "TIDE_RELATIONSHIP_ATTESTATION";
  runtimeVerified: false;
}

/** One encrypted vault per study/category, with the record id as its only tag. */
export function vaultRecordId(studyId: string, category: VaultCategory): string {
  if (!/^study-[a-z0-9-]{1,80}$/.test(studyId)) throw new Error("Invalid study id");
  return `${studyId}:${category}`;
}

export function liveVaultReadiness(input: {
  liveMode: boolean;
  authenticated: boolean;
  vendorId?: string;
  adminPolicy?: Uint8Array;
}): LiveVaultReadiness {
  const blockedReasons: string[] = [];
  if (!input.liveMode) blockedReasons.push("Live mode is not selected.");
  if (!input.authenticated) blockedReasons.push("Sign in to a real Tide realm first.");
  if (!input.vendorId) blockedReasons.push("A realm-exported vendorId is not configured.");
  if (!input.adminPolicy?.byteLength) blockedReasons.push("An authorized admin must provide the realm's policy-signing context.");
  return {
    configured: input.liveMode && !!input.vendorId,
    authenticated: input.authenticated,
    vendorIdPresent: !!input.vendorId,
    adminPolicyPresent: !!input.adminPolicy?.byteLength,
    blockedReasons,
    status: blockedReasons.length ? "BLOCKED" : "READY_FOR_POLICY_TEST",
  };
}

/** Ask the realm admin's browser enclave to sign a scoped policy. This is not
 * the app's two-of-three membership change quorum and does not itself grant an
 * application entitlement. Keep this disabled until actual realm verification.
 */
export async function signVaultPolicy(input: {
  vendorId: string;
  adminPolicy: Uint8Array;
  studyId: string;
  category: VaultCategory;
  subject: RelationshipSubject;
  access: "read" | "write" | "read-write";
  expiry?: number;
}): Promise<SignedVaultPolicy> {
  if (!input.vendorId || !input.adminPolicy.byteLength) throw new Error("Tide policy signing is blocked until a real realm admin policy is available.");
  const recordId = vaultRecordId(input.studyId, input.category);
  const grant: RelationshipGrant = {
    vendorId: input.vendorId,
    subject: input.subject,
    recordId,
    access: input.access,
    ...(input.expiry ? { expiry: input.expiry } : {}),
  };
  buildRelationshipPolicy(grant); // Validate exact contract input before enclave call.
  const signedPolicyB64 = await signRelationshipPolicy(grant, input.adminPolicy);
  return { recordId, category: input.category, subject: input.subject, access: input.access, signedPolicyB64, provenance: "TIDE_RELATIONSHIP_ATTESTATION", runtimeVerified: false };
}

export async function encryptVaultPayload(input: { plaintext: string; policy: SignedVaultPolicy }): Promise<string> {
  if (!input.plaintext) throw new Error("Payload is empty.");
  return encryptForRecord(input.plaintext, input.policy.recordId, input.policy.signedPolicyB64);
}

export async function decryptVaultPayload(input: { ciphertext: string; policy: SignedVaultPolicy }): Promise<string> {
  if (!input.ciphertext) throw new Error("Ciphertext is empty.");
  return decryptForRecord(input.ciphertext, input.policy.recordId, input.policy.signedPolicyB64);
}
