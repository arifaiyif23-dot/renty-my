import { useTranslation } from 'react-i18next'
import { GlassCard } from "@/components/ui/GlassCard"
import { ShieldCheck, BadgeCheck, Scale, MapPin, Calendar, Users } from "lucide-react"

const FEATURES_CONFIG = [
  { icon: ShieldCheck, gradient: "from-blue-400/20 via-blue-500/5 to-transparent" },
  { icon: BadgeCheck, gradient: "from-emerald-400/20 via-emerald-500/5 to-transparent" },
  { icon: Scale, gradient: "from-violet-400/20 via-violet-500/5 to-transparent" },
  { icon: MapPin, gradient: "from-amber-400/20 via-amber-500/5 to-transparent" },
  { icon: Calendar, gradient: "from-rose-400/20 via-rose-500/5 to-transparent" },
  { icon: Users, gradient: "from-cyan-400/20 via-cyan-500/5 to-transparent" },
]

export function WhyRentySection() {
  const { t } = useTranslation()
  return (
    <section id="trust-safety" className="px-4 py-10 md:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-10 md:mb-14">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
            {t('home.whyRenty.title')}
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            {t('home.whyRenty.subtitle')}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {FEATURES_CONFIG.map((feature, i) => {
            const Icon = feature.icon
            return (
              <GlassCard key={i} variant="elevated" padding="md" className="relative overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-60 pointer-events-none`} />
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl glass flex items-center justify-center mb-3 ring-1 ring-border/50">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1.5">{t(`home.whyRenty.${["verifiedIdentity","securePayment","disputeProtection","localPickup","flexibleDuration","communityDriven"][i]}.title`)}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t(`home.whyRenty.${["verifiedIdentity","securePayment","disputeProtection","localPickup","flexibleDuration","communityDriven"][i]}.desc`)}
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
