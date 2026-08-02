import { useTranslation } from 'react-i18next'
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/ui/GlassCard"
import { Plus, ArrowRight } from "lucide-react"
import { ScrollReveal } from "@/components/ScrollReveal"

interface OwnerCTASectionProps {
  onNavigate: (path: string) => void
}

export function OwnerCTASection({ onNavigate }: OwnerCTASectionProps) {
  const { t } = useTranslation()

  return (
    <section className="px-4 py-10 md:py-16">
      <div className="mx-auto max-w-6xl">
        <ScrollReveal>
          <GlassCard variant="elevated" padding="lg" className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-card to-action/5 border-primary/10 hover-glow group">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--action)/0.08),transparent_60%)] pointer-events-none group-hover:opacity-80 transition-opacity" />
            <div className="relative md:flex md:items-center md:justify-between gap-6">
              <div>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-2">
                  {t('home.ownerCta.title')}
                </h2>
                <p className="text-muted-foreground max-w-lg">
                  {t('home.ownerCta.description')}
                </p>
              </div>
              <div className="mt-4 md:mt-0 shrink-0 w-full md:w-auto">
                <Button onClick={() => onNavigate('/list-item')} size="lg" variant="brand" className="gap-2 rounded-2xl h-12 shadow-2 w-full md:w-auto hover-glow">
                  <Plus className="h-5 w-5" />
                  {t('home.ownerCta.button')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </GlassCard>
        </ScrollReveal>
      </div>
    </section>
  )
}
