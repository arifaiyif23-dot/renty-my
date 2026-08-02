import { useTranslation } from 'react-i18next'
import { GlassCard } from "@/components/ui/GlassCard"
import { ScrollReveal } from "@/components/ScrollReveal"
import { ShieldCheck, BadgeCheck, Scale, MapPin, Calendar, Users } from "lucide-react"

const FEATURES_CONFIG = [
  { icon: ShieldCheck, gradient: "from-primary/10 via-primary/5 to-transparent" },
  { icon: BadgeCheck, gradient: "from-success/10 via-success/5 to-transparent" },
  { icon: Scale, gradient: "from-action/10 via-action/5 to-transparent" },
  { icon: MapPin, gradient: "from-warning/10 via-warning/5 to-transparent" },
  { icon: Calendar, gradient: "from-action/10 via-action/5 to-transparent" },
  { icon: Users, gradient: "from-primary/10 via-primary/5 to-transparent" },
]

export function WhyRentySection() {
  const { t } = useTranslation()
  const featureKeys = ["verifiedIdentity", "securePayment", "disputeProtection", "localPickup", "flexibleDuration", "communityDriven"]

  return (
    <section id="trust-safety" className="px-4 py-10 md:py-16">
      <div className="mx-auto max-w-6xl">
        <ScrollReveal>
          <div className="text-center mb-10 md:mb-14">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
              {t('home.whyRenty.title')}
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              {t('home.whyRenty.subtitle')}
            </p>
          </div>
        </ScrollReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {FEATURES_CONFIG.map((feature, i) => {
            const Icon = feature.icon
            return (
              <ScrollReveal key={i} delay={i * 0.06}>
                <GlassCard variant="elevated" padding="md" className="relative overflow-hidden hover-glow group">
                  <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-60 pointer-events-none group-hover:opacity-80 transition-opacity`} />
                  <div className="relative">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-1.5">{t(`home.whyRenty.${featureKeys[i]}.title`)}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t(`home.whyRenty.${featureKeys[i]}.desc`)}
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
