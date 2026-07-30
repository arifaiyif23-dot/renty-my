import { SearchBarV2 } from "@/components/SearchBarV2"
import { AuroraBackground } from "@/components/AuroraBackground"
import { FloatingRentalObjects } from "@/components/FloatingRentalObjects"
import { ShieldCheck, Lock, Users } from "lucide-react"
import { motion } from "motion/react"
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"
import { useTranslation } from 'react-i18next'

interface HeroSectionProps {
  totalItemCount: number
  onSearch: () => void
  onListOrAuth: () => void
}

const trustItems = [
  { icon: ShieldCheck, label: "trust1" },
  { icon: Lock, label: "trust2" },
  { icon: Users, label: "trust3" },
]

export function HeroSection(_props: HeroSectionProps) {
  const { t } = useTranslation()
  const trustLabels = t('home.hero.trustItems', { returnObjects: true }) as string[]

  return (
    <AuroraBackground variant="hero" className="min-h-0">
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 pt-16 md:pt-24 pb-0">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="mb-4 text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.05] max-w-2xl">
              {t('home.hero.heading1')}
              <br />
              <span className="text-gradient">{t('home.hero.heading2')}</span>
            </h1>

            <p className="mb-6 text-base md:text-lg text-muted-foreground leading-relaxed max-w-lg">
              {t('home.hero.description')}
            </p>

            <div className="max-w-xl mb-6">
              <SearchBarV2 variant="hero" />
            </div>

            <div className="flex items-center gap-3">
              <Link to="/list-item">
                <Button variant="brand" size="lg" className="gap-2 shadow-2 rounded-2xl h-12 px-8">
                  List Your Item
                </Button>
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="hidden md:block relative w-full h-[500px]"
          >
            <FloatingRentalObjects className="w-full h-full" />
          </motion.div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="border-t border-border/50 mt-8 md:mt-12"
      >
        <div className="mx-auto max-w-7xl px-4 py-5">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-muted-foreground">
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
      </motion.div>
    </section>
    </AuroraBackground>
  )
}
