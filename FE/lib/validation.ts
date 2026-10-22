import type { RegistrationInput, Role } from "./contracts"

/** Human-readable labels for app and study roles. */
export const ROLE_LABEL: Record<Role, string> = {
  PARTICIPANT: "Study participant",
  RESEARCH_ASSISTANT: "Research assistant",
  HEAD_RESEARCHER: "Head researcher",
  DATA_STEWARD: "Data steward",
  ETHICS_REPRESENTATIVE: "Ethics representative",
}

export interface FieldProblem {
  field: string
  message: string
}

export const PASSWORD_MIN = 12
const ID_PATTERN = /^[a-z][a-z0-9-]{2,31}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Shared by the register form and the adapter so both reject the same input. */
export function registrationProblems(input: RegistrationInput): FieldProblem[] {
  const problems: FieldProblem[] = []
  const id = input.identityId.trim().toLowerCase()
  if (!ID_PATTERN.test(id))
    problems.push({
      field: "identityId",
      message:
        "Use 3–32 lowercase letters, digits or hyphens, starting with a letter (for example, assistant-02).",
    })
  if (!EMAIL_PATTERN.test(input.email.trim()))
    problems.push({ field: "email", message: "Enter a valid email address." })
  const name = input.displayName.trim()
  if (name.length < 2 || name.length > 60)
    problems.push({
      field: "displayName",
      message: "Display name must be 2–60 characters.",
    })
  const pw = input.password
  if (pw.length < PASSWORD_MIN || !/[A-Za-z]/.test(pw) || !/\d/.test(pw))
    problems.push({
      field: "password",
      message: `Use at least ${PASSWORD_MIN} characters, including a letter and a digit.`,
    })
  if (input.confirmPassword !== pw)
    problems.push({
      field: "confirmPassword",
      message: "Passwords do not match.",
    })
  if (
    input.accountType !== "PARTICIPANT" &&
    input.accountType !== "RESEARCH_ASSISTANT"
  )
    problems.push({
      field: "accountType",
      message:
        "Demo registration creates participant or research assistant accounts only.",
    })
  return problems
}

export function validateRegistration(input: RegistrationInput) {
  return registrationProblems(input)[0] ?? null
}

/** A study code is also the study ID, e.g. study-wellbeing-01. */
export const STUDY_CODE_PATTERN = /^[a-z][a-z0-9]*(-[a-z0-9]+){1,5}$/

export function normalizeStudyCode(code: string) {
  return code.trim().toLowerCase()
}

export function studyProblems(input: {
  title: string
  code: string
}): FieldProblem[] {
  const problems: FieldProblem[] = []
  const title = input.title.trim()
  if (title.length < 6 || title.length > 120)
    problems.push({
      field: "title",
      message: "Study title must be 6–120 characters.",
    })
  const code = normalizeStudyCode(input.code)
  if (code.length < 4 || code.length > 48 || !STUDY_CODE_PATTERN.test(code))
    problems.push({
      field: "code",
      message:
        "Use 4–48 lowercase letters, digits and hyphens with at least one hyphen, e.g. study-sleep-02.",
    })
  return problems
}

export function validateStudyInput(input: { title: string; code: string }) {
  return studyProblems(input)[0] ?? null
}
