import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import Header from "@/components/Header"
import SearchBar from "@/components/SearchBar"
import { AnimatedCategoryIcon } from "@/components/AnimatedCategoryIcon"
import { ListingCard } from "@/components/ListingCard"
import SkeletonCard from "@/components/SkeletonCard"
import EnhancedEmptyState from "@/components/EnhancedEmptyState"
import { VerificationRequiredBanner } from "@/components/VerificationRequiredBanner"
import SEO from "@/components/SEO"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  Package, Car, Smartphone, Dumbbell, Music, Wrench, Shirt,
  LayoutDashboard, Clock, MessageCircle, TrendingUp, Plus, ArrowRight,
  BadgeCheck
} from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useAuth } from "@/contexts/AuthContext"
import { getRecentlyViewed } from "@/hooks/use-recently-viewed"

interface FeaturedItem {
  id: string
  title: string
  image: string
  pricePerDay: number
  category: string
  rating: number
  reviewCount: number
  location: string
  isOwnerVerified?: boolean
}

interface Category {
  name: string
  icon: React.ComponentType<{ className?: string }>
  count: number
  minPrice?: number
}

interface AuthSummary {
  activeRentals: number
  pendingRequests: number
  unreadMessages: number
  myListingsCount: number
  listedItemCount: number
}

const Index = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()
  useKeyboardShortcuts()

  const [featuredItems, setFeaturedItems] = useState<FeaturedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [totalItemCount, setTotalItemCount] = useState<number>(0)
  const [authSummary, setAuthSummary] = useState<AuthSummary | null>(null)

  const recentlyViewed = useMemo(() => getRecentlyViewed(), [])

  const categoryConfig = useMemo(() => ({
    electronics: { icon: Smartphone, displayName: "Electronics" },
    vehicles:    { icon: Car,        displayName: "Vehicles" },
    tools:       { icon: Wrench,     displayName: "Tools" },
    sports:      { icon: Dumbbell,   displayName: "Sports" },
    party:       { icon: Music,      displayName: "Party" },
    fashion:     { icon: Shirt,      displayName: "Fashion" },
    other:       { icon: Package,    displayName: "Other" },
  }), [])

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (user && !authLoading) {
      fetchAuthSummary()
    }
  }, [user, authLoading])

  const fetchAuthSummary = async () => {
    if (!user) return
    try {
      const userId = user.id

      const [{ count: unreadCount }, { count: activeCount }, { count: pendingCount }, { count: myListings }] = await Promise.all([
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('recipient_id', userId).eq('is_read', false),
        supabase.from('rentals').select('*', { count: 'exact', head: true }).or(`renter_id.eq.${userId},owner_id.eq.${userId}`).in('status', ['paid', 'active']),
        supabase.from('rentals').select('*', { count: 'exact', head: true }).or(`renter_id.eq.${userId},owner_id.eq.${userId}`).in('status', ['pending_approval', 'approved']),
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

  const fetchData = async () => {
    try {
      const [itemsResult, categoryResult, countResult] = await Promise.all([
        supabase
          .from('items')
          .select(`
            id, title, price_per_day, category, location, created_at, owner_id,
            item_images!inner(image_url),
            profiles!items_owner_id_fkey(is_verified)
          `)
          .eq('is_available', true)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase.from('items').select('category, price_per_day').eq('is_available', true),
        supabase.from('items').select('*', { count: 'exact', head: true }).eq('is_available', true),
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
      allReviews?.forEach((rental: any) => {
        if (rental.reviews?.length) {
          const existing = reviewsByItem.get(rental.item_id) || []
          reviewsByItem.set(rental.item_id, [...existing, ...rental.reviews.map((r: any) => r.rating)])
        }
      })

      const itemsWithReviews = (itemsData || []).map((item) => {
        const ratings = reviewsByItem.get(item.id) || []
        const reviewCount = ratings.length
        const rating = reviewCount > 0 ? ratings.reduce((s, r) => s + r, 0) / reviewCount : 0
        return {
          id: item.id,
          title: item.title,
          image: (item.item_images ?? [])[0]?.image_url || 'https://images.unsplash.com/photo-1580674285054-bed31e145f59?w=800&q=80',
          pricePerDay: Number(item.price_per_day),
          category: item.category,
          rating: Math.round(rating * 10) / 10,
          reviewCount,
          location: item.location,
          isOwnerVerified: item.profiles?.is_verified || false,
        }
      })
      setFeaturedItems(itemsWithReviews)

      if (categoryResult.error) throw categoryResult.error
      const categoryMap = new Map<string, { count: number; minPrice: number }>()
      ;(categoryResult.data || []).forEach((it) => {
        const existing = categoryMap.get(it.category)
        const price = Number(it.price_per_day)
        if (existing) {
          existing.count++
          existing.minPrice = Math.min(existing.minPrice, price)
        } else {
          categoryMap.set(it.category, { count: 1, minPrice: price })
        }
      })
      const categoryData: Category[] = Array.from(categoryMap.entries()).map(([name, data]) => {
        const config = categoryConfig[name.toLowerCase()] || { icon: Package, displayName: name }
        return {
          name: config.displayName,
          icon: config.icon,
          count: data.count,
          minPrice: Math.round(data.minPrice),
        }
      })
      setCategories(categoryData)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load listings. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isLoading = loading || authLoading
  const isNewUser = user && authSummary && authSummary.listedItemCount === 0
  const canRenderAuthSections = user && !authLoading && authSummary !== null

  return (
    <div className="min-h-screen pb-mobile-nav">
      <SEO
        title={user ? `Renty — Welcome${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}` : "Renty — Rent Anything in Malaysia"}
        description={`Trusted peer-to-peer rentals. ${totalItemCount || 'Hundreds of'} verified items from cameras to cars. Request, approve, pick up.`}
      />
      <Header />

      {/* ── Auth Summary Banner ── */}
      {canRenderAuthSections && (
        <section className="bg-gradient-to-b from-primary/5 to-transparent border-b border-primary/10">
          <div className="mx-auto max-w-6xl px-4 py-4 md:py-6">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Welcome back</p>
                <h2 className="text-lg md:text-xl font-bold tracking-tight">
                  {profile?.full_name?.split(' ')[0] || 'there'}
                </h2>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')} className="gap-2">
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-background/80 border-primary/10 cursor-pointer hover:bg-background transition-colors" onClick={() => navigate('/dashboard')}>
                <CardContent className="p-3 md:p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Active</p>
                    <p className="text-lg md:text-xl font-bold tabular-nums">{authSummary.activeRentals}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-background/80 border-primary/10 cursor-pointer hover:bg-background transition-colors" onClick={() => navigate('/dashboard')}>
                <CardContent className="p-3 md:p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                    <MessageCircle className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Pending</p>
                    <p className="text-lg md:text-xl font-bold tabular-nums">{authSummary.pendingRequests}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-background/80 border-primary/10 cursor-pointer hover:bg-background transition-colors" onClick={() => navigate('/messages')}>
                <CardContent className="p-3 md:p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Messages</p>
                    <p className="text-lg md:text-xl font-bold tabular-nums">{authSummary.unreadMessages}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-background/80 border-primary/10 cursor-pointer hover:bg-background transition-colors" onClick={() => navigate('/my-listings')}>
                <CardContent className="p-3 md:p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-purple-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Listings</p>
                    <p className="text-lg md:text-xl font-bold tabular-nums">{authSummary.myListingsCount}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      )}

      {/* ── Verification Banner ── */}
      {canRenderAuthSections && (
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <VerificationRequiredBanner isVerified={profile?.is_verified || false} />
        </div>
      )}

      {/* ── Onboarding CTA for New Users ── */}
      {isNewUser && (
        <section className="mx-auto max-w-6xl px-4 pt-4">
          <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 overflow-hidden">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8">
                <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <BadgeCheck className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg md:text-xl font-bold mb-1">Start your first rental</h3>
                  <p className="text-sm text-muted-foreground">
                    List an item and earn money from things you already own. It takes less than 5 minutes.
                  </p>
                </div>
                <Button onClick={() => navigate('/list-item')} size="lg" className="gap-2 shrink-0 w-full md:w-auto">
                  <Plus className="h-5 w-5" />
                  List an item
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── Search Hero ── */}
      <section className="px-4 pt-8 md:pt-12 lg:pt-16 pb-8 md:pb-12">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-3 text-center text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
            Rent anything, from people nearby.
          </h1>
          <p className="mb-8 text-center text-base md:text-lg text-muted-foreground max-w-prose mx-auto">
            {totalItemCount > 0
              ? `${totalItemCount.toLocaleString()}+ verified items across Malaysia.`
              : 'Verified owners across Malaysia.'}
          </p>
          <SearchBar />
        </div>
      </section>

      {/* ── Categories ── */}
      {(categories.length > 0 || isLoading) && (
        <section className="px-4 py-8 md:py-12">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-6 text-xl md:text-2xl font-semibold tracking-tight">Browse categories</h2>
            {categories.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-6 md:grid-cols-6">
                {categories.map((category) => (
                  <AnimatedCategoryIcon
                    key={category.name}
                    icon={category.icon}
                    name={category.name}
                    count={category.count}
                    minPrice={category.minPrice}
                    onClick={() => navigate(`/search?category=${category.name.toLowerCase()}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-6 md:grid-cols-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="surface-1 rounded-lg p-4 text-center animate-pulse">
                    <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-muted" />
                    <div className="mx-auto h-3 w-2/3 rounded bg-muted" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Recently Viewed ── */}
      {recentlyViewed.length > 0 && (
        <section className="px-4 py-8 md:py-12">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 flex items-end justify-between">
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Continue browsing</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/search')}>
                View all
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {recentlyViewed.slice(0, 6).map((item) => (
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
      )}

      {/* ── Newest Listings ── */}
      <section className="px-4 py-8 md:py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Newest listings</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/search')}>
              View all
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
              {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : featuredItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
              {featuredItems.map((item) => (
                <ListingCard key={item.id} {...item} />
              ))}
            </div>
          ) : (
            <EnhancedEmptyState
              icon={Package}
              title="No listings yet"
              description="Be the first to list something for rent."
              actionLabel="List an item"
              onAction={() => navigate('/list-item')}
            />
          )}
        </div>
      </section>

      {/* ── Owner CTA ── */}
      {(!user || (authSummary && authSummary.listedItemCount === 0)) && !isLoading && (
        <section className="px-4 py-8 md:py-12 bg-gradient-to-t from-primary/5 to-transparent">
          <div className="mx-auto max-w-6xl">
            <Card className="border-primary/20">
              <CardContent className="p-6 md:p-8 md:flex md:items-center md:justify-between gap-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-2">
                    Earn money renting out your stuff
                  </h2>
                  <p className="text-muted-foreground max-w-lg">
                    Turn your idle items into income. List for free, set your price, and start earning.
                  </p>
                </div>
                <Button onClick={() => navigate('/list-item')} size="lg" className="gap-2 mt-4 md:mt-0 shrink-0 w-full md:w-auto">
                  <Plus className="h-5 w-5" />
                  Start earning
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      )}
    </div>
  )
}

export default Index
