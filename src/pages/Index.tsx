import { useEffect, useState, lazy, Suspense, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useInView } from "react-intersection-observer";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import Header from "@/components/Header";
import heroBanner from "@/assets/hero-banner.jpg";
import rentyLogo from "@/assets/renty-logo.png";
import SearchBar from "@/components/SearchBar";
import { AnimatedCategoryIcon } from "@/components/AnimatedCategoryIcon";
import { AnimatedStepCard } from "@/components/AnimatedStepCard";
import { FooterDialog } from "@/components/FooterContent";
import { EnhancedItemCard } from "@/components/EnhancedItemCard";
import { useIsMobile } from "@/hooks/use-mobile";

// Lazy load heavy below-the-fold components
const TrustBadges = lazy(() => import("@/components/TrustBadges").then(m => ({ default: m.TrustBadges })));
const OnboardingGuide = lazy(() => import("@/components/OnboardingGuide").then(m => ({ default: m.OnboardingGuide })));
const SocialProofSection = lazy(() => import("@/components/SocialProofSection").then(m => ({ default: m.SocialProofSection })));
const RecentlyViewed = lazy(() => import("@/components/RecentlyViewed").then(m => ({ default: m.RecentlyViewed })));
import SkeletonCard from "@/components/SkeletonCard";
import EmptyState from "@/components/EmptyState";
import SEO from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Recycle, Shield, Clock, TrendingUp, Package, Sparkles,
  Car, Smartphone, Home, Dumbbell, Music, Wrench, 
  FileCheck, Lock, CreditCard, HeadphonesIcon
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FeaturedItem {
  id: string;
  title: string;
  image: string;
  pricePerDay: number;
  category: string;
  rating: number;
  reviewCount: number;
  location: string;
  isOwnerVerified?: boolean;
  badge?: "trending" | "just-listed" | "available";
}

interface Category {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  minPrice?: number;
}

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const prefersReducedMotion = useReducedMotion();
  useKeyboardShortcuts();
  const [featuredItems, setFeaturedItems] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [footerDialog, setFooterDialog] = useState<string | null>(null);
  
  const { ref: featuredRef, inView: featuredInView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const { ref: onboardingRef, inView: onboardingInView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const { ref: socialProofRef, inView: socialProofInView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const { ref: recentViewedRef, inView: recentViewedInView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  // Memoize category config to prevent recreation on every render
  const categoryConfig = useMemo(() => ({
    electronics: { icon: Smartphone, displayName: "Electronics" },
    vehicles: { icon: Car, displayName: "Vehicles" },
    tools: { icon: Wrench, displayName: "Tools" },
    sports: { icon: Dumbbell, displayName: "Sports" },
    party: { icon: Music, displayName: "Party" },
    other: { icon: Package, displayName: "Other" },
  }), []);

  // Memoize steps array to prevent recreation on every render
  const howItWorksSteps = useMemo(() => [
    {
      icon: <Recycle className="h-10 w-10 text-primary" />,
      title: "Find What You Need",
      description: "Browse 10K+ verified items. From cameras to cars, we've got you covered. Search by location, price, or category.",
    },
    {
      icon: <Shield className="h-10 w-10 text-primary" />,
      title: "Book Instantly",
      description: "Secure payment. Instant confirmation. Insurance included. Zero hassle. Your rental is protected every step of the way.",
    },
    {
      icon: <Clock className="h-10 w-10 text-primary" />,
      title: "Pick Up & Enjoy",
      description: "Meet locally or get it delivered. Use it. Love it. Make memories. Return it whenever you're done.",
    },
    {
      icon: <TrendingUp className="h-10 w-10 text-primary" />,
      title: "Return & Review",
      description: "Drop it off. Rate your experience. Build trust in our community. Help others make informed decisions.",
    },
  ], []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Combine queries using Promise.all for better performance
      const [itemsResult, categoryResult] = await Promise.all([
        supabase
          .from('items')
          .select(`
            id,
            title,
            price_per_day,
            category,
            location,
            created_at,
            owner_id,
            item_images!inner(image_url),
            profiles!items_owner_id_fkey(is_verified)
          `)
          .eq('is_available', true)
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('items')
          .select('category, price_per_day')
          .eq('is_available', true)
      ]);

      if (itemsResult.error) throw itemsResult.error;

      const itemsData = itemsResult.data;

      // Optimized: Fetch all reviews in one query
      const itemIds = itemsData?.map(i => i.id) || [];
      const { data: allReviews } = await supabase
        .from('rentals')
        .select('item_id, reviews(rating)')
        .in('item_id', itemIds);

      const reviewsByItem = new Map<string, number[]>();
      allReviews?.forEach((rental: any) => {
        if (rental.reviews && rental.reviews.length > 0) {
          const existing = reviewsByItem.get(rental.item_id) || [];
          reviewsByItem.set(rental.item_id, [...existing, ...rental.reviews.map((r: any) => r.rating)]);
        }
      });

      // Calculate review ratings and add badges using useMemo for performance
      const itemsWithReviews = (itemsData || []).map((item, index) => {
        const ratings = reviewsByItem.get(item.id) || [];
        const reviewCount = ratings.length;
        const rating = reviewCount > 0
          ? ratings.reduce((sum, r) => sum + r, 0) / reviewCount
          : 0;

        // Determine badge
        const createdAt = new Date(item.created_at);
        const daysSinceCreated = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        const badge: "trending" | "just-listed" | "available" | undefined = 
          daysSinceCreated < 7 ? "just-listed" :
          index < 2 ? "trending" : "available";

        return {
          id: item.id,
          title: item.title,
          image: item.item_images[0]?.image_url || 'https://images.unsplash.com/photo-1580674285054-bed31e145f59?w=800&q=80',
          pricePerDay: Number(item.price_per_day),
          category: item.category,
          rating: Math.round(rating * 10) / 10,
          reviewCount,
          location: item.location,
          isOwnerVerified: item.profiles?.is_verified || false,
          badge,
        };
      });

      setFeaturedItems(itemsWithReviews);

      // Process categories from already-fetched data
      const categoryCounts = categoryResult.data;
      if (categoryResult.error) throw categoryResult.error;

      const categoryMap = new Map<string, { count: number; minPrice: number }>();
      
      (categoryCounts || []).forEach((item) => {
        const existing = categoryMap.get(item.category);
        const price = Number(item.price_per_day);
        
        if (existing) {
          existing.count++;
          existing.minPrice = Math.min(existing.minPrice, price);
        } else {
          categoryMap.set(item.category, { count: 1, minPrice: price });
        }
      });

      const categoryData: Category[] = Array.from(categoryMap.entries()).map(
        ([name, data]) => {
          const config = categoryConfig[name.toLowerCase()] || { icon: Package, displayName: name };
          return {
            name: config.displayName,
            icon: config.icon,
            count: data.count,
            minPrice: Math.round(data.minPrice),
          };
        }
      );

      setCategories(categoryData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-mobile-nav">
      <SEO
        title="Rent Anything, Earn from Anything"
        description="Malaysia's trusted P2P rental marketplace. Access 500+ verified items from cameras to cars. Rent what you need or earn from what you own. Insured & verified."
      />
      <Header />

      {/* Hero Section */}
      <section className="relative bg-primary/5 py-16 md:py-24" style={{ backgroundImage: `url(${heroBanner})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-background/85" />
        
        <div className="container mx-auto px-6 md:px-8 lg:px-12 relative z-10">
          <div className="max-w-4xl mx-auto text-center mb-8">
            {/* Brand Clarity */}
            <div className="inline-block mb-4">
              <Badge variant="outline" className="px-4 py-2 text-sm font-medium border-primary/50">
                🇲🇾 Malaysia's P2P Rental Marketplace
              </Badge>
            </div>
            
            {/* Renty Brand Logo & Name */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <img src={rentyLogo} alt="Renty" className="h-14 md:h-20 w-auto" />
              <span className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-primary">
                Renty
              </span>
            </div>
            
            <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold mb-6 text-foreground">
              Rent Anything.{" "}
              <span className="block mt-2">Earn from Anything.</span>
              <span className="text-muted-foreground block mt-2 text-2xl md:text-3xl">From Cameras to Cars.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-6 max-w-2xl mx-auto">
              Malaysia's trusted peer-to-peer rental platform. Access thousands of items without buying, or earn from what you already own.
            </p>
            
            {/* Primary CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Button 
                size="lg" 
                className="text-lg px-8 py-6 shadow-lg hover:shadow-xl"
                onClick={() => navigate('/search')}
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Browse Items
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-lg px-8 py-6 shadow-lg hover:shadow-xl"
                onClick={() => navigate('/list-item')}
              >
                <TrendingUp className="w-5 h-5 mr-2" />
                List Your Item
              </Button>
            </div>
            
            <Suspense fallback={<div className="h-12" />}>
              <TrustBadges />
            </Suspense>
          </div>
          
          {/* Enhanced Search Bar */}
          <div className="max-w-3xl mx-auto">
            <div className="card-minimal p-2 rounded-xl">
              <SearchBar />
            </div>
            <p className="text-center text-sm text-muted-foreground mt-3">
              🔍 Popular: Cameras • Cars • Tools • Drones • Party Equipment
            </p>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 md:py-24 bg-card">
        <div className="container mx-auto px-6 md:px-8 lg:px-12">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-center mb-12">
            Browse by Category
          </h2>
          
          {categories.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
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
          ) : loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="card-minimal p-6 text-center animate-pulse">
                  <div className="h-16 w-16 bg-muted rounded-full mx-auto mb-3" />
                  <div className="h-4 bg-muted rounded w-3/4 mx-auto mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2 mx-auto" />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* Featured Items */}
      <section className="py-16 md:py-24" ref={featuredRef}>
        <div className="container mx-auto px-6 md:px-8 lg:px-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-heading text-3xl md:text-4xl font-bold mb-2">
                Featured Rentals
              </h2>
              <p className="text-muted-foreground">Handpicked items just for you</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/search')}>
              View All
            </Button>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : featuredItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredItems.map((item) => (
                <EnhancedItemCard key={item.id} {...item} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Package}
              title="No Items Available"
              description="Be the first to list an item on RENTY and start earning!"
              actionLabel="List Your First Item"
              onAction={() => navigate('/list-item')}
            />
          )}
        </div>
      </section>

      {/* Onboarding Guide */}
      <section className="py-12 md:py-16" ref={onboardingRef}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {onboardingInView && (
            <Suspense fallback={<div className="h-96 animate-pulse bg-muted rounded-lg" />}>
              <OnboardingGuide />
            </Suspense>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 md:py-24 bg-card">
        <div className="container mx-auto px-6 md:px-8 lg:px-12">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-center mb-12">
            How RENTY Works
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
            {howItWorksSteps.map((step, index) => (
              <AnimatedStepCard
                key={index}
                icon={step.icon}
                title={step.title}
                description={step.description}
                step={index + 1}
                isLast={index === howItWorksSteps.length - 1}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Trust & Safety Section */}
      <section className="py-16 md:py-24 bg-accent/5">
        <div className="container mx-auto px-6 md:px-8 lg:px-12">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
              Safe, Secure, Insured
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Your peace of mind is our priority. Every rental is protected.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto">
          <div className="text-center">
            <div className="card-minimal p-6 rounded-xl h-full">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-primary" aria-hidden="true" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Insurance Coverage</h3>
              <p className="text-sm text-muted-foreground">
                All rentals protected up to RM 50,000 against damage or loss
              </p>
            </div>
          </div>

            <div className={`text-center ${prefersReducedMotion ? '' : 'animate-fade-in'}`} style={prefersReducedMotion ? {} : { animationDelay: '200ms' }}>
              <div className="glass-card p-6 rounded-xl hover:shadow-lg transition-shadow h-full">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileCheck className="w-8 h-8 text-primary" aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-lg mb-2">ID Verification</h3>
                <p className="text-sm text-muted-foreground">
                  AI-powered MyKad verification for all users
                </p>
              </div>
            </div>

            <div className={`text-center ${prefersReducedMotion ? '' : 'animate-fade-in'}`} style={prefersReducedMotion ? {} : { animationDelay: '300ms' }}>
              <div className="glass-card p-6 rounded-xl hover:shadow-lg transition-shadow h-full">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="w-8 h-8 text-primary" aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Secure Payments</h3>
                <p className="text-sm text-muted-foreground">
                  Encrypted payments via toyyibPay. Your money is safe.
                </p>
              </div>
            </div>

            <div className={`text-center ${prefersReducedMotion ? '' : 'animate-fade-in'}`} style={prefersReducedMotion ? {} : { animationDelay: '400ms' }}>
              <div className="glass-card p-6 rounded-xl hover:shadow-lg transition-shadow h-full">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <HeadphonesIcon className="w-8 h-8 text-primary" aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-lg mb-2">24/7 Support</h3>
                <p className="text-sm text-muted-foreground">
                  Dispute resolution and customer support anytime
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="bg-background" ref={socialProofRef}>
        {socialProofInView && (
          <Suspense fallback={<div className="h-96 animate-pulse bg-muted rounded-lg" />}>
            <SocialProofSection />
          </Suspense>
        )}
      </section>

      {/* Recently Viewed */}
      <section className="py-12" ref={recentViewedRef}>
        {recentViewedInView && (
          <Suspense fallback={null}>
            <RecentlyViewed />
          </Suspense>
        )}
      </section>

      {/* Dual CTA Section */}
      <section className="py-16 md:py-24 bg-accent/10">
        <div className="container mx-auto px-6 md:px-8 lg:px-12">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Whether you want to rent or earn, RENTY makes it easy
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* For Renters */}
            <div className="card-elevated p-8 text-center rounded-xl">
              <Sparkles className="w-12 h-12 text-primary mx-auto mb-4" aria-hidden="true" />
              <h3 className="font-heading text-2xl font-bold mb-3">Looking to Rent?</h3>
              <p className="text-muted-foreground mb-6">
                Access thousands of items without buying. Save money and space.
              </p>
              <Button
                size="lg"
                variant="default"
                className="w-full"
                onClick={() => navigate('/search')}
              >
                Browse Items
              </Button>
            </div>

            {/* For Owners */}
            <div className={`glass-card p-8 text-center rounded-2xl hover-scale ${prefersReducedMotion ? '' : 'animate-fade-in'}`} style={prefersReducedMotion ? {} : { animationDelay: '200ms' }}>
              <TrendingUp className="w-12 h-12 text-primary mx-auto mb-4" aria-hidden="true" />
              <h3 className="font-heading text-2xl font-bold mb-3">Want to Earn?</h3>
              <p className="text-muted-foreground mb-6">
                Turn your unused items into income. Start earning today.
              </p>
              <Button
                size="lg"
                variant="secondary"
                className="w-full"
                onClick={() => navigate('/list-item')}
              >
                List Your Item
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-foreground text-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-semibold mb-4">About</h4>
              <ul className="space-y-2 text-sm text-background/80">
                <li className="cursor-pointer hover:text-background transition-colors" onClick={() => setFooterDialog('about')}>About Us</li>
                <li className="cursor-pointer hover:text-background transition-colors" onClick={() => setFooterDialog('how-it-works')}>How It Works</li>
                <li className="cursor-pointer hover:text-background transition-colors" onClick={() => setFooterDialog('careers')}>Careers</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-background/80">
                <li className="cursor-pointer hover:text-background transition-colors" onClick={() => setFooterDialog('help')}>Help Center</li>
                <li className="cursor-pointer hover:text-background transition-colors" onClick={() => setFooterDialog('safety')}>Safety</li>
                <li className="cursor-pointer hover:text-background transition-colors" onClick={() => setFooterDialog('contact')}>Contact Us</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-background/80">
                <li className="cursor-pointer hover:text-background transition-colors" onClick={() => setFooterDialog('terms')}>Terms of Service</li>
                <li className="cursor-pointer hover:text-background transition-colors" onClick={() => setFooterDialog('privacy')}>Privacy Policy</li>
                <li className="cursor-pointer hover:text-background transition-colors" onClick={() => setFooterDialog('insurance')}>Insurance</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Community</h4>
              <ul className="space-y-2 text-sm text-background/80">
                <li className="cursor-pointer hover:text-background transition-colors" onClick={() => setFooterDialog('blog')}>Blog</li>
                <li className="cursor-pointer hover:text-background transition-colors" onClick={() => setFooterDialog('trust')}>Trust & Safety</li>
                <li className="cursor-pointer hover:text-background transition-colors" onClick={() => setFooterDialog('refer')}>Refer a Friend</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-background/20 pt-8 text-center text-sm text-background/60">
            © 2024 RENTY. All rights reserved. Reuse & Sustain.
          </div>
        </div>
      </footer>

      {/* Footer Dialogs */}
      <FooterDialog 
        open={!!footerDialog} 
        onOpenChange={() => setFooterDialog(null)}
        type={footerDialog as 'about' | 'help' | 'contact' | 'terms' | 'privacy' | 'safety'}
      />
    </div>
  );
};

export default Index;
