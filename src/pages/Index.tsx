import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import Header from "@/components/Header"
import Footer from "@/components/Footer"
import { SearchBarV2 } from "@/components/SearchBarV2"
import { ListingCardV2 } from "@/components/marketplace/ListingCardV2"
import { CategoryCard } from "@/components/marketplace/CategoryCard"
import { TrustBadge } from "@/components/marketplace/TrustBadge"
import { SkeletonV2 } from "@/components/SkeletonV2"
import { EmptyStateV2 } from "@/components/EmptyStateV2"
import { GlassCard } from "@/components/ui/GlassCard"
import { VerificationRequiredBanner } from "@/components/VerificationRequiredBanner"
import SEO from "@/components/SEO"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  Package, Car, Smartphone, Dumbbell, Music, Wrench, Shirt,
  LayoutDashboard, Clock, MessageCircle, TrendingUp, Plus, ArrowRight,
  BadgeCheck, Search, LogIn, Users, Star, ShieldCheck,
  MapPin, Calendar, Handshake, Download, Smartphone as SmartphoneIcon,
  ChevronRight, Scale, Bell, SearchSlash
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
  verificationLevel?: string
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

interface TrustStats {
  totalItems: number
  totalUsers: number
  completedRentals: number
  avgRating: number
  reviewCount: number
}

interface Testimonial {
  name: string
  location: string
  avatar: string
  rating: number
  quote: string
}

const Index = () => {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()
  useKeyboardShortcuts()

  const [featuredItems, setFeaturedItems] = useState<FeaturedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Category[]>([])
  const [totalItemCount, setTotalItemCount] = useState<number>(0)
  const [authSummary, setAuthSummary] = useState<AuthSummary | null>(null)
  const [trustStats, setTrustStats] = useState<TrustStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

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

  const testimonials: Testimonial[] = [
    {
      name: "Aina Rahman",
      location: "Kuala Lumpur",
      avatar: "",
      rating: 5,
      quote: "Rented a camera lens for the weekend. The process was so smooth — found it, paid, and picked up within an hour. Will definitely use again!"
    },
    {
      name: "Rajesh Kumar",
      location: "Petaling Jaya",
      avatar: "",
      rating: 5,
      quote: "I was hesitant to rent out my drill at first, but the verification system gave me confidence. Earned RM150 in my first month!"
    },
    {
      name: "Sarah Tan",
      location: "Penang",
      avatar: "",
      rating: 5,
      quote: "Much cheaper than buying a pressure washer for one-time use. The owner was helpful and the equipment was in great condition."
    }
  ]

  useEffect(() => {
    fetchData()
    fetchTrustStats()
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const fetchTrustStats = async () => {
    try {
      const [itemsResult, usersResult, rentalsResult, reviewsResult] = await Promise.all([
        supabase.from('items').select('*', { count: 'exact', head: true }).eq('is_available', true),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
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
      setTrustStats({
        totalItems: 0,
        totalUsers: 0,
        completedRentals: 0,
        avgRating: 0,
        reviewCount: 0,
      })
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
            item_images!inner(image_url),
            profiles!items_owner_id_fkey(is_verified, verification_level)
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
      allReviews?.forEach((rental: { item_id: string; reviews: { rating: number }[] }) => {
        if (rental.reviews?.length) {
          const existing = reviewsByItem.get(rental.item_id) || []
          reviewsByItem.set(rental.item_id, [...existing, ...rental.reviews.map((r) => r.rating)])
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
          verificationLevel: item.profiles?.verification_level,
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

  const handleInstallApp = async () => {
    const w = window as unknown as { __deferred_prompt?: { prompt: () => void; userChoice: Promise<{ outcome: string }> } }
    const deferredPrompt = w.__deferred_prompt
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const result = await deferredPrompt.userChoice
      if (result.outcome === 'accepted') {
        toast.success('Renty installed!')
      }
    } else {
      navigate('/install')
    }
  }

  return (
    <div className="min-h-screen pb-mobile-nav">
      <SEO
        title={user ? `Renty — Welcome${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}` : "Renty — Rent Anything in Malaysia"}
        description={`Trusted peer-to-peer rentals. ${totalItemCount || 'Hundreds of'} verified items from cameras to cars. Request, approve, pick up.`}
      />
      <Header />

      {/* ── Auth Summary Banner ── */}
      {canRenderAuthSections && (
        <section className="bg-primary/5 border-b border-border">
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
              <GlassCard variant="interactive" padding="sm" className="cursor-pointer" onClick={() => navigate('/dashboard')}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Clock className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Active</p>
                    <p className="text-lg md:text-xl font-bold tabular-nums">{authSummary.activeRentals}</p>
                  </div>
                </div>
              </GlassCard>

              <GlassCard variant="interactive" padding="sm" className="cursor-pointer" onClick={() => navigate('/dashboard')}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <MessageCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Pending</p>
                    <p className="text-lg md:text-xl font-bold tabular-nums">{authSummary.pendingRequests}</p>
                  </div>
                </div>
              </GlassCard>

              <GlassCard variant="interactive" padding="sm" className="cursor-pointer" onClick={() => navigate('/messages')}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                    <TrendingUp className="h-5 w-5 text-success" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Messages</p>
                    <p className="text-lg md:text-xl font-bold tabular-nums">{authSummary.unreadMessages}</p>
                  </div>
                </div>
              </GlassCard>

              <GlassCard variant="interactive" padding="sm" className="cursor-pointer" onClick={() => navigate('/my-listings')}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Listings</p>
                    <p className="text-lg md:text-xl font-bold tabular-nums">{authSummary.myListingsCount}</p>
                  </div>
                </div>
              </GlassCard>
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
          <GlassCard variant="elevated" padding="lg" className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8">
              <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
                <BadgeCheck className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg md:text-xl font-bold mb-1">Start your first rental</h3>
                <p className="text-sm text-muted-foreground">
                  List an item and earn money from things you already own. It takes less than 5 minutes.
                </p>
              </div>
              <Button onClick={() => navigate('/list-item')} size="lg" variant="default" className="gap-2 shrink-0 w-full md:w-auto">
                <Plus className="h-5 w-5" />
                List an item
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </GlassCard>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
         HERO
         ═══════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/3 to-transparent pointer-events-none" />
        <div className="px-4 pt-16 md:pt-24 pb-12 md:pb-20 relative">
          <div className="mx-auto max-w-3xl text-center">
            <div className="flex items-center justify-center gap-2 mb-6">
              <TrustBadge kind="lokal" size="md" />
              <span className="text-xs text-muted-foreground font-medium">
                Malaysia's Trusted Rental Marketplace
              </span>
            </div>

            <h1 className="mb-5 text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-primary leading-[1.05]">
              Rent anything you need,<br />
              <span className="text-gradient-blue">from people nearby.</span>
            </h1>

            <p className="mb-8 text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Find cameras, tools, vehicles, and more — from verified owners near you.
              {totalItemCount > 0 && ` ${totalItemCount.toLocaleString()}+ items available across Malaysia.`}
            </p>

            <div className="max-w-xl mx-auto mb-8">
              <SearchBarV2 variant="hero" />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
              <Button onClick={() => navigate('/search')} size="lg" variant="brand" className="gap-2 w-full sm:w-auto min-w-[180px] rounded-2xl h-12">
                <Search className="h-5 w-5" />
                Browse items
              </Button>
              <Button onClick={() => navigate(user ? '/list-item' : '/auth')} size="lg" variant="outline" className="gap-2 w-full sm:w-auto min-w-[180px] rounded-2xl h-12 border-primary/20 hover:bg-primary/5">
                {user ? <Plus className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
                {user ? 'List your items' : 'Join for free'}
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-success" />
                Verified owners
              </span>
              <span className="inline-flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-brand-blue" />
                Secure payments
              </span>
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4 text-brand-blue" />
                Local pickup
              </span>
              <span className="inline-flex items-center gap-2">
                <Handshake className="h-4 w-4 text-primary" />
                Dijamin trust
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
         TRUST STATS
         ═══════════════════════════════════════════════════════════ */}
      {(!statsLoading && trustStats) && (
        <section className="px-4 py-8 md:py-12">
          <div className="mx-auto max-w-5xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <GlassCard variant="subtle" padding="md" className="text-center">
                <Package className="h-6 w-6 text-primary mx-auto mb-2" />
                <p className="text-2xl md:text-3xl font-bold tabular-nums text-foreground">{trustStats.totalItems.toLocaleString()}</p>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">Items Available</p>
              </GlassCard>

              <GlassCard variant="subtle" padding="md" className="text-center">
                <Users className="h-6 w-6 text-success mx-auto mb-2" />
                <p className="text-2xl md:text-3xl font-bold tabular-nums text-foreground">{trustStats.totalUsers.toLocaleString()}</p>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">Verified Members</p>
              </GlassCard>

              <GlassCard variant="subtle" padding="md" className="text-center">
                <Handshake className="h-6 w-6 text-primary mx-auto mb-2" />
                <p className="text-2xl md:text-3xl font-bold tabular-nums text-foreground">{trustStats.completedRentals.toLocaleString()}</p>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">Successful Rentals</p>
              </GlassCard>

              <GlassCard variant="subtle" padding="md" className="text-center">
                <Star className="h-6 w-6 text-amber-400 mx-auto mb-2" />
                <p className="text-2xl md:text-3xl font-bold tabular-nums text-foreground">
                  {trustStats.reviewCount > 0 ? trustStats.avgRating : '—'}
                </p>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">
                  {trustStats.reviewCount > 0 ? `Avg Rating (${trustStats.reviewCount})` : 'Avg Rating'}
                </p>
              </GlassCard>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
         HOW IT WORKS
         ═══════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="px-4 py-10 md:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-10 md:mb-14">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-primary mb-3">
              How it works
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Renting from your neighbors has never been easier
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            <GlassCard variant="subtle" padding="lg" className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary text-primary-foreground text-xs font-bold mb-3">1</div>
              <h3 className="text-lg font-semibold mb-2">Find what you need</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                Browse thousands of items from cameras to tools. Filter by location, category, and price.
              </p>
            </GlassCard>

            <GlassCard variant="subtle" padding="lg" className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-6 w-6 text-success" />
              </div>
              <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary text-primary-foreground text-xs font-bold mb-3">2</div>
              <h3 className="text-lg font-semibold mb-2">Book & pay securely</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                Send a request, agree on dates, and pay securely in-app. Your payment is protected.
              </p>
            </GlassCard>

            <GlassCard variant="subtle" padding="lg" className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Handshake className="h-6 w-6 text-primary" />
              </div>
              <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary text-primary-foreground text-xs font-bold mb-3">3</div>
              <h3 className="text-lg font-semibold mb-2">Pick up & enjoy</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                Meet the owner, inspect the item, and start using it. Return it when you're done.
              </p>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* ── Categories ── */}
      {(categories.length > 0 || isLoading) && (
        <section className="px-4 py-10 md:py-16">
          <div className="mx-auto max-w-6xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Browse categories</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/search')} className="gap-1">
                View all
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {categories.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 md:grid-cols-6">
                {categories.map((category) => (
                  <CategoryCard
                    key={category.name}
                    icon={category.icon}
                    name={category.name}
                    count={category.count}
                    onClick={() => navigate(`/search?category=${category.name.toLowerCase()}`)}
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 md:grid-cols-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="surface-default p-4 text-center">
                    <SkeletonV2 variant="circular" className="w-10 h-10 mx-auto mb-2" />
                    <SkeletonV2 variant="text" className="h-3 w-2/3 mx-auto" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
         WHY RENTY
         ═══════════════════════════════════════════════════════════ */}
      <section id="trust-safety" className="px-4 py-10 md:py-16 bg-muted/30">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-10 md:mb-14">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-primary mb-3">
              Why choose Renty?
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              We make peer-to-peer renting safe, simple, and rewarding
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            <GlassCard variant="interactive" padding="md">
              <ShieldCheck className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-1.5">Verified Identity</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Every owner is verified through our identity checks, so you know who you're renting from.
              </p>
            </GlassCard>

            <GlassCard variant="interactive" padding="md">
              <BadgeCheck className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-1.5">Secure Payment</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Pay in-app with our secure payment system. Funds are held safely until the rental is complete.
              </p>
            </GlassCard>

            <GlassCard variant="interactive" padding="md">
              <Scale className="h-8 w-8 text-success mb-3" />
              <h3 className="font-semibold mb-1.5">Dispute Protection</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Fair resolution process for both owners and renters. We're here to help if anything goes wrong.
              </p>
            </GlassCard>

            <GlassCard variant="interactive" padding="md">
              <MapPin className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-1.5">Local Pickup</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Meet nearby owners, inspect items in person, and avoid shipping fees. Rent local, save more.
              </p>
            </GlassCard>

            <GlassCard variant="interactive" padding="md">
              <Calendar className="h-8 w-8 text-primary mb-3" />
              <h3 className="font-semibold mb-1.5">Flexible Duration</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Rent by the day, weekend, or week. Only pay for the time you actually need.
              </p>
            </GlassCard>

            <GlassCard variant="interactive" padding="md">
              <Users className="h-8 w-8 text-success mb-3" />
              <h3 className="font-semibold mb-1.5">Community Driven</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Join Malaysia's growing rental community. Share, save money, and reduce waste together.
              </p>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* ── Recently Viewed ── */}
      {recentlyViewed.length > 0 && (
        <section className="px-4 py-10 md:py-16">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 flex items-end justify-between">
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Continue browsing</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/search')}>
                View all
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {recentlyViewed.slice(0, 6).map((item) => (
                <ListingCardV2
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
      <section className="px-4 py-10 md:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Newest listings</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/search')}>
              View all
            </Button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-5">
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
          ) : featuredItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-5">
              {featuredItems.map((item) => (
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
              title="No listings yet"
              description="Be the first to list something for rent."
              actionLabel="List an item"
              onAction={() => navigate('/list-item')}
            />
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
         TESTIMONIALS
         ═══════════════════════════════════════════════════════════ */}
      <section className="px-4 py-10 md:py-16 bg-muted/30">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-10 md:mb-14">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-primary mb-3">
              What our users say
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Real stories from the Renty community in Malaysia
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 md:gap-5">
            {testimonials.map((testimonial, i) => (
              <GlassCard key={i} variant="subtle" padding="lg">
                <div className="flex items-center gap-1 mb-3">
                  {[...Array(5)].map((_, s) => (
                    <Star
                      key={s}
                      className={`h-4 w-4 ${s < testimonial.rating ? 'text-amber-400 fill-amber-400' : 'text-muted'}`}
                    />
                  ))}
                </div>
                <blockquote className="text-sm text-foreground leading-relaxed mb-4">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {testimonial.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground">{testimonial.location}</p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── Owner CTA ── */}
      {(!user || (authSummary && authSummary.listedItemCount === 0)) && !isLoading && (
        <section className="px-4 py-10 md:py-16">
          <div className="mx-auto max-w-6xl">
            <GlassCard variant="elevated" padding="lg" className="bg-gradient-to-br from-primary/5 via-card to-primary/5 border-primary/10">
              <div className="md:flex md:items-center md:justify-between gap-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-2">
                    Earn money renting out your stuff
                  </h2>
                  <p className="text-muted-foreground max-w-lg">
                    Turn your idle items into income. List for free, set your price, and start earning.
                  </p>
                </div>
                <Button onClick={() => navigate('/list-item')} size="lg" variant="default" className="gap-2 mt-4 md:mt-0 shrink-0 w-full md:w-auto rounded-2xl h-12">
                  <Plus className="h-5 w-5" />
                  Start earning
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </GlassCard>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
         APP DOWNLOAD
         ═══════════════════════════════════════════════════════════ */}
      <section className="px-4 py-10 md:py-16">
        <div className="mx-auto max-w-5xl">
          <GlassCard variant="elevated" padding="lg" className="bg-gradient-to-br from-primary/5 via-card to-card overflow-hidden">
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
              <div className="shrink-0">
                <div className="relative w-48 h-80 md:w-56 md:h-96 bg-foreground rounded-[2rem] border-4 border-border shadow-3">
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-1.5 bg-border rounded-full" />
                  <div className="absolute inset-3 rounded-[1.25rem] bg-background overflow-hidden flex flex-col items-center justify-center">
                    <span className="text-primary text-lg tracking-tight" style={{ fontFamily: 'Chunk, serif' }}>renty</span>
                    <div className="mt-3 w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Search className="h-4 w-4 text-primary" />
                    </div>
                    <div className="mt-4 space-y-2 w-3/4">
                      <div className="h-2 bg-muted rounded-full w-full" />
                      <div className="h-2 bg-muted rounded-full w-2/3" />
                      <div className="h-2 bg-muted rounded-full w-3/4" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 text-center lg:text-left">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
                  <SmartphoneIcon className="h-3.5 w-3.5" />
                  PWA Ready
                </div>

                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-primary mb-3">
                  Take Renty with you
                </h2>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto lg:mx-0">
                  Install Renty on your device for a faster, app-like experience. Works offline too.
                </p>

                <ul className="space-y-3 mb-6 text-sm text-left max-w-xs mx-auto lg:mx-0">
                  <li className="flex items-start gap-3">
                    <Download className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Install on any device — phone, tablet, or desktop</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <SmartphoneIcon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Full-screen app experience with home screen icon</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Bell className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Push notifications for messages and rental updates</span>
                  </li>
                </ul>

                <Button onClick={handleInstallApp} size="lg" variant="default" className="gap-2 w-full sm:w-auto rounded-2xl h-12">
                  <Download className="h-5 w-5" />
                  Install the app
                </Button>
              </div>
            </div>
          </GlassCard>
        </div>
      </section>

      {/* ── Footer ── */}
      <Footer />
    </div>
  )
}

export default Index
