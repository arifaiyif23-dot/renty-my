import { Smartphone, Car, Wrench, Dumbbell, Music, Shirt, Package } from "lucide-react"
import { cn } from "@/lib/utils"
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
  return (
    <section className="px-4 py-10 md:py-16">
      <div className="mx-auto max-w-7xl">
        {categories.length > 0 ? (
          <div className="flex overflow-x-auto gap-6 pb-2 -mx-4 px-4 scrollbar-none">
            {categories.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.name.toLowerCase()] || Package
              const displayName = cat.name.charAt(0).toUpperCase() + cat.name.slice(1)
              const isActive = false

              return (
                <button
                  key={cat.name}
                  onClick={() => onNavigate(`/search?category=${cat.name.toLowerCase()}`)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 shrink-0 min-w-[64px] transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-[11px] font-medium whitespace-nowrap">{displayName}</span>
                </button>
              )
            })}
          </div>
        ) : isLoading ? (
          <div className="flex gap-6 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 shrink-0 min-w-[64px]">
                <div className="w-6 h-6 rounded-full bg-muted animate-shimmer" />
                <div className="w-10 h-2 rounded bg-muted animate-shimmer" />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
