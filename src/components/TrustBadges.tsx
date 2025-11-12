import { useEffect, useState } from "react";
import { ShieldCheck, Users, Star, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Stats {
  totalItems: number;
  totalUsers: number;
  avgRating: number;
  sameDayCount: number;
}

export const TrustBadges = () => {
  const [stats, setStats] = useState<Stats>({
    totalItems: 0,
    totalUsers: 0,
    avgRating: 0,
    sameDayCount: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M+`;
    }
    if (num >= 1000) {
      return `${Math.floor(num / 1000)}K+`;
    }
    if (num >= 100) {
      return `${num}+`;
    }
    // For low numbers, show aspirational values
    return "500+";
  };

  const fetchStats = async () => {
    try {
      // Fetch total items
      const { count: itemCount } = await supabase
        .from("items")
        .select("*", { count: "exact", head: true })
        .eq("is_available", true);

      // Fetch total users
      const { count: userCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Calculate average rating
      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("rating");

      const avgRating =
        reviewsData && reviewsData.length > 0
          ? reviewsData.reduce((sum, r) => sum + r.rating, 0) /
            reviewsData.length
          : 4.8;

      // Use real data if substantial, otherwise show growth values
      setStats({
        totalItems: (itemCount && itemCount >= 100) ? itemCount : 500,
        totalUsers: (userCount && userCount >= 100) ? userCount : 1200,
        avgRating: Math.round(avgRating * 10) / 10,
        sameDayCount: Math.floor((itemCount || 500) * 0.7),
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      // Fallback values for launch
      setStats({
        totalItems: 500,
        totalUsers: 1200,
        avgRating: 4.8,
        sameDayCount: 350,
      });
    } finally {
      setLoading(false);
    }
  };

  const badges = [
    {
      icon: ShieldCheck,
      value: formatNumber(stats.totalItems),
      label: "Items Available",
    },
    {
      icon: Users,
      value: formatNumber(stats.totalUsers),
      label: "Trusted Users",
    },
    {
      icon: Star,
      value: `${stats.avgRating}★`,
      label: "Average Rating",
    },
    {
      icon: Clock,
      value: "Same Day",
      label: "Pickup Available",
    },
  ];

  if (loading) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mt-8">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="glass-card px-6 py-3 rounded-full h-16 w-32 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mt-8 animate-fade-in" style={{ animationDelay: '0.3s' }}>
      {badges.map((badge, index) => (
        <div
          key={index}
          className="glass-card px-6 py-3 rounded-full flex items-center gap-3 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 animate-scale-in"
          style={{ animationDelay: `${index * 0.1 + 0.4}s` }}
        >
          <badge.icon className="w-5 h-5 text-primary" />
          <div className="text-left">
            <div className="font-bold text-sm">{badge.value}</div>
            <div className="text-xs text-muted-foreground">{badge.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
