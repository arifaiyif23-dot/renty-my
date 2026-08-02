import { useNavigate } from "react-router-dom"
import { PageLayout } from "@/components/PageLayout"
import SEO from "@/components/SEO"
import { AuroraBackground } from "@/components/AuroraBackground"
import { useTranslation } from 'react-i18next'
import { HowItWorksSection } from "@/pages/index/HowItWorksSection"
import { WhyRentySection } from "@/pages/index/WhyRentySection"
import { TrustStatsSection } from "@/pages/index/TrustStatsSection"
import { TestimonialsSection } from "@/pages/index/TestimonialsSection"
import { OwnerCTASection } from "@/pages/index/OwnerCTASection"
import { useIndexData } from "@/hooks/use-index-data"

const About = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { trustStats } = useIndexData()

  return (
    <PageLayout variant="full" className="pb-0">
      <SEO
        title={t('about.title')}
        description={t('about.description')}
      />

      <AuroraBackground variant="accent" className="min-h-0">
        <div className="mx-auto max-w-5xl px-4 pt-16 md:pt-20 pb-12 text-center">
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-[1.1] max-w-2xl mx-auto mb-4">
            {t('about.headline')}
          </h1>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
            {t('about.description')}
          </p>
        </div>
      </AuroraBackground>

      <HowItWorksSection />

      <WhyRentySection />

      {trustStats && <TrustStatsSection stats={trustStats} />}

      <TestimonialsSection />

      <OwnerCTASection onNavigate={navigate} />
    </PageLayout>
  )
}

export default About
