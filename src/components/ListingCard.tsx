import { memo, useMemo } from "react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { MapPin, Star } from "lucide-react"
import { UserTrustBadge } from "@/components/trust/UserTrustBadge"
import { SaveItemButton } from "@/components/SaveItemButton"
import { getOptimizedImageUrl, getSrcSet } from "@/utils/imageOptimization"
import type { VerificationLevel } from "@/types"

interface ListingCardProps {
  id: string
  title: string
  image: string
  pricePerDay: number
  category: string
  rating?: number
  reviewCount?: number
  location: string
  distance?: number
  verificationLevel?: VerificationLevel
  badge?: "trending" | "just-listed" | "available"
}

export const ListingCard = memo(({
  id,
  title,
  image,
  pricePerDay,
  category,
  rating = 0,
  reviewCount = 0,
  location,
  distance,
  verificationLevel,
  badge,
}: ListingCardProps) => {
  const badgeConfig = useMemo(() => {
    switch (badge) {
      case "trending":
        return { text: "Trending", variant: "default" as const }
      case "just-listed":
        return { text: "Just Listed", variant: "secondary" as const }
      case "available":
        return { text: "Available Now", variant: "default" as const }
      default:
        return null
    }
  }, [badge])

  const optimizedImage = useMemo(
    () => getOptimizedImageUrl(image, { width: 800, quality: 80 }),
    [image]
  )

  return (
    <Link to={`/items/${id}`} aria-label={`View details for ${title}`} className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl">
      <div className="transition-all duration-200 hover:-translate-y-0.5">
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-muted">
          <img
            src={optimizedImage}
            srcSet={getSrcSet(image)}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            alt={`${title} - ${category} available for rent in ${location}`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            loading="lazy"
            decoding="async"
          />

          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />

          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {badgeConfig && (
              <Badge variant={badgeConfig.variant} className="shadow-sm backdrop-blur-sm border-0">
                {badgeConfig.text}
              </Badge>
            )}
            <Badge variant="secondary" className="shadow-sm backdrop-blur-sm border-0 capitalize">
              {category}
            </Badge>
          </div>

          <div className="absolute top-2 right-2">
            <SaveItemButton itemId={id} />
          </div>
        </div>

        {/* Content */}
        <div className="mt-2 md:mt-3 space-y-1">
          {/* Location + Rating */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 min-w-0 text-sm text-muted-foreground">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{location}</span>
              {distance !== undefined && (
                <span className="tabular-nums whitespace-nowrap shrink-0">· {distance} km</span>
              )}
            </div>
            {rating > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="text-sm font-semibold tabular-nums">{rating.toFixed(1)}</span>
                {reviewCount > 0 && (
                  <span className="text-sm text-muted-foreground">({reviewCount})</span>
                )}
              </div>
            )}
          </div>

          {/* Title */}
          <h3 className="font-medium text-base leading-snug line-clamp-2 text-foreground">
            {title}
          </h3>

          {/* Trust signals */}
          <div className="flex items-center gap-2 flex-wrap min-h-[1.25rem]">
            {verificationLevel && verificationLevel !== 'unverified' ? (
              <UserTrustBadge level={verificationLevel} size="sm" />
            ) : (
              <span className="text-xs text-muted-foreground">New</span>
            )}
          </div>

          {/* Price */}
          <div className="pt-1">
            <span className="text-base md:text-lg font-bold tabular-nums text-foreground">
              RM{pricePerDay}
            </span>
            <span className="text-sm text-muted-foreground"> / day</span>
            <div className="flex gap-2 text-xs text-muted-foreground mt-0.5">
              <span>RM{Math.round(pricePerDay * 7 * 0.9)}/wk</span>
              <span>RM{Math.round(pricePerDay * 30 * 0.8)}/mo</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
})

ListingCard.displayName = "ListingCard"
