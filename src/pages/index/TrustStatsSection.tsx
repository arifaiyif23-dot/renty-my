import { GlassCard } from "@/components/ui/GlassCard"
import { Package, Users, Handshake, Star } from "lucide-react"
import type { TrustStats } from "@/hooks/use-index-data"
import { useTranslation } from 'react-i18next'

interface TrustStatsSectionProps {
  stats: TrustStats
}

export function TrustStatsSection({ stats }: TrustStatsSectionProps) {
  const { t } = useTranslation()
  return (
    <section className="px-4 py-10 md:py-16">
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
          <GlassCard variant="subtle" padding="md" className="text-center">
            <Package className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="text-2xl md:text-3xl font-bold tabular-nums text-foreground">{stats.totalItems.toLocaleString()}</p>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">{t('home.stats.itemsAvailable')}</p>
          </GlassCard>

          <GlassCard variant="subtle" padding="md" className="text-center">
            <Users className="h-6 w-6 text-success mx-auto mb-2" />
            <p className="text-2xl md:text-3xl font-bold tabular-nums text-foreground">{stats.totalUsers.toLocaleString()}</p>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">{t('home.stats.verifiedMembers')}</p>
          </GlassCard>

          <GlassCard variant="subtle" padding="md" className="text-center">
            <Handshake className="h-6 w-6 text-primary mx-auto mb-2" />
            <p className="text-2xl md:text-3xl font-bold tabular-nums text-foreground">{stats.completedRentals.toLocaleString()}</p>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">{t('home.stats.successfulRentals')}</p>
          </GlassCard>

          <GlassCard variant="subtle" padding="md" className="text-center">
            <Star className="h-6 w-6 text-amber-400 mx-auto mb-2" />
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
