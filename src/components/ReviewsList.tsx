import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import type { Review } from "@/types";

interface ReviewsListProps {
  itemId?: string;
  userId?: string;
}

export const ReviewsList = ({ itemId, userId }: ReviewsListProps) => {
  const [reviews, setReviews] = useState<any[]>([]);
  const [averageRating, setAverageRating] = useState(0);

  useEffect(() => {
    fetchReviews();
  }, [itemId, userId]);

  const fetchReviews = async () => {
    let query = supabase
      .from('reviews')
      .select('*, reviewer:profiles!reviews_reviewer_id_fkey(full_name, avatar_url), rental:rentals(item_id)');

    if (userId) {
      query = query.eq('reviewee_id', userId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reviews:', error);
      return;
    }

    let filteredData = data || [];
    
    if (itemId) {
      filteredData = filteredData.filter((review: any) => review.rental?.item_id === itemId);
    }

    setReviews(filteredData);

    if (filteredData.length > 0) {
      const avg = filteredData.reduce((sum, review) => sum + review.rating, 0) / filteredData.length;
      setAverageRating(avg);
    }
  };

  if (reviews.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No reviews yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex items-center">
          <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
          <span className="ml-2 text-2xl font-bold">{averageRating.toFixed(1)}</span>
        </div>
        <span className="text-muted-foreground">({reviews.length} reviews)</span>
      </div>

      <div className="space-y-4">
        {reviews.map((review) => (
          <Card key={review.id}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Avatar>
                  <AvatarImage src={review.reviewer?.avatar_url} />
                  <AvatarFallback>{review.reviewer?.full_name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">{review.reviewer?.full_name}</div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < review.rating
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-muted-foreground mb-2">{review.comment}</p>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {new Date(review.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
