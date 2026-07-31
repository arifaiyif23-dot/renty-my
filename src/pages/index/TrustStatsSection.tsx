import { GlassCard } from "@/components/ui/GlassCard"
import { ShieldCheck, Lock, Users } from "lucide-react"
import type { TrustStats } from "@/hooks/use-index-data"
import { useTranslation } from 'react-i18next'

interface TrustStatsSectionProps {
  stats: TrustStats
}

const trustPillars = [
  { icon: ShieldCheck, key: "verified", gradient: "from-primary/10 via-primary/5 to-transparent" },
  { icon: Lock, key: "secure", gradient: "from-success/10 via-success/5 to-transparent" },
  { icon: Users, key: "community", gradient: "from-action/10 via-action/5 to-transparent" },
]

export function TrustStatsSection({ stats }: TrustStatsSectionProps) {
  const { t } = useTranslation()
  return (
    <section className="px-4 py-10 md:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-10 md:mb-14">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
            {t('home.stats.trustTitle')}
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            {t('home.stats.trustSubtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 mb-10">
          {trustPillars.map((pillar, i) => {
            const Icon = pillar.icon
            return (
              <GlassCard key={i} variant="elevated" padding="lg" className="relative overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-br ${pillar.gradient} opacity-60 pointer-events-none`} />
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/10 to-action/10 flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1">
                    {t(`home.stats.${pillar.key}.title`)}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {t(`home.stats.${pillar.key}.desc`)}
                  </p>
                </div>
              </GlassCard>
            )
          })}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
          <GlassCard variant="subtle" padding="md" className="text-center">
            <p className="text-2xl md:text-3xl font-bold tabular-nums text-foreground">{stats.totalItems.toLocaleString()}</p>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">{t('home.stats.itemsAvailable')}</p>
          </GlassCard>

          <GlassCard variant="subtle" padding="md" className="text-center">
            <p className="text-2xl md:text-3xl font-bold tabular-nums text-foreground">{stats.totalUsers.toLocaleString()}</p>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">{t('home.stats.verifiedMembers')}</p>
          </GlassCard>

          <GlassCard variant="subtle" padding="md" className="text-center">
            <p className="text-2xl md:text-3xl font-bold tabular-nums text-foreground">{stats.completedRentals.toLocaleString()}</p>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">{t('home.stats.successfulRentals')}</p>
          </GlassCard>

          <GlassCard variant="subtle" padding="md" className="text-center">
            <p className="text-2xl md:text-3xl font-bold tabular-nums text-foreground">
              {stats.reviewCount > 0 ? stats.avgRating : '—'}
            </p>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              {stats.reviewCount > 0 ? `${t('home.stats.avgRating')} (${stats.reviewCount})` : t('home.stats.avgRating')}
            </p>
          </GlassCard>
        </div>
      </div>
    </section>
  )
}
