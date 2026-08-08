import { useTranslation } from 'react-i18next'
import { Search, Calendar, Handshake } from "lucide-react"

export function HowItWorksSection() {
  const { t } = useTranslation()

  const steps = [
    { icon: Search, color: "text-primary" },
    { icon: Calendar, color: "text-success" },
    { icon: Handshake, color: "text-action" },
  ]

  return (
    <section id="how-it-works" className="px-4 py-10 md:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-10 md:mb-14">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
            {t('home.howItWorks.title')}
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            {t('home.howItWorks.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8 relative">
          <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-px bg-border" />

          {steps.map((step, i) => {
            const Icon = step.icon
            return (
              <div key={i} className="relative text-center">
                <div className={`w-14 h-14 rounded-2xl bg-background border border-border flex items-center justify-center mx-auto mb-4`}>
                  <Icon className={`h-6 w-6 ${step.color}`} />
                </div>
                <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-muted text-xs font-bold mb-3">
                  {i + 1}
                </div>
                <h3 className="text-lg font-semibold mb-2">{t(`home.howItWorks.step${i + 1}.title`)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  {t(`home.howItWorks.step${i + 1}.description`)}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
