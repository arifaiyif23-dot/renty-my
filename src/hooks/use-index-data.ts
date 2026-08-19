import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { getRecentlyViewed } from "@/hooks/use-recently-viewed"

export interface FeaturedItem {
  id: string
  title: string
  image: string
  pricePerDay: number
  category: string
  rating: number
  reviewCount: number
  location: string
  verificationLevel?: string
}

export interface RawCategory {
  name: string
  count: number
  minPrice: number
}

export interface AuthSummary {
  activeRentals: number
  pendingRequests: number
  unreadMessages: number
  myListingsCount: number
  listedItemCount: number
}

export interface TrustStats {
  totalItems: number
  totalUsers: number
  completedRentals: number
  avgRating: number
  reviewCount: number
}

export function useIndexData() {
  const { user, profile, loading: authLoading } = useAuth()
  const [featuredItems, setFeaturedItems] = useState<FeaturedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<RawCategory[]>([])
  const [totalItemCount, setTotalItemCount] = useState<number>(0)
  const [authSummary, setAuthSummary] = useState<AuthSummary | null>(null)
  const [trustStats, setTrustStats] = useState<TrustStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const recentlyViewed = useMemo(() => getRecentlyViewed(), [])

  useEffect(() => {
    fetchData()
    fetchTrustStats()
  }, [])

  useEffect(() => {
    if (user && !authLoading) {
      fetchAuthSummary()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading])

  const fetchAuthSummary = async () => {
    if (!user) return
    try {
      const userId = user.id
      const [{ count: unreadCount }, { count: activeCount }, { count: pendingCount }, { count: myListings }] = await Promise.all([
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('recipient_id', userId).eq('is_read', false),
        supabase.from('rentals').select('*', { count: 'exact', head: true }).or(`renter_id.eq.${userId},owner_id.eq.${userId}`).in('status', ['paid', 'active']),
        supabase.from('rentals').select('*', { count: 'exact', head: true }).or(`renter_id.eq.${userId},owner_id.eq.${userId}`).in('status', ['requested', 'reserved']),
        supabase.from('items').select('*', { count: 'exact', head: true }).eq('owner_id', userId),
      ])
      setAuthSummary({
        unreadMessages: unreadCount || 0,
        activeRentals: activeCount || 0,
        pendingRequests: pendingCount || 0,
        myListingsCount: myListings || 0,
        listedItemCount: myListings || 0,
      })
    } catch {
      console.error('Failed to fetch auth summary')
    }
  }

  const fetchTrustStats = async () => {
    try {
      const [itemsResult, usersResult, rentalsResult, reviewsResult] = await Promise.all([
        supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'available'),
supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_verified', true),
        supabase.from('rentals').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('reviews').select('rating'),
      ])
      const allRatings = reviewsResult.data || []
      const totalRating = allRatings.reduce((sum, r) => sum + r.rating, 0)
      const avgRating = allRatings.length > 0 ? totalRating / allRatings.length : 0
      setTrustStats({
        totalItems: itemsResult.count || 0,
        totalUsers: usersResult.count || 0,
        completedRentals: rentalsResult.count || 0,
        avgRating: Math.round(avgRating * 10) / 10,
        reviewCount: allRatings.length,
      })
    } catch {
      console.error('Failed to fetch trust stats')
      setTrustStats({ totalItems: 0, totalUsers: 0, completedRentals: 0, avgRating: 0, reviewCount: 0 })
    } finally {
      setStatsLoading(false)
    }
  }

  const fetchData = async () => {
    try {
      const [itemsResult, categoryResult, countResult] = await Promise.all([
        supabase
          .from('items')
          .select(`
            id, title, price_per_day, category, location, created_at, owner_id,
            item_images(image_url),
            profiles!items_owner_id_fkey(is_verified, verification_level)
          `)
          .eq('status', 'available')
          .order('created_at', { ascending: false })
          .limit(6),
        supabase.from('items').select('category, price_per_day').eq('status', 'available').limit(5000),
        supabase.from('items').select('*', { count: 'exact', head: true }).eq('status', 'available'),
      ])

      if (countResult.count !== null) setTotalItemCount(countResult.count)
      if (itemsResult.error) throw itemsResult.error

      const itemsData = itemsResult.data
      const itemIds = itemsData?.map(i => i.id) || []
      const { data: allReviews } = await supabase
        .from('rentals')
        .select('item_id, reviews(rating)')
        .in('item_id', itemIds)

      const reviewsByItem = new Map<string, number[]>()
      allReviews?.forEach((rental: { item_id: string; reviews: { rating: number }[] }) => {
        if (rental.reviews?.length) {
          const existing = reviewsByItem.get(rental.item_id) || []
          reviewsByItem.set(rental.item_id, [...existing, ...rental.reviews.map(r => r.rating)])
        }
      })

      const itemsWithReviews: FeaturedItem[] = (itemsData || []).map(item => {
        const ratings = reviewsByItem.get(item.id) || []
        const reviewCount = ratings.length
        const rating = reviewCount > 0 ? ratings.reduce((s, r) => s + r, 0) / reviewCount : 0
        return {
          id: item.id,
          title: item.title,
          image: (item.item_images ?? [])[0]?.image_url || '',
          pricePerDay: Number(item.price_per_day),
          category: item.category,
          rating: Math.round(rating * 10) / 10,
          reviewCount,
          location: item.location,
          verificationLevel: item.profiles?.verification_level,
        }
      })
      setFeaturedItems(itemsWithReviews)

      if (categoryResult.error) throw categoryResult.error
      const catMap = new Map<string, { count: number; minPrice: number }>()
      ;(categoryResult.data || []).forEach(it => {
        const existing = catMap.get(it.category)
        const price = Number(it.price_per_day)
        if (existing) {
          existing.count++
          existing.minPrice = Math.min(existing.minPrice, price)
        } else {
          catMap.set(it.category, { count: 1, minPrice: price })
        }
      })
      setCategories(Array.from(catMap.entries()).map(([name, data]) => ({
        name,
        count: data.count,
        minPrice: Math.round(data.minPrice),
      })))
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load listings. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return {
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
  }
}
