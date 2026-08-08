import { useTranslation } from 'react-i18next'
import { Button } from "@/components/ui/button"
import { Plus, ArrowRight } from "lucide-react"

interface OwnerCTASectionProps {
  onNavigate: (path: string) => void
}

export function OwnerCTASection({ onNavigate }: OwnerCTASectionProps) {
  const { t } = useTranslation()

  return (
    <section className="px-4 py-10 md:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
          <div className="md:flex md:items-center md:justify-between gap-6">
            <div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-2">
                {t('home.ownerCta.title')}
              </h2>
              <p className="text-muted-foreground max-w-lg">
                {t('home.ownerCta.description')}
              </p>
            </div>
            <div className="mt-4 md:mt-0 shrink-0 w-full md:w-auto">
              <Button onClick={() => onNavigate('/list-item')} size="lg" variant="brand" className="gap-2 rounded-xl h-12 w-full md:w-auto">
                <Plus className="h-5 w-5" />
                {t('home.ownerCta.button')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
