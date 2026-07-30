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

const CATEGORY_GRADIENTS: Record<string, string> = {
  electronics: "from-blue-500/10 via-blue-500/5 to-transparent",
  vehicles: "from-amber-500/10 via-amber-500/5 to-transparent",
  tools: "from-emerald-500/10 via-emerald-500/5 to-transparent",
  sports: "from-rose-500/10 via-rose-500/5 to-transparent",
  party: "from-violet-500/10 via-violet-500/5 to-transparent",
  fashion: "from-cyan-500/10 via-cyan-500/5 to-transparent",
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 md:gap-5">
            {categories.map((cat, i) => {
              const Icon = CATEGORY_ICONS[cat.name.toLowerCase()] || Package
              const displayName = cat.name.charAt(0).toUpperCase() + cat.name.slice(1)
              const gradient = CATEGORY_GRADIENTS[cat.name.toLowerCase()] || "from-primary/5 to-transparent"
              const isEmphasized = i === 0

              return (
                <motion.button
                  key={cat.name}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.4, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => onNavigate(`/search?category=${cat.name.toLowerCase()}`)}
                  className={`relative text-left rounded-xl glass hover:glass-elevated transition-all duration-200 active:scale-[0.98] ${
                    isEmphasized
                      ? "md:col-span-2 md:row-span-1 p-5 md:p-6"
                      : "p-4 md:p-5"
                  }`}
                >
                  <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${gradient} opacity-60`} />
                  <div className="relative">
                    <div className={`${isEmphasized ? "w-12 h-12 md:w-14 md:h-14" : "w-10 h-10"} rounded-xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-3`}>
                      <Icon className={`${isEmphasized ? "h-6 w-6" : "h-5 w-5"} text-primary`} />
                    </div>
                    <h3 className={`font-medium text-foreground ${isEmphasized ? "text-base md:text-lg" : "text-sm"}`}>{displayName}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{cat.count} items</p>
                  </div>
                </motion.button>
              )
            })}
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 md:gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <SkeletonV2 variant="circular" className="w-10 h-10 mb-3" />
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