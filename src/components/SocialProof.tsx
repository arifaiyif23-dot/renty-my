import { useState, useEffect } from "react";
import { Eye, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface SocialProofProps {
  itemId: string;
}

export const SocialProof = ({ itemId }: SocialProofProps) => {
  const [viewCount, setViewCount] = useState(0);
  const [recentBookings, setRecentBookings] = useState(0);

  useEffect(() => {
    trackView();
    fetchStats();
  }, [itemId]);

  const trackView = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase
        .from('item_views')
        .insert({
          item_id: itemId,
          user_id: user?.id || null,
        });
    } catch (error) {
      console.error('Error tracking view:', error);
    }
  };

  const fetchStats = async () => {
    try {
      // Get view count from last 24 hours
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const { data: views, error: viewsError } = await supabase
        .from('item_views')
        .select('id')
        .eq('item_id', itemId)
        .gte('viewed_at', oneDayAgo.toISOString());

      if (viewsError) throw viewsError;
      setViewCount(views?.length || 0);

      // Get recent bookings (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: bookings, error: bookingsError } = await supabase
        .from('rentals')
        .select('id')
        .eq('item_id', itemId)
        .gte('created_at', sevenDaysAgo.toISOString());

      if (bookingsError) throw bookingsError;
      setRecentBookings(bookings?.length || 0);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  return (
    <div className="flex gap-2 flex-wrap">
      {viewCount > 0 && (
        <Badge variant="secondary" className="gap-1">
          <Eye className="h-3 w-3" />
          {viewCount} {viewCount === 1 ? 'view' : 'views'} today
        </Badge>
      )}
      {recentBookings > 0 && (
        <Badge variant="secondary" className="gap-1">
          <TrendingUp className="h-3 w-3" />
          {recentBookings} {recentBookings === 1 ? 'booking' : 'bookings'} this week
        </Badge>
      )}
    </div>
  );
};
