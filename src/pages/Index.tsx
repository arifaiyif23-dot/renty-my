import { lazy, Suspense } from "react"
import { useNavigate } from "react-router-dom"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { PageLayout } from "@/components/PageLayout"
import SEO from "@/components/SEO"
import { useIndexData } from "@/hooks/use-index-data"

// Code-split homepage sections so motion/react and below-fold UI load after
// first paint instead of inflating the entry bundle.
const HeroSection = lazy(() => import("@/pages/index/HeroSection").then(m => ({ default: m.HeroSection })))
const CategoriesSection = lazy(() => import("@/pages/index/CategoriesSection").then(m => ({ default: m.CategoriesSection })))
const NewestListingsSection = lazy(() => import("@/pages/index/NewestListingsSection").then(m => ({ default: m.NewestListingsSection })))
const RecentlyViewedSection = lazy(() => import("@/pages/index/RecentlyViewedSection").then(m => ({ default: m.RecentlyViewedSection })))
const OwnerCTASection = lazy(() => import("@/pages/index/OwnerCTASection").then(m => ({ default: m.OwnerCTASection })))
const HowItWorksSection = lazy(() => import("@/pages/index/HowItWorksSection").then(m => ({ default: m.HowItWorksSection })))
const WhyRentySection = lazy(() => import("@/pages/index/WhyRentySection").then(m => ({ default: m.WhyRentySection })))
const TrustStatsSection = lazy(() => import("@/pages/index/TrustStatsSection").then(m => ({ default: m.TrustStatsSection })))
const TestimonialsSection = lazy(() => import("@/pages/index/TestimonialsSection").then(m => ({ default: m.TestimonialsSection })))

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

      <Suspense fallback={<div className="min-h-[60vh]" aria-busy="true" />}>
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
      </Suspense>
    </PageLayout>
  )
}

export default Index