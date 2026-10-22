import { cn } from "@/components/kit"
import type { RecordEnvelope } from "@/lib/contracts"
import { Mono } from "./ui"

/** Renders authorized plaintext. Only ever receives an envelope from a successful decrypt. */
export function RecordPlaintext({
  envelope,
  onDark,
}: {
  envelope: RecordEnvelope
  onDark?: boolean
}) {
  const c = envelope.content
  // onDark kept for call-site compatibility; every surface shares one rule colour.
  void onDark
  const rule = "rule-dotted-b"
  // Full-width, left-aligned, normal word wrapping for readable plaintext.
  const prose =
    "w-full min-w-0 whitespace-normal break-words text-left type-body text-body"
  return (
    <div className="flex w-full min-w-0 flex-col gap-lg">
      <p className="type-caption break-words text-ink-muted">
        Decrypted {envelope.decryptedAt} · auth v{envelope.authorizationVersion}{" "}
        · <Mono>{envelope.ciphertextRef}</Mono>
      </p>
      {c.kind === "PROTOCOL" && (
        <dl className="flex w-full flex-col">
          {c.sections.map((s) => (
            <div key={s.heading} className={cn(rule, "py-lg last:border-b-0")}>
              <dt className="type-eyebrow">{s.heading}</dt>
              <dd className={cn(prose, "pt-xs opacity-90")}>{s.body}</dd>
            </div>
          ))}
        </dl>
      )}
      {c.kind === "TRANSCRIPT" && (
        <ol className="flex w-full flex-col">
          {c.turns.map((t, i) => (
            <li
              key={i}
              className={cn(
                rule,
                "grid gap-xs py-lg last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-xl",
              )}
            >
              <span className="type-id uppercase sm:pt-xs">{t.speaker}</span>
              <span className="flex min-w-0 flex-col gap-md">
                <span className={prose}>{t.text}</span>
                {t.codes && (
                  <span className="flex flex-wrap gap-xs">
                    {t.codes.map((code) => (
                      <span
                        key={code}
                        className="rounded-pill bg-accent-wash px-md py-xs type-caption text-accent"
                      >
                        {code}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
      {c.kind === "IDENTITY" && (
        <dl className="flex w-full flex-col">
          {c.fields.map((f) => (
            <div
              key={f.label}
              className={cn(
                rule,
                "flex flex-wrap justify-between gap-x-xl gap-y-xs py-lg last:border-b-0",
              )}
            >
              <dt className="type-body text-body-sm">{f.label}</dt>
              <dd className="min-w-0 type-id break-words">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
