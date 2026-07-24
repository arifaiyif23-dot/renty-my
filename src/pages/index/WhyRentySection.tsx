import { useTranslation } from 'react-i18next'
import { GlassCard } from "@/components/ui/GlassCard"
import { ShieldCheck, BadgeCheck, Scale, MapPin, Calendar, Users } from "lucide-react"

export function WhyRentySection() {
  const { t } = useTranslation()
  return (
    <section id="trust-safety" className="px-4 py-10 md:py-16 bg-muted/30">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-10 md:mb-14">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-primary mb-3">
            {t('home.whyRenty.title')}
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            {t('home.whyRenty.subtitle')}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          <GlassCard variant="interactive" padding="md">
            <ShieldCheck className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold mb-1.5">{t('home.whyRenty.verifiedIdentity.title')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('home.whyRenty.verifiedIdentity.desc')}
            </p>
          </GlassCard>

          <GlassCard variant="interactive" padding="md">
            <BadgeCheck className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold mb-1.5">{t('home.whyRenty.securePayment.title')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('home.whyRenty.securePayment.desc')}
            </p>
          </GlassCard>

          <GlassCard variant="interactive" padding="md">
            <Scale className="h-8 w-8 text-success mb-3" />
            <h3 className="font-semibold mb-1.5">{t('home.whyRenty.disputeProtection.title')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('home.whyRenty.disputeProtection.desc')}
            </p>
          </GlassCard>

          <GlassCard variant="interactive" padding="md">
            <MapPin className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold mb-1.5">{t('home.whyRenty.localPickup.title')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('home.whyRenty.localPickup.desc')}
            </p>
          </GlassCard>

          <GlassCard variant="interactive" padding="md">
            <Calendar className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold mb-1.5">{t('home.whyRenty.flexibleDuration.title')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('home.whyRenty.flexibleDuration.desc')}
            </p>
          </GlassCard>

          <GlassCard variant="interactive" padding="md">
            <Users className="h-8 w-8 text-success mb-3" />
            <h3 className="font-semibold mb-1.5">{t('home.whyRenty.communityDriven.title')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('home.whyRenty.communityDriven.desc')}
            </p>
          </GlassCard>
        </div>
      </div>
    </section>
  )
}
