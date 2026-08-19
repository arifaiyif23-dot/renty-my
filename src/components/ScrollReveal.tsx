import { type ReactNode, useMemo } from "react"
import { motion } from "motion/react"

interface ScrollRevealProps {
  children: ReactNode
  delay?: number
  className?: string
  as?: keyof JSX.IntrinsicElements
}

const EASE = [0.16, 1, 0.3, 1] as const

export function ScrollReveal({ children, delay = 0, className, as = "div" }: ScrollRevealProps) {
  const Component = useMemo(() => motion.create(as), [as])
  return (
    <Component
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay, ease: EASE }}
      className={className}
    >
      {children}
    </Component>
  )
}
