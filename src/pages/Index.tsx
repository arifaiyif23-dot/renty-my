import { useNavigate } from "react-router-dom"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { PageLayout } from "@/components/PageLayout"
import SEO from "@/components/SEO"
import { useIndexData } from "@/hooks/use-index-data"
import { HeroSection } from "@/pages/index/HeroSection"
import { CategoriesSection } from "@/pages/index/CategoriesSection"
import { NewestListingsSection } from "@/pages/index/NewestListingsSection"
import { RecentlyViewedSection } from "@/pages/index/RecentlyViewedSection"
import { OwnerCTASection } from "@/pages/index/OwnerCTASection"
import { HowItWorksSection } from "@/pages/index/HowItWorksSection"
import { WhyRentySection } from "@/pages/index/WhyRentySection"
import { TrustStatsSection } from "@/pages/index/TrustStatsSection"
import { TestimonialsSection } from "@/pages/index/TestimonialsSection"

const Index = () => {
  const navigate = useNavigate()
  useKeyboardShortcuts()

  const {
    user,
    featuredItems,
    loading,
    categories,
    totalItemCount,
    recentlyViewed,
    trustStats,
    statsLoading,
  } = useIndexData()

  const isLoading = loading

  return (
    <PageLayout variant="full" className="pb-0">
      <SEO
        title={user ? "Renty" : "Renty — Rent Anything in Malaysia"}
        description={`Trusted peer-to-peer rentals. ${totalItemCount || 'Hundreds of'} verified items from cameras to cars.`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Renty",
          url: window.location.origin,
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: `${window.location.origin}/search?q={search_term_string}`,
            },
            "query-input": "required name=search_term_string",
          },
        }}
      />

      <HeroSection
        totalItemCount={totalItemCount}
        onListOrAuth={() => navigate(user ? '/list-item' : '/auth')}
      />

      {(categories.length > 0 || isLoading) && (
        <CategoriesSection categories={categories} isLoading={isLoading} onNavigate={navigate} />
      )}

      <NewestListingsSection items={featuredItems} isLoading={isLoading} onNavigate={navigate} />

      <HowItWorksSection />

      <WhyRentySection />

      {!statsLoading && trustStats && (
        <TrustStatsSection stats={trustStats} />
      )}

      {recentlyViewed.length > 0 && (
        <RecentlyViewedSection items={recentlyViewed} onNavigate={navigate} />
      )}

      <TestimonialsSection />

      <OwnerCTASection onNavigate={navigate} />
    </PageLayout>
  )
}

export default Index
