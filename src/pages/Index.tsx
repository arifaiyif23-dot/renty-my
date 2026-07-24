import { useNavigate } from "react-router-dom"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import SEO from "@/components/SEO"
import { VerificationRequiredBanner } from "@/components/VerificationRequiredBanner"
import { GlassCard } from "@/components/ui/GlassCard"
import { Button } from "@/components/ui/button"
import { BadgeCheck, Plus, ArrowRight } from "lucide-react"
import { useIndexData } from "@/hooks/use-index-data"
import { AuthSummaryBanner } from "@/pages/index/AuthSummaryBanner"
import { HeroSection } from "@/pages/index/HeroSection"
import { TrustStatsSection } from "@/pages/index/TrustStatsSection"
import { HowItWorksSection } from "@/pages/index/HowItWorksSection"
import { CategoriesSection } from "@/pages/index/CategoriesSection"
import { WhyRentySection } from "@/pages/index/WhyRentySection"
import { RecentlyViewedSection } from "@/pages/index/RecentlyViewedSection"
import { NewestListingsSection } from "@/pages/index/NewestListingsSection"
import { TestimonialsSection } from "@/pages/index/TestimonialsSection"
import { OwnerCTASection } from "@/pages/index/OwnerCTASection"
import { AppDownloadSection } from "@/pages/index/AppDownloadSection"

const Index = () => {
  const navigate = useNavigate()
  useKeyboardShortcuts()

  const {
    user,
    profile,
    authLoading,
    featuredItems,
    loading,
    categories,
    totalItemCount,
    authSummary,
    trustStats,
    statsLoading,
    recentlyViewed,
  } = useIndexData()

  const isLoading = loading || authLoading
  const isNewUser = user && authSummary && authSummary.listedItemCount === 0
  const canRenderAuthSections = user && !authLoading && authSummary !== null

  return (
    <div className="min-h-screen pb-mobile-nav">
      <SEO
        title={user ? `Renty — Welcome${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}` : "Renty — Rent Anything in Malaysia"}
        description={`Trusted peer-to-peer rentals. ${totalItemCount || 'Hundreds of'} verified items from cameras to cars. Request, approve, pick up.`}
      />
      <Header />

      {canRenderAuthSections && (
        <AuthSummaryBanner
          authSummary={authSummary}
          fullName={profile?.full_name}
          onNavigate={navigate}
        />
      )}

      {canRenderAuthSections && (
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <VerificationRequiredBanner isVerified={profile?.is_verified || false} />
        </div>
      )}

      {isNewUser && (
        <section className="mx-auto max-w-6xl px-4 pt-4">
          <GlassCard variant="elevated" padding="lg" className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8">
              <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
                <BadgeCheck className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg md:text-xl font-bold mb-1">Start your first rental</h3>
                <p className="text-sm text-muted-foreground">
                  List an item and earn money from things you already own. It takes less than 5 minutes.
                </p>
              </div>
              <Button onClick={() => navigate('/list-item')} size="lg" variant="default" className="gap-2 shrink-0 w-full md:w-auto">
                <Plus className="h-5 w-5" />
                List an item
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </GlassCard>
        </section>
      )}

      <HeroSection
        totalItemCount={totalItemCount}
        user={user}
        onSearch={() => navigate('/search')}
        onListOrAuth={() => navigate(user ? '/list-item' : '/auth')}
      />

      {(!statsLoading && trustStats) && (
        <TrustStatsSection stats={trustStats} />
      )}

      <HowItWorksSection />

      {(categories.length > 0 || isLoading) && (
        <CategoriesSection categories={categories} isLoading={isLoading} onNavigate={navigate} />
      )}

      <WhyRentySection />

      {recentlyViewed.length > 0 && (
        <RecentlyViewedSection items={recentlyViewed} onNavigate={navigate} />
      )}

      <NewestListingsSection items={featuredItems} isLoading={isLoading} onNavigate={navigate} />

      <TestimonialsSection />

      {(!user || (authSummary && authSummary.listedItemCount === 0)) && !isLoading && (
        <OwnerCTASection onNavigate={navigate} />
      )}

      <AppDownloadSection onNavigate={navigate} />

      <Footer />
    </div>
  )
}

export default Index
