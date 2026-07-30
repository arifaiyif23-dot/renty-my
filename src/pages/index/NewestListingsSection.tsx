import { Button } from "@/components/ui/button"
import { ListingCard } from "@/components/ListingCard"
import { SkeletonV2 } from "@/components/SkeletonV2"
import { EmptyStateV2 } from "@/components/EmptyStateV2"
import { SearchSlash } from "lucide-react"
import { motion } from "motion/react"
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
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">{t('home.newestListings.title')}</h2>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('/search')}>
            {t('home.newestListings.viewAll')}
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:gap-4 md:gap-5 lg:grid-cols-4 xl:grid-cols-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-xl overflow-hidden border border-border">
                <SkeletonV2 variant="rectangular" className="aspect-golden" />
                <div className="p-4 space-y-3">
                  <SkeletonV2 variant="text" className="h-4 w-3/4" />
                  <SkeletonV2 variant="text" className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:gap-4 md:gap-5 lg:grid-cols-4 xl:grid-cols-5">
            {items.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.4, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
              >
                <ListingCard
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
              </motion.div>
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