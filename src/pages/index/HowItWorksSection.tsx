import { useTranslation } from 'react-i18next'
import { GlassCard } from "@/components/ui/GlassCard"
import { Search, Calendar, Handshake } from "lucide-react"

export function HowItWorksSection() {
  const { t } = useTranslation()
  return (
    <section id="how-it-works" className="px-4 py-10 md:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-10 md:mb-14">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
            {t('home.howItWorks.title')}
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            {t('home.howItWorks.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {[
            { icon: Search, gradient: "from-blue-400/20 via-blue-500/5 to-transparent", color: "text-blue-500" },
            { icon: Calendar, gradient: "from-emerald-400/20 via-emerald-500/5 to-transparent", color: "text-emerald-500" },
            { icon: Handshake, gradient: "from-violet-400/20 via-violet-500/5 to-transparent", color: "text-violet-500" },
          ].map((step, i) => {
            const Icon = step.icon
            return (
              <GlassCard key={i} variant="elevated" padding="lg" className="relative overflow-hidden text-center">
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
            )
          })}
        </div>
      </div>
    </section>
  )
}
