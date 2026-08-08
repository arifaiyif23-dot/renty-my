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
        />

        {(categories.length > 0 || isLoading) && (
          <CategoriesSection categories={categories} isLoading={isLoading} onNavigate={navigate} />
        )}

        <NewestListingsSection items={featuredItems} isLoading={isLoading} onNavigate={navigate} />

        {recentlyViewed.length > 0 && (
          <RecentlyViewedSection items={recentlyViewed} onNavigate={navigate} />
        )}

        <OwnerCTASection onNavigate={navigate} />
      </Suspense>
    </PageLayout>
  )
}

export default Index
