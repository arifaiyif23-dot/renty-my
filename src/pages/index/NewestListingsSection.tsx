import { Button } from "@/components/ui/button"
import { ListingCardV2 } from "@/components/marketplace/ListingCardV2"
import { SkeletonV2 } from "@/components/SkeletonV2"
import { EmptyStateV2 } from "@/components/EmptyStateV2"
import { SearchSlash } from "lucide-react"
import type { FeaturedItem } from "@/hooks/use-index-data"
import { useTranslation } from 'react-i18next'

interface NewestListingsSectionProps {
  items: FeaturedItem[]
  isLoading: boolean
  onNavigate: (path: string) => void
}

export function NewestListingsSection({ items, isLoading, onNavigate }: NewestListingsSectionProps) {
  const { t } = useTranslation()
  return (
    <section className="px-4 py-10 md:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">{t('home.newestListings.title')}</h2>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('/search')}>
            {t('home.newestListings.viewAll')}
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 md:gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden border border-border">
                <SkeletonV2 variant="rectangular" className="aspect-[4/3]" />
                <div className="p-4 space-y-3">
                  <SkeletonV2 variant="text" className="h-4 w-3/4" />
                  <SkeletonV2 variant="text" className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 md:gap-5">
            {items.map(item => (
              <ListingCardV2
                key={item.id}
                id={item.id}
                title={item.title}
                image={item.image}
                pricePerDay={item.pricePerDay}
                category={item.category}
                location={item.location}
                rating={item.rating}
                reviewCount={item.reviewCount}
                badges={item.verificationLevel && item.verificationLevel !== 'unverified' ? ['verified'] : undefined}
              />
            ))}
          </div>
        ) : (
          <EmptyStateV2
            icon={SearchSlash}
            title={t('home.newestListings.noListings')}
            description={t('home.newestListings.noListingsDesc')}
            actionLabel={t('home.newestListings.listItem')}
            onAction={() => onNavigate('/list-item')}
          />
        )}
      </div>
    </section>
  )
}
