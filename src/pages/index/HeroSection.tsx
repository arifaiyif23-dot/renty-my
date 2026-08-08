import { SearchBarV2 } from "@/components/SearchBarV2"
import { useTranslation } from 'react-i18next'
import { ShieldCheck, Lock, Users } from 'lucide-react'

interface HeroSectionProps {
  totalItemCount: number
}

const TRUST_ICONS = [ShieldCheck, Lock, Users]

export function HeroSection({ totalItemCount }: HeroSectionProps) {
  const { t } = useTranslation()
  const trustItems = t('home.hero.trustItems', { returnObjects: true }) as string[] | string

  return (
    <section className="px-4 pt-12 md:pt-20 pb-6">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm text-muted-foreground mb-4">
          {t('home.hero.itemsAvailable', { count: totalItemCount })}
        </p>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.1] text-balance">
          {t('home.hero.heading1')}{' '}
          <span className="text-primary">{t('home.hero.heading2')}</span>
        </h1>
        <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-xl mx-auto">
          {t('home.hero.description')}
        </p>
        <div className="mt-8 w-full">
          <SearchBarV2 variant="hero" />
        </div>
        {Array.isArray(trustItems) && trustItems.length > 0 && (
          <div className="hidden sm:flex items-center justify-center gap-6 mt-8 text-xs text-muted-foreground">
            {trustItems.map((label: string, i: number) => {
              const Icon = TRUST_ICONS[i % TRUST_ICONS.length]
              return (
                <span key={label} className="flex items-center gap-1.5">
                  <Icon className="h-4 w-4 text-primary" />
                  {label}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}