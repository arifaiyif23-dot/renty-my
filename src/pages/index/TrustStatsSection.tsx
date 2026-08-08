import { ShieldCheck, Lock, Users } from "lucide-react"
import type { TrustStats } from "@/hooks/use-index-data"
import { useTranslation } from 'react-i18next'

interface TrustStatsSectionProps {
  stats: TrustStats
}

const trustPillars = [
  { icon: ShieldCheck, key: "verified" },
  { icon: Lock, key: "secure" },
  { icon: Users, key: "community" },
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
              <div key={i} className="rounded-2xl border border-border bg-card p-6">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-1">
                  {t(`home.stats.${pillar.key}.title`)}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t(`home.stats.${pillar.key}.desc`)}
                </p>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
          {[
            { value: stats.totalItems, label: t('home.stats.itemsAvailable') },
            { value: stats.totalUsers, label: t('home.stats.verifiedMembers') },
            { value: stats.completedRentals, label: t('home.stats.successfulRentals') },
            { value: null, label: stats.reviewCount > 0 ? `${t('home.stats.avgRating')} (${stats.reviewCount})` : t('home.stats.avgRating'), display: stats.reviewCount > 0 ? stats.avgRating : '—' },
          ].map((stat, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4 text-center">
              <p className="text-2xl md:text-3xl font-bold tabular-nums text-foreground">
                {stat.value !== null ? stat.value.toLocaleString() : stat.display}
              </p>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
