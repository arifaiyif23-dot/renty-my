import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import SearchBar from "@/components/SearchBar";
import ItemCard from "@/components/ItemCard";
import SkeletonCard from "@/components/SkeletonCard";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Recycle, Shield, Clock, TrendingUp, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FeaturedItem {
  id: string;
  title: string;
  image: string;
  pricePerDay: number;
  category: string;
  rating: number;
  reviewCount: number;
  location: string;
}

const Index = () => {
  const navigate = useNavigate();
  const [featuredItems, setFeaturedItems] = useState<FeaturedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<{ name: string; icon: string; count: number }[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch featured items (latest 6 available items)
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select(`
          id,
          title,
          price_per_day,
          category,
          location,
          item_images!inner(image_url)
        `)
        .eq('is_available', true)
        .order('created_at', { ascending: false })
        .limit(6);

      if (itemsError) throw itemsError;

      // Calculate review ratings for each item
      const itemsWithReviews = await Promise.all(
        (itemsData || []).map(async (item) => {
          const { data: reviewsData } = await supabase
            .from('reviews')
            .select('rating')
            .eq('reviewee_id', item.id);

          const reviewCount = reviewsData?.length || 0;
          const rating = reviewCount > 0
            ? reviewsData!.reduce((sum, r) => sum + r.rating, 0) / reviewCount
            : 0;

          return {
            id: item.id,
            title: item.title,
            image: item.item_images[0]?.image_url || 'https://images.unsplash.com/photo-1580674285054-bed31e145f59?w=800&q=80',
            pricePerDay: Number(item.price_per_day),
            category: item.category,
            rating: Math.round(rating * 10) / 10,
            reviewCount,
            location: item.location,
          };
        })
      );

      setFeaturedItems(itemsWithReviews);

      // Fetch category counts
      const categoryIcons: Record<string, string> = {
        vehicles: "🚗",
        gadgets: "📱",
        rooms: "🏠",
        sports: "⚽",
        music: "🎸",
        tools: "🔧",
      };

      const { data: categoryCounts, error: categoryError } = await supabase
        .from('items')
        .select('category')
        .eq('is_available', true);

      if (categoryError) throw categoryError;

      const countMap = (categoryCounts || []).reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const categoryData = Object.entries(countMap).map(([name, count]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        icon: categoryIcons[name.toLowerCase()] || "📦",
        count,
      }));

      setCategories(categoryData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const howItWorks = [
    {
      icon: <Recycle className="h-8 w-8 text-primary" />,
      title: "Browse & Choose",
      description: "Explore thousands of items across multiple categories",
    },
    {
      icon: <Shield className="h-8 w-8 text-primary" />,
      title: "Book Securely",
      description: "Verified owners, secure payments, and deposit protection",
    },
    {
      icon: <Clock className="h-8 w-8 text-primary" />,
      title: "Use & Return",
      description: "Enjoy your rental and return it on time",
    },
    {
      icon: <TrendingUp className="h-8 w-8 text-primary" />,
      title: "Review & Earn Trust",
      description: "Build your reputation in our community",
    },
  ];

  return (
    <div className="min-h-screen pb-mobile-nav">
      <Header />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10 py-16 md:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-foreground">
              Rent Smart, Live{" "}
              <span className="text-primary">Sustainably</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8">
              From vehicles to gadgets, rooms to tools — rent what you need, when you need it. 
              Join Malaysia's leading platform for sustainable rentals.
            </p>
          </div>
          <SearchBar />
        </div>
      </section>

      {/* Categories */}
      <section className="py-12 md:py-16 bg-card">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
            Browse by Category
          </h2>
          {categories.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {categories.map((category) => (
                <Card
                  key={category.name}
                  className="p-4 md:p-6 text-center hover:shadow-lg transition-all cursor-pointer hover:scale-105 active:scale-95"
                  onClick={() => navigate(`/search?category=${category.name.toLowerCase()}`)}
                >
                  <div className="text-3xl md:text-4xl mb-2 md:mb-3">{category.icon}</div>
                  <h3 className="font-semibold text-sm md:text-base mb-1">{category.name}</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">{category.count}</p>
                </Card>
              ))}
            </div>
          ) : loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="p-4 md:p-6 text-center">
                  <div className="h-12 w-12 bg-muted rounded-full mx-auto mb-3 animate-pulse" />
                  <div className="h-4 bg-muted rounded w-3/4 mx-auto mb-2 animate-pulse" />
                  <div className="h-3 bg-muted rounded w-1/2 mx-auto animate-pulse" />
                </Card>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* Featured Items */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-bold">Featured Rentals</h2>
            <Button variant="outline" onClick={() => navigate('/search')}>View All</Button>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {[...Array(6)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : featuredItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {featuredItems.map((item) => (
                <ItemCard key={item.id} {...item} />
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
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            How RENTY Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((step, index) => (
              <div key={index} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  {step.icon}
                </div>
                <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-primary to-secondary">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Start Earning from Your Unused Items
          </h2>
          <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto">
            List your items in minutes and start earning. Join thousands of owners already making money on RENTY.
          </p>
          <Button 
            size="lg" 
            variant="secondary" 
            className="text-lg px-6 md:px-8 min-h-[44px]"
            onClick={() => navigate('/list-item')}
          >
            List Your First Item
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-foreground text-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-semibold mb-4">About</h4>
              <ul className="space-y-2 text-sm text-background/80">
                <li>About Us</li>
                <li>How It Works</li>
                <li>Careers</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-background/80">
                <li>Help Center</li>
                <li>Safety</li>
                <li>Contact Us</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-background/80">
                <li>Terms of Service</li>
                <li>Privacy Policy</li>
                <li>Insurance</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Community</h4>
              <ul className="space-y-2 text-sm text-background/80">
                <li>Blog</li>
                <li>Trust & Safety</li>
                <li>Refer a Friend</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-background/20 pt-8 text-center text-sm text-background/60">
            © 2024 RENTY. All rights reserved. Reuse & Sustain.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
