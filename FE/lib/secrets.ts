/* ---------------------------------------------------------------------------
 * Browser-side secret handling for the fixture directory. Nothing here talks
 * to a server: hashes and codes are computed with Web Crypto and stay local.
 * ------------------------------------------------------------------------- */

const encoder = new TextEncoder()
/** Unambiguous alphabet: no 0/O, 1/I/L. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("")

export function randomHex(bytes: number) {
  const out = new Uint8Array(bytes)
  crypto.getRandomValues(out)
  return Array.from(out, (b) => b.toString(16).padStart(2, "0")).join("")
}

/** Cryptographically random code such as TEAM-7KQ2-M9XD-4HRT. */
export function randomCode(prefix: string, groups = 3, size = 4) {
  const out = new Uint8Array(groups * size)
  crypto.getRandomValues(out)
  const chars = Array.from(out, (b) => ALPHABET[b % ALPHABET.length])
  const parts = Array.from({ length: groups }, (_, i) =>
    chars.slice(i * size, i * size + size).join(""),
  )
  return [prefix, ...parts].join("-")
}

/** Upper-case, trims and collapses whitespace so pasted codes still match. */
export function normalizeCode(input: string) {
  return input.trim().toUpperCase().replace(/\s+/g, "")
}

export async function sha256(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)))
}

const PBKDF2_ITERATIONS = 120_000

/** Salted PBKDF2-SHA-256. Only the salt and derived hash are ever stored. */
export async function hashPassword(password: string, salt = randomHex(16)) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: encoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
    },
    key,
    256,
  )
  return { salt, hash: toHex(bits) }
}

/** Constant-time string comparison for equal-length hex digests. */
export function digestsEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
