import { useNavigate } from "react-router-dom"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { PageLayout } from "@/components/PageLayout"
import SEO from "@/components/SEO"
import { useIndexData } from "@/hooks/use-index-data"
import { HeroSection } from "@/pages/index/HeroSection"
import { CategoriesSection } from "@/pages/index/CategoriesSection"
import { NewestListingsSection } from "@/pages/index/NewestListingsSection"

const Index = () => {
  const navigate = useNavigate()
  useKeyboardShortcuts()

  const {
    user,
    featuredItems,
    loading,
    categories,
    totalItemCount,
  } = useIndexData()

  const isLoading = loading

  return (
    <PageLayout variant="full" className="pb-0">
      <SEO
        title={user ? "Renty" : "Renty — Rent Anything in Malaysia"}
        description={`Trusted peer-to-peer rentals. ${totalItemCount || 'Hundreds of'} verified items from cameras to cars.`}
      />

      <HeroSection
        totalItemCount={totalItemCount}
        onSearch={() => navigate('/search')}
        onListOrAuth={() => navigate(user ? '/list-item' : '/auth')}
      />

      {(categories.length > 0 || isLoading) && (
        <CategoriesSection categories={categories} isLoading={isLoading} onNavigate={navigate} />
      )}

      <NewestListingsSection items={featuredItems} isLoading={isLoading} onNavigate={navigate} />
    </PageLayout>
  )
}

export default Index
