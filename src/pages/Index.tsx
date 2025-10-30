import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import Header from "@/components/Header";
import heroBanner from "@/assets/hero-banner.jpg";
import SearchBar from "@/components/SearchBar";
import { AnimatedCategoryIcon } from "@/components/AnimatedCategoryIcon";
import { AnimatedStepCard } from "@/components/AnimatedStepCard";
import { TrustBadges } from "@/components/TrustBadges";
import { SocialProofSection } from "@/components/SocialProofSection";
import { RecentlyViewed } from "@/components/RecentlyViewed";
import { FooterDialog } from "@/components/FooterContent";
import { EnhancedItemCard } from "@/components/EnhancedItemCard";
import { FloatingParticles } from "@/components/FloatingParticles";
import SkeletonCard from "@/components/SkeletonCard";
import EmptyState from "@/components/EmptyState";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { 
  Recycle, Shield, Clock, TrendingUp, Package, Sparkles,
  Car, Smartphone, Home, Dumbbell, Music, Wrench
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
  const [featuredItems, setFeaturedItems] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [footerDialog, setFooterDialog] = useState<string | null>(null);
  
  const { ref: featuredRef, inView: featuredInView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch featured items
      const { data: itemsData, error: itemsError } = await supabase
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
        .limit(6);

      if (itemsError) throw itemsError;

      // Calculate review ratings and add badges
      const itemsWithReviews = await Promise.all(
        (itemsData || []).map(async (item, index) => {
          const { data: reviewsData } = await supabase
            .from('reviews')
            .select('rating')
            .eq('reviewee_id', item.id);

          const reviewCount = reviewsData?.length || 0;
          const rating = reviewCount > 0
            ? reviewsData!.reduce((sum, r) => sum + r.rating, 0) / reviewCount
            : 0;

          // Determine badge
          const createdAt = new Date(item.created_at);
          const daysSinceCreated = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
          let badge: "trending" | "just-listed" | "available" | undefined;
          
          if (daysSinceCreated < 7) {
            badge = "just-listed";
          } else if (index < 2) {
            badge = "trending";
          } else {
            badge = "available";
          }

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
        })
      );

      setFeaturedItems(itemsWithReviews);

      // Fetch categories with counts and min prices
      const categoryConfig: Record<string, { icon: any; displayName: string }> = {
        vehicles: { icon: Car, displayName: "Vehicles" },
        gadgets: { icon: Smartphone, displayName: "Gadgets" },
        rooms: { icon: Home, displayName: "Rooms" },
        sports: { icon: Dumbbell, displayName: "Sports" },
        music: { icon: Music, displayName: "Music" },
        tools: { icon: Wrench, displayName: "Tools" },
      };

      const { data: categoryCounts, error: categoryError } = await supabase
        .from('items')
        .select('category, price_per_day')
        .eq('is_available', true);

      if (categoryError) throw categoryError;

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

  const howItWorksSteps = [
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
  ];

  return (
    <div className="min-h-screen pb-mobile-nav">
      <SEO
        title="Home"
        description="Rent what you need, when you need it. From vehicles to gadgets, rooms to tools - Malaysia's leading sustainable rental platform."
      />
      <Header />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10 py-16 md:py-24 overflow-hidden" style={{ backgroundImage: `url(${heroBanner})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
        <FloatingParticles />
        
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            className="max-w-4xl mx-auto text-center mb-12"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-foreground">
              Own Less. Share More.{" "}
              <span className="block mt-2">Protect Our Planet.</span>
              <span className="text-primary block mt-2">The Future of Ownership is Shared.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-4">
              Borrow what you need. Share what you own. Build community.
              <span className="block mt-2 font-medium">
                Malaysia's most trusted rental marketplace.
              </span>
            </p>
            
            <TrustBadges />
          </motion.div>
          
          {/* Enhanced Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="max-w-3xl mx-auto"
          >
            <div className="glass-card p-2 rounded-2xl shadow-2xl">
              <SearchBar />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-12 md:py-16 bg-card">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.h2
            className="font-heading text-3xl md:text-4xl font-bold text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Browse by Category
          </motion.h2>
          
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
                <div key={i} className="glass-card p-6 text-center animate-pulse">
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
      <section className="py-12 md:py-16" ref={featuredRef}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
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

      {/* How It Works */}
      <section className="py-12 md:py-16 bg-card">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.h2
            className="font-heading text-3xl md:text-4xl font-bold text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            How RENTY Works
          </motion.h2>
          
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

      {/* Social Proof Section */}
      <section className="bg-gradient-to-br from-primary/5 to-accent/5">
        <SocialProofSection />
      </section>

      {/* Dual CTA Section */}
      <section className="relative py-16 md:py-24 bg-gradient-to-br from-primary to-secondary overflow-hidden">
        <FloatingParticles />
        
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg text-white/90 max-w-2xl mx-auto">
              Whether you want to rent or earn, RENTY makes it easy
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* For Renters */}
            <motion.div
              className="glass-card p-8 text-center rounded-2xl"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.02 }}
            >
              <Sparkles className="w-12 h-12 text-primary mx-auto mb-4" />
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
            </motion.div>

            {/* For Owners */}
            <motion.div
              className="glass-card p-8 text-center rounded-2xl"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.02 }}
            >
              <TrendingUp className="w-12 h-12 text-primary mx-auto mb-4" />
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
            </motion.div>
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
      <Dialog open={!!footerDialog} onOpenChange={() => setFooterDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {footerDialog === 'about' && 'About RENTY'}
              {footerDialog === 'how-it-works' && 'How It Works'}
              {footerDialog === 'careers' && 'Careers'}
              {footerDialog === 'help' && 'Help Center'}
              {footerDialog === 'safety' && 'Safety Guidelines'}
              {footerDialog === 'contact' && 'Contact Us'}
              {footerDialog === 'terms' && 'Terms of Service'}
              {footerDialog === 'privacy' && 'Privacy Policy'}
              {footerDialog === 'insurance' && 'Insurance Information'}
              {footerDialog === 'blog' && 'Blog'}
              {footerDialog === 'trust' && 'Trust & Safety'}
              {footerDialog === 'refer' && 'Refer a Friend'}
            </DialogTitle>
          </DialogHeader>
          <DialogDescription className="space-y-4 py-4">
            {footerDialog === 'about' && (
              <>
                <p>RENTY is Malaysia's leading sustainable rental marketplace, connecting people who need items with those who have them.</p>
                <p>Our mission is to reduce waste, save money, and build stronger communities through the sharing economy.</p>
              </>
            )}
            {footerDialog === 'how-it-works' && (
              <>
                <p><strong>1. Browse:</strong> Search thousands of items available for rent in your area.</p>
                <p><strong>2. Book:</strong> Select dates, confirm payment, and receive instant confirmation.</p>
                <p><strong>3. Enjoy:</strong> Pick up or get delivery, use the item, and return when done.</p>
                <p><strong>4. Review:</strong> Rate your experience and help build trust in our community.</p>
              </>
            )}
            {footerDialog === 'safety' && (
              <>
                <p>Your safety is our priority. All users are verified, and every rental is protected by our comprehensive insurance.</p>
                <p>We have a dedicated trust & safety team available 24/7 to assist with any concerns.</p>
              </>
            )}
            {footerDialog === 'contact' && (
              <>
                <p><strong>Email:</strong> support@renty.my</p>
                <p><strong>Phone:</strong> +60 3-xxxx-xxxx</p>
                <p><strong>Hours:</strong> Monday - Friday, 9 AM - 6 PM (MYT)</p>
              </>
            )}
            {footerDialog === 'terms' && (
              <p>Our Terms of Service outline the rules and regulations for using RENTY. By using our platform, you agree to these terms. Full terms available at renty.my/terms</p>
            )}
            {footerDialog === 'privacy' && (
              <p>We take your privacy seriously. Your personal data is encrypted and never shared without your consent. Read our full privacy policy at renty.my/privacy</p>
            )}
            {footerDialog === 'insurance' && (
              <p>All rentals are covered by comprehensive insurance up to RM 50,000. This includes damage protection, theft coverage, and liability insurance for peace of mind.</p>
            )}
            {!footerDialog || !['about', 'how-it-works', 'safety', 'contact', 'terms', 'privacy', 'insurance'].includes(footerDialog) && (
              <p>This feature is coming soon! Stay tuned for updates.</p>
            )}
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
