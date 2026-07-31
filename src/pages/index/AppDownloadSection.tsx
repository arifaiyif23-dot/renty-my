import { useTranslation } from 'react-i18next'
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/ui/GlassCard"
import { Smartphone as SmartphoneIcon, Download, Search, Bell } from "lucide-react"
import { toast } from "sonner"

interface AppDownloadSectionProps {
  onNavigate: (path: string) => void
}

export function AppDownloadSection({ onNavigate }: AppDownloadSectionProps) {
  const { t } = useTranslation()
  const handleInstallApp = async () => {
    const w = window as unknown as { __deferred_prompt?: { prompt: () => void; userChoice: Promise<{ outcome: string }> } }
    const deferredPrompt = w.__deferred_prompt
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const result = await deferredPrompt.userChoice
      if (result.outcome === 'accepted') {
        toast.success(t('home.appDownload.installSuccess'))
      }
    } else {
      onNavigate('/install')
    }
  }

  return (
    <section className="px-4 py-10 md:py-16">
      <div className="mx-auto max-w-5xl">
        <GlassCard variant="elevated" padding="lg" className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-card to-action/5">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--action)/0.06),transparent_60%)] pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            <div className="shrink-0">
              <div className="relative w-48 h-80 md:w-56 md:h-96 glass rounded-[1.75rem] border border-border/60 shadow-2">
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-1.5 bg-border rounded-full" />
                <div className="absolute inset-3 rounded-2xl bg-background overflow-hidden flex flex-col items-center justify-center">
                  <span className="text-primary text-lg tracking-tight" style={{ fontFamily: 'Chunk, serif' }}>renty</span>
                  <div className="mt-3 w-8 h-8 rounded-xl glass flex items-center justify-center ring-1 ring-border/50">
                    <Search className="h-4 w-4 text-primary" />
                  </div>
                  <div className="mt-4 space-y-2 w-3/4">
                    <div className="h-2 bg-muted rounded-full w-full" />
                    <div className="h-2 bg-muted rounded-full w-2/3" />
                    <div className="h-2 bg-muted rounded-full w-3/4" />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full glass text-xs font-medium mb-4 ring-1 ring-border/50">
                <SmartphoneIcon className="h-3.5 w-3.5 text-primary" />
                {t('home.appDownload.badge')}
              </div>

              <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
                {t('home.appDownload.title')}
              </h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto lg:mx-0">
                {t('home.appDownload.description')}
              </p>

              <ul className="space-y-3 mb-6 text-sm text-left max-w-xs mx-auto lg:mx-0">
                <li className="flex items-start gap-3">
                  <Download className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{t('home.appDownload.feature1')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <SmartphoneIcon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{t('home.appDownload.feature2')}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Bell className="h-5 w-5 text-success shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{t('home.appDownload.feature3')}</span>
                </li>
              </ul>

              <Button onClick={handleInstallApp} size="lg" variant="brand" className="gap-2 w-full sm:w-auto rounded-2xl h-12 shadow-2">
                <Download className="h-5 w-5" />
                {t('home.appDownload.installButton')}
              </Button>
            </div>
          </div>
        </GlassCard>
      </div>
    </section>
  )
}
