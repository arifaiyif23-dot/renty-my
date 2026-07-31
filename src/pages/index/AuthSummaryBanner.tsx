import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/ui/GlassCard"
import { LayoutDashboard, Clock, MessageCircle, TrendingUp, Package } from "lucide-react"
import type { AuthSummary } from "@/hooks/use-index-data"
import { useTranslation } from 'react-i18next'

interface AuthSummaryBannerProps {
  authSummary: AuthSummary
  fullName?: string
  onNavigate: (path: string) => void
}

export function AuthSummaryBanner({ authSummary, fullName, onNavigate }: AuthSummaryBannerProps) {
  const { t } = useTranslation()
  return (
    <section className="bg-primary/5 border-b border-border">
      <div className="mx-auto max-w-6xl px-4 py-4 md:py-6">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t('home.welcome.welcomeBack')}</p>
            <h2 className="text-lg md:text-xl font-bold tracking-tight">
              {fullName?.split(' ')[0] || 'there'}
            </h2>
          </div>
          <Button variant="outline" size="sm" onClick={() => onNavigate('/dashboard')} className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">{t('home.welcome.dashboard')}</span>
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <GlassCard variant="interactive" padding="sm" className="cursor-pointer" onClick={() => onNavigate('/dashboard')}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t('home.welcome.active')}</p>
                <p className="text-lg md:text-xl font-bold tabular-nums">{authSummary.activeRentals}</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard variant="interactive" padding="sm" className="cursor-pointer" onClick={() => onNavigate('/dashboard')}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t('home.welcome.pending')}</p>
                <p className="text-lg md:text-xl font-bold tabular-nums">{authSummary.pendingRequests}</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard variant="interactive" padding="sm" className="cursor-pointer" onClick={() => onNavigate('/messages')}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t('home.welcome.messages')}</p>
                <p className="text-lg md:text-xl font-bold tabular-nums">{authSummary.unreadMessages}</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard variant="interactive" padding="sm" className="cursor-pointer" onClick={() => onNavigate('/my-listings')}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t('home.welcome.listings')}</p>
                <p className="text-lg md:text-xl font-bold tabular-nums">{authSummary.myListingsCount}</p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </section>
  )
}
