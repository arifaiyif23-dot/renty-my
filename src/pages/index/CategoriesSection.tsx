import { useTranslation } from 'react-i18next'
import { Button } from "@/components/ui/button"
import { CategoryCard } from "@/components/marketplace/CategoryCard"
import { SkeletonV2 } from "@/components/SkeletonV2"
import { ChevronRight, Smartphone, Car, Wrench, Dumbbell, Music, Shirt, Package } from "lucide-react"
import type { RawCategory } from "@/hooks/use-index-data"

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  electronics: Smartphone,
  vehicles: Car,
  tools: Wrench,
  sports: Dumbbell,
  party: Music,
  fashion: Shirt,
}

interface CategoriesSectionProps {
  categories: RawCategory[]
  isLoading: boolean
  onNavigate: (path: string) => void
}

export function CategoriesSection({ categories, isLoading, onNavigate }: CategoriesSectionProps) {
  const { t } = useTranslation()
  return (
    <section className="px-4 py-10 md:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">{t('home.categories.title')}</h2>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('/search')} className="gap-1">
            {t('home.categories.viewAll')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {categories.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 md:grid-cols-6">
            {categories.map(cat => {
              const Icon = CATEGORY_ICONS[cat.name.toLowerCase()] || Package
              const displayName = cat.name.charAt(0).toUpperCase() + cat.name.slice(1)
              return (
                <CategoryCard
                  key={cat.name}
                  icon={Icon}
                  name={displayName}
                  count={cat.count}
                  onClick={() => onNavigate(`/search?category=${cat.name.toLowerCase()}`)}
                />
              )
            })}
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 md:grid-cols-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="surface-default p-4 text-center">
                <SkeletonV2 variant="circular" className="w-10 h-10 mx-auto mb-2" />
                <SkeletonV2 variant="text" className="h-3 w-2/3 mx-auto" />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
