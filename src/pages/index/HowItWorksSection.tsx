import { useTranslation } from 'react-i18next'
import { GlassCard } from "@/components/ui/GlassCard"
import { ScrollReveal } from "@/components/ScrollReveal"
import { Search, Calendar, Handshake } from "lucide-react"

export function HowItWorksSection() {
  const { t } = useTranslation()

  const steps = [
    { icon: Search, gradient: "from-primary/10 via-primary/5 to-transparent", color: "text-primary" },
    { icon: Calendar, gradient: "from-success/10 via-success/5 to-transparent", color: "text-success" },
    { icon: Handshake, gradient: "from-action/10 via-action/5 to-transparent", color: "text-action" },
  ]

  return (
    <section id="how-it-works" className="px-4 py-10 md:py-16">
      <div className="mx-auto max-w-6xl">
        <ScrollReveal>
          <div className="text-center mb-10 md:mb-14">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
              {t('home.howItWorks.title')}
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              {t('home.howItWorks.subtitle')}
            </p>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8 relative">
          <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          {steps.map((step, i) => {
            const Icon = step.icon
            return (
              <ScrollReveal key={i} delay={i * 0.1}>
                <GlassCard variant="elevated" padding="lg" className="relative overflow-hidden text-center hover-glow">
                  <div className={`absolute inset-0 bg-gradient-to-br ${step.gradient} opacity-60 pointer-events-none`} />
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl glass flex items-center justify-center mx-auto mb-4 ring-1 ring-border/50">
                      <Icon className={`h-6 w-6 ${step.color}`} />
                    </div>
                    <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg glass text-xs font-bold mb-3 ring-1 ring-border/50">
                      {i + 1}
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{t(`home.howItWorks.step${i + 1}.title`)}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                      {t(`home.howItWorks.step${i + 1}.description`)}
                    </p>
                  </div>
                </GlassCard>
              </ScrollReveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
