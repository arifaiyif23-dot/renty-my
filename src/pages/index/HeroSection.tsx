import { useTranslation } from 'react-i18next'
import { Button } from "@/components/ui/button"
import { TrustBadge } from "@/components/marketplace/TrustBadge"
import { SearchBarV2 } from "@/components/SearchBarV2"
import { Search, Plus, LogIn, ShieldCheck, BadgeCheck, MapPin, Handshake, Shield } from "lucide-react"

interface HeroSectionProps {
  totalItemCount: number
  user: unknown
  onSearch: () => void
  onListOrAuth: () => void
}

export function HeroSection({ totalItemCount, user, onSearch, onListOrAuth }: HeroSectionProps) {
  const { t } = useTranslation()
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/3 to-transparent pointer-events-none" />
      <div className="px-4 pt-16 md:pt-24 pb-12 md:pb-20 relative">
        <div className="mx-auto max-w-3xl text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <TrustBadge kind="lokal" size="md" />
            <span className="text-xs text-muted-foreground font-medium">
              {t('home.hero.tagline')}
            </span>
          </div>

          <h1 className="mb-5 text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-primary leading-[1.05]">
            {t('home.hero.heading1')}<br />
            <span className="text-gradient-blue">{t('home.hero.heading2')}</span>
          </h1>

          <p className="mb-8 text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              {t('home.hero.description')}
            {totalItemCount > 0 && ` ${t('home.hero.itemsAvailable', { count: totalItemCount })}`}
          </p>

          <div className="max-w-xl mx-auto mb-8">
            <SearchBarV2 variant="hero" />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
            <Button onClick={onSearch} size="lg" variant="brand" className="gap-2 w-full sm:w-auto min-w-[180px] rounded-2xl h-12">
              <Search className="h-5 w-5" />
              {t('home.hero.browseButton')}
            </Button>
            <Button onClick={onListOrAuth} size="lg" variant="outline" className="gap-2 w-full sm:w-auto min-w-[180px] rounded-2xl h-12 border-primary/20 hover:bg-primary/5">
              {user ? <Plus className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
              {user ? t('home.hero.listButton') : t('home.hero.joinButton')}
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-success" />
              {t('home.hero.verifiedOwners')}
            </span>
            <span className="inline-flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-brand-blue" />
              {t('home.hero.securePayments')}
            </span>
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4 text-brand-blue" />
              {t('home.hero.localPickup')}
            </span>
            <span className="inline-flex items-center gap-2">
              <Handshake className="h-4 w-4 text-primary" />
              {t('home.hero.dijaminTrust')}
            </span>
            <span className="inline-flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              PDPA Compliant
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span className="px-1.5 py-0.5 rounded bg-muted font-medium">FPX</span>
              <span className="px-1.5 py-0.5 rounded bg-muted font-medium">DuitNow</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
