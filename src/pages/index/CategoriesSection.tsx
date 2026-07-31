import { useTranslation } from 'react-i18next'
import { Button } from "@/components/ui/button"
import { SkeletonV2 } from "@/components/SkeletonV2"
import { ChevronRight, Smartphone, Car, Wrench, Dumbbell, Music, Shirt, Package } from "lucide-react"
import { motion } from "motion/react"
import type { RawCategory } from "@/hooks/use-index-data"

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  electronics: Smartphone,
  vehicles: Car,
  tools: Wrench,
  sports: Dumbbell,
  party: Music,
  fashion: Shirt,
}

const CATEGORY_GLASS_COLORS: Record<string, string> = {
  electronics: "before:bg-primary/10",
  vehicles: "before:bg-warning/10",
  tools: "before:bg-success/10",
  sports: "before:bg-destructive/10",
  party: "before:bg-action/10",
  fashion: "before:bg-secondary/10",
}

const CATEGORY_LIGHTING: Record<string, string> = {
  electronics: "from-primary/20 via-transparent to-transparent",
  vehicles: "from-warning/20 via-transparent to-transparent",
  tools: "from-success/20 via-transparent to-transparent",
  sports: "from-destructive/20 via-transparent to-transparent",
  party: "from-action/20 via-transparent to-transparent",
  fashion: "from-secondary/20 via-transparent to-transparent",
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
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">{t('home.categories.title')}</h2>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('/search')} className="gap-1">
            {t('home.categories.viewAll')}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {categories.length > 0 ? (
          <>
            {/* Mobile: horizontal scroll */}
            <div className="flex md:hidden overflow-x-auto snap-x snap-mandatory gap-3 pb-2 -mx-4 px-4 scrollbar-none">
              {categories.map((cat, i) => {
                const Icon = CATEGORY_ICONS[cat.name.toLowerCase()] || Package
                const displayName = cat.name.charAt(0).toUpperCase() + cat.name.slice(1)
                const glassColor = CATEGORY_GLASS_COLORS[cat.name.toLowerCase()] || "before:bg-primary/10"
                const lighting = CATEGORY_LIGHTING[cat.name.toLowerCase()] || "from-primary/20 via-transparent to-transparent"

                return (
                  <motion.button
                    key={cat.name}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.4, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                    onClick={() => onNavigate(`/search?category=${cat.name.toLowerCase()}`)}
                    className="snap-start shrink-0 w-[140px] relative overflow-hidden rounded-2xl glass-elevated hover-lift active:scale-[0.98] transition-all duration-300 p-5 text-left"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${lighting} opacity-60 pointer-events-none`} />
                    <div className={`absolute -inset-2 rounded-full opacity-20 blur-2xl ${glassColor} pointer-events-none`} />
                    <div className="relative">
                      <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center mb-3 ring-1 ring-border/50">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="font-medium text-sm text-foreground">{displayName}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{cat.count} items</p>
                    </div>
                  </motion.button>
                )
              })}
            </div>

            {/* Desktop: grid */}
            <div className="hidden md:grid grid-cols-3 lg:grid-cols-6 gap-4 md:gap-5">
              {categories.map((cat, i) => {
                const Icon = CATEGORY_ICONS[cat.name.toLowerCase()] || Package
                const displayName = cat.name.charAt(0).toUpperCase() + cat.name.slice(1)
                const glassColor = CATEGORY_GLASS_COLORS[cat.name.toLowerCase()] || "before:bg-primary/10"
                const lighting = CATEGORY_LIGHTING[cat.name.toLowerCase()] || "from-primary/20 via-transparent to-transparent"

                return (
                  <motion.button
                    key={cat.name}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.4, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                    onClick={() => onNavigate(`/search?category=${cat.name.toLowerCase()}`)}
                    className="relative overflow-hidden rounded-2xl glass-elevated hover-lift active:scale-[0.98] transition-all duration-300 p-5 text-left"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${lighting} opacity-60 pointer-events-none`} />
                    <div className={`absolute -inset-2 rounded-full opacity-20 blur-2xl ${glassColor} pointer-events-none`} />
                    <div className="relative">
                      <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center mb-3 ring-1 ring-border/50">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="font-medium text-sm text-foreground">{displayName}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{cat.count} items</p>
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </>
        ) : isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 md:gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl glass-elevated p-5">
                <SkeletonV2 variant="circular" className="w-12 h-12 mb-3" />
                <SkeletonV2 variant="text" className="h-3 w-2/3 mb-1" />
                <SkeletonV2 variant="text" className="h-2 w-1/3" />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
