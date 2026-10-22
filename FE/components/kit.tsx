import {
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react"
import { ChevronDown, X } from "lucide-react"

/* ---------------------------------------------------------------------------
 * Local component kit — the primitive layer under components/ui.tsx.
 * Every control is skinned exclusively through the rv-* classes and Quantum
 * tokens in styles/global.css, so the product owns its markup end to end.
 * ------------------------------------------------------------------------- */

type ClassValue = string | false | null | undefined

export function cn(...classes: ClassValue[]) {
  return classes.filter(Boolean).join(" ")
}

export interface KitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  iconStart?: ReactNode
  iconEnd?: ReactNode
}

/** Unstyled native button; skins come from the rv-btn classes. */
export function Button({
  iconStart,
  iconEnd,
  className,
  type = "button",
  children,
  ...rest
}: KitButtonProps) {
  return (
    <button type={type} className={cn("rv-btn", className)} {...rest}>
      {iconStart}
      {children}
      {iconEnd}
    </button>
  )
}

export function IconButton({
  icon,
  className,
  type = "button",
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: ReactNode
  "aria-label": string
}) {
  return (
    <button type={type} className={cn("rv-icon-btn", className)} {...rest}>
      {icon}
    </button>
  )
}

/* ----- form fields ----- */

function FieldFrame({
  id,
  label,
  description,
  error,
  className,
  children,
}: {
  id: string
  label: ReactNode
  description?: ReactNode
  error?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("rv-field", className)}>
      <label htmlFor={id} className="rv-field__label">
        {label}
      </label>
      {children}
      {description && (
        <p id={`${id}-hint`} className="rv-field__hint">
          {description}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="rv-field__error">
          {error}
        </p>
      )}
    </div>
  )
}

function describedBy(
  id: string,
  description: unknown,
  error: unknown,
  extra?: string,
) {
  const ids = [
    description ? `${id}-hint` : null,
    error ? `${id}-error` : null,
    extra ?? null,
  ].filter(Boolean)
  return ids.length ? ids.join(" ") : undefined
}

export interface InputFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  label: ReactNode
  value: string
  onChange: (value: string) => void
  description?: ReactNode
  error?: ReactNode
  /** Trailing adornment inside the control (e.g. a visibility toggle). */
  adornment?: ReactNode
}

export function InputField({
  label,
  value,
  onChange,
  description,
  error,
  adornment,
  className,
  id: idProp,
  "aria-describedby": ariaDescribedBy,
  ...rest
}: InputFieldProps) {
  const generated = useId()
  const id = idProp ?? generated
  return (
    <FieldFrame
      id={id}
      label={label}
      description={description}
      error={error}
      className={className}
    >
      <div className="rv-field__control">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, description, error, ariaDescribedBy)}
          {...rest}
        />
        {adornment}
      </div>
    </FieldFrame>
  )
}

export interface TextareaFieldProps
  extends Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    "onChange" | "value"
  > {
  label: ReactNode
  value: string
  onChange: (value: string) => void
  description?: ReactNode
  error?: ReactNode
}

export function TextareaField({
  label,
  value,
  onChange,
  description,
  error,
  className,
  id: idProp,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ...rest
}: TextareaFieldProps) {
  const generated = useId()
  const id = idProp ?? generated
  return (
    <FieldFrame
      id={id}
      label={label}
      description={description}
      error={error}
      className={className}
    >
      <div className="rv-field__control rv-field__control--multiline">
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error || ariaInvalid ? true : undefined}
          aria-describedby={describedBy(id, description, error, ariaDescribedBy)}
          {...rest}
        />
      </div>
    </FieldFrame>
  )
}

export function SelectField({
  label,
  options,
  value,
  onChange,
  description,
  className,
}: {
  label: ReactNode
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  description?: ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <FieldFrame
      id={id}
      label={label}
      description={description}
      className={className}
    >
      <div className="rv-field__control rv-field__control--select">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={describedBy(id, description, null)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="size-4 shrink-0" aria-hidden />
      </div>
    </FieldFrame>
  )
}

/* ----- radio group: native radios, so arrow-key behaviour is built in ----- */

export function RadioGroup({
  name,
  value,
  onChange,
  options,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: {
  name: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: ReactNode; description?: ReactNode }[]
  className?: string
  "aria-label"?: string
  "aria-labelledby"?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={cn("rv-radios", className)}
    >
      {options.map((o) => (
        <label key={o.value} className="rv-radio">
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="rv-radio__input"
          />
          <span className="rv-radio__dot" aria-hidden />
          <span className="rv-radio__text">
            <span className="rv-radio__label">{o.label}</span>
            {o.description && (
              <span className="rv-radio__description">{o.description}</span>
            )}
          </span>
        </label>
      ))}
    </div>
  )
}

/* ----- tabs (WAI-ARIA tabs pattern with roving focus) ----- */

export function Tabs({
  tabs,
  className,
  label,
}: {
  tabs: { id: string; label: ReactNode; content: ReactNode }[]
  className?: string
  label?: string
}) {
  const [active, setActive] = useState(tabs[0]?.id)
  const base = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const current = tabs.find((t) => t.id === active) ?? tabs[0]

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((t) => t.id === current?.id)
    let next: number
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length
    else if (e.key === "Home") next = 0
    else if (e.key === "End") next = tabs.length - 1
    else return
    e.preventDefault()
    setActive(tabs[next].id)
    refs.current[next]?.focus()
  }

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} onKeyDown={onKey}>
        {tabs.map((t, i) => {
          const selected = t.id === current?.id
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(t.id)}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      {current && (
        <div
          role="tabpanel"
          id={`${base}-panel-${current.id}`}
          aria-labelledby={`${base}-tab-${current.id}`}
          tabIndex={0}
        >
          {current.content}
        </div>
      )}
    </div>
  )
}

/* ----- modal: native <dialog> gives a focus trap, Esc and focus return ----- */

export function Modal({
  isOpen,
  onClose,
  title,
  footer,
  children,
  className,
}: {
  isOpen: boolean
  onClose: () => void
  title: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
  /** Accepted for call-site compatibility; width comes from .rv-modal. */
  size?: "small" | "medium" | "large"
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (isOpen && !dialog.open) dialog.showModal()
    if (!isOpen && dialog.open) dialog.close()
  }, [isOpen])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={cn("rv-dialog", className)}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        // A click on the dialog element itself is a click on the backdrop.
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {isOpen && (
        <>
          <div className="rv-modal__head">
            <h2 id={titleId}>{title}</h2>
            <IconButton
              aria-label="Close dialog"
              icon={<X className="size-5" aria-hidden />}
              onClick={onClose}
            />
          </div>
          <div className="rv-modal__body">{children}</div>
          {footer && <div className="rv-modal__foot">{footer}</div>}
        </>
      )}
    </dialog>
  )
}
