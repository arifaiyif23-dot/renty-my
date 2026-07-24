import { useTranslation } from 'react-i18next'
import { GlassCard } from "@/components/ui/GlassCard"
import { Search, Calendar, Handshake } from "lucide-react"

export function HowItWorksSection() {
  const { t } = useTranslation()
  return (
    <section id="how-it-works" className="px-4 py-10 md:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-10 md:mb-14">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-primary mb-3">
            {t('home.howItWorks.title')}
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            {t('home.howItWorks.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          <GlassCard variant="subtle" padding="lg" className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Search className="h-6 w-6 text-primary" />
            </div>
            <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary text-primary-foreground text-xs font-bold mb-3">1</div>
            <h3 className="text-lg font-semibold mb-2">{t('home.howItWorks.step1.title')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
              {t('home.howItWorks.step1.description')}
            </p>
          </GlassCard>

          <GlassCard variant="subtle" padding="lg" className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
              <Calendar className="h-6 w-6 text-success" />
            </div>
            <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary text-primary-foreground text-xs font-bold mb-3">2</div>
            <h3 className="text-lg font-semibold mb-2">{t('home.howItWorks.step2.title')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
              {t('home.howItWorks.step2.description')}
            </p>
          </GlassCard>

          <GlassCard variant="subtle" padding="lg" className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Handshake className="h-6 w-6 text-primary" />
            </div>
            <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary text-primary-foreground text-xs font-bold mb-3">3</div>
            <h3 className="text-lg font-semibold mb-2">{t('home.howItWorks.step3.title')}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
              {t('home.howItWorks.step3.description')}
            </p>
          </GlassCard>
        </div>
      </div>
    </section>
  )
}
