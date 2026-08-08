import { useTranslation } from 'react-i18next'
import { ShieldCheck, BadgeCheck, Scale, MapPin, Calendar, Users } from "lucide-react"

const FEATURES_CONFIG = [
  { icon: ShieldCheck },
  { icon: BadgeCheck },
  { icon: Scale },
  { icon: MapPin },
  { icon: Calendar },
  { icon: Users },
]

export function WhyRentySection() {
  const { t } = useTranslation()
  const featureKeys = ["verifiedIdentity", "securePayment", "disputeProtection", "localPickup", "flexibleDuration", "communityDriven"]

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
              <div key={i} className="rounded-2xl border border-border bg-card p-5">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-1.5">{t(`home.whyRenty.${featureKeys[i]}.title`)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t(`home.whyRenty.${featureKeys[i]}.desc`)}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
