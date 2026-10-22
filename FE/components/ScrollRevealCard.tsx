import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"
import { cn } from "./kit"

interface ScrollRevealProps {
  children: ReactNode
  /** Seconds; use small steps (≈0.08) to stagger grouped items. */
  delay?: number
  className?: string
}

/**
 * Fades, lifts and scales content in once it enters the viewport. Uses an
 * IntersectionObserver plus CSS transitions (no motion library), so scrolling
 * never re-renders. Reduced-motion users and keyboard focus see content
 * immediately; see `.rv-scroll-reveal` in styles/global.css.
 */
export function ScrollRevealCard({
  children,
  delay = 0,
  className,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === "undefined") {
      setRevealed(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        setRevealed(true)
        io.disconnect()
      },
      { rootMargin: "0px 0px -60px 0px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      data-revealed={revealed}
      className={cn("rv-scroll-reveal min-w-0", className)}
      style={{ "--reveal-delay": `${delay}s` } as CSSProperties}
    >
      {children}
    </div>
  )
}
