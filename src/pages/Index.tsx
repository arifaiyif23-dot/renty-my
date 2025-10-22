import Header from "@/components/Header";
import SearchBar from "@/components/SearchBar";
import ItemCard from "@/components/ItemCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Recycle, Shield, Clock, TrendingUp } from "lucide-react";

const Index = () => {
  // Mock data for featured items
  const featuredItems = [
    {
      id: "1",
      title: "Honda City 2022 - Comfortable Sedan",
      image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80",
      pricePerDay: 150,
      category: "Vehicles",
      rating: 4.8,
      reviewCount: 24,
      location: "Kuala Lumpur",
      distance: "2.5 km",
    },
    {
      id: "2",
      title: "Canon EOS R6 Camera Kit",
      image: "https://images.unsplash.com/photo-1606983340126-99ab4feaa64a?w=800&q=80",
      pricePerDay: 80,
      category: "Gadgets",
      rating: 5.0,
      reviewCount: 12,
      location: "Petaling Jaya",
      distance: "5.2 km",
    },
    {
      id: "3",
      title: "Cozy Studio in KLCC",
      image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80",
      pricePerDay: 200,
      category: "Rooms",
      rating: 4.9,
      reviewCount: 31,
      location: "KLCC, KL",
      distance: "1.8 km",
    },
    {
      id: "4",
      title: "Mountain Bike - Trek Marlin 7",
      image: "https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?w=800&q=80",
      pricePerDay: 35,
      category: "Sports",
      rating: 4.7,
      reviewCount: 18,
      location: "Subang Jaya",
      distance: "7.1 km",
    },
    {
      id: "5",
      title: "DJI Mavic Pro 3 Drone",
      image: "https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=800&q=80",
      pricePerDay: 120,
      category: "Gadgets",
      rating: 4.9,
      reviewCount: 15,
      location: "Shah Alam",
      distance: "10.5 km",
    },
    {
      id: "6",
      title: "Yamaha Acoustic Guitar",
      image: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800&q=80",
      pricePerDay: 25,
      category: "Music",
      rating: 4.6,
      reviewCount: 9,
      location: "Bangsar",
      distance: "3.2 km",
    },
  ];

  const categories = [
    { name: "Vehicles", icon: "🚗", count: "500+" },
    { name: "Gadgets", icon: "📱", count: "350+" },
    { name: "Rooms", icon: "🏠", count: "200+" },
    { name: "Sports", icon: "⚽", count: "180+" },
    { name: "Music", icon: "🎸", count: "120+" },
    { name: "Tools", icon: "🔧", count: "150+" },
  ];

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
    <div className="min-h-screen">
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((category) => (
              <Card
                key={category.name}
                className="p-6 text-center hover:shadow-lg transition-all cursor-pointer hover:scale-105"
              >
                <div className="text-4xl mb-3">{category.icon}</div>
                <h3 className="font-semibold mb-1">{category.name}</h3>
                <p className="text-sm text-muted-foreground">{category.count}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Items */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-bold">Featured Rentals</h2>
            <Button variant="outline">View All</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredItems.map((item) => (
              <ItemCard key={item.id} {...item} />
            ))}
          </div>
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
          <Button size="lg" variant="secondary" className="text-lg px-8">
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
