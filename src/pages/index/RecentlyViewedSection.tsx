import { Button } from "@/components/ui/button"
import { ListingCard } from "@/components/ListingCard"
import { useTranslation } from 'react-i18next'

interface RecentlyViewedItem {
  id: string
  title: string
  image: string
  pricePerDay: number
  category: string
  location: string
}

interface RecentlyViewedSectionProps {
  items: RecentlyViewedItem[]
  onNavigate: (path: string) => void
}

export function RecentlyViewedSection({ items, onNavigate }: RecentlyViewedSectionProps) {
  const { t } = useTranslation()
  return (
    <section className="px-4 py-10 md:py-16">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">{t('home.recentlyViewed.title')}</h2>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('/search')}>
            {t('home.recentlyViewed.viewAll')}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4 md:gap-5 lg:grid-cols-4 xl:grid-cols-5">
          {items.slice(0, 10).map(item => (
            <ListingCard
              key={item.id}
              id={item.id}
              title={item.title}
              image={item.image}
              pricePerDay={item.pricePerDay}
              category={item.category}
              location={item.location}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
