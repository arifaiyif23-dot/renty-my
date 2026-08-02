import { SearchBarV2 } from "@/components/SearchBarV2"
import { ShieldCheck, Lock, Users } from "lucide-react"
import { motion } from "motion/react"
import { Button } from "@/components/ui/button"
import { useTranslation } from 'react-i18next'

interface HeroSectionProps {
  totalItemCount: number
  onListOrAuth: () => void
}

const EASE = [0.16, 1, 0.3, 1] as const

const trustItems = [
  { icon: ShieldCheck, label: "trust1" },
  { icon: Lock, label: "trust2" },
  { icon: Users, label: "trust3" },
]

export function HeroSection({ totalItemCount, onListOrAuth }: HeroSectionProps) {
  const { t } = useTranslation()
  const trustLabels = t('home.hero.trustItems', { returnObjects: true }) as string[]

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-action/5">
      <div className="mx-auto max-w-5xl px-4 pt-16 md:pt-24 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="flex flex-col items-center text-center"
        >
          <h1 className="mb-5 text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.05] max-w-3xl">
            {t('home.hero.heading1')}
            <br />
            <span className="text-gradient">{t('home.hero.heading2')}</span>
          </h1>

          <p className="mb-8 text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl">
            {t('home.hero.description')}
          </p>

          <div className="w-full max-w-3xl mb-8">
            <SearchBarV2 variant="hero" />
          </div>

          <Button
            variant="brand"
            size="lg"
            className="gap-2 shadow-2 rounded-2xl h-12 px-8"
            onClick={onListOrAuth}
          >
            {t('listItem.title')}
          </Button>
        </motion.div>
      </div>

      <div className="border-t border-border/50">
        <div className="mx-auto max-w-7xl px-4 py-5">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center font-medium text-foreground/70">
              {t('home.hero.itemsAvailable', { count: totalItemCount })}
            </span>
            {trustItems.map((item, i) => {
              const Icon = item.icon
              return (
                <span key={i} className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  {trustLabels[i] || item.label}
                </span>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
