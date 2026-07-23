import { useEffect, useState, useCallback } from "react";
import { Star, ThumbsUp, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { getOptimizedImageUrl, getSrcSet } from "@/utils/imageOptimization";

interface ReviewsListProps {
  itemId?: string;
  userId?: string;
}

export const ReviewsList = ({ itemId, userId }: ReviewsListProps) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Record<string, unknown>[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'recent' | 'highest' | 'lowest'>('recent');
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [ownerResponse, setOwnerResponse] = useState("");

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('reviews')
      .select(`
        *, 
        reviewer:profiles!reviews_reviewer_id_fkey(full_name, avatar_url), 
        rental:rentals(item_id, owner_id),
        review_images(image_url),
        review_votes(is_helpful)
      `);

    if (userId) {
      query = query.eq('reviewee_id', userId);
    }

    if (itemId) {
      const { data: rentalIds } = await supabase.from('rentals').select('id').eq('item_id', itemId);
      const ids = (rentalIds || []).map(r => r.id);
      if (ids.length > 0) {
        query = query.in('rental_id', ids);
      } else {
        query = query.in('rental_id', [null]);
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reviews:', error);
      setLoading(false);
      return;
    }

    const filteredData = data || [];

    // Apply sorting
    if (sortBy === 'highest') {
      filteredData.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'lowest') {
      filteredData.sort((a, b) => a.rating - b.rating);
    }

    setReviews(filteredData);
    setLoading(false);

    if (filteredData.length > 0) {
      const avg = filteredData.reduce((sum, review) => sum + review.rating, 0) / filteredData.length;
      setAverageRating(avg);
    }
  }, [itemId, userId, sortBy]);

  useEffect(() => {
    fetchReviews().catch((err) => console.error('Failed to fetch reviews:', err));
  }, [fetchReviews]);

  const handleVote = async (reviewId: string, isHelpful: boolean) => {
    if (!user) {
      toast.error("Please sign in to vote");
      return;
    }

    const { error } = await supabase
      .from('review_votes')
      .upsert({
        review_id: reviewId,
        user_id: user.id,
        is_helpful: isHelpful,
      });

    if (error) {
      toast.error("Failed to submit vote");
    } else {
      fetchReviews();
    }
  };

  const handleOwnerResponse = async (reviewId: string) => {
    if (!ownerResponse.trim()) return;

    const { error } = await supabase
      .from('reviews')
      .update({
        owner_response: ownerResponse.trim(),
        owner_response_at: new Date().toISOString(),
      })
      .eq('id', reviewId);

    if (error) {
      toast.error("Failed to submit response");
    } else {
      toast.success("Response submitted");
      setRespondingTo(null);
      setOwnerResponse("");
      fetchReviews();
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-muted rounded" />
                  <div className="h-3 w-48 bg-muted rounded" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No reviews yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
            <span className="ml-2 text-2xl font-bold">{averageRating.toFixed(1)}</span>
          </div>
          <span className="text-muted-foreground">({reviews.length} reviews)</span>
        </div>
        <Select value={sortBy} onValueChange={(v: 'recent' | 'highest' | 'lowest') => setSortBy(v)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most Recent</SelectItem>
            <SelectItem value="highest">Highest Rated</SelectItem>
            <SelectItem value="lowest">Lowest Rated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {reviews.map((review) => {
          const helpfulCount = (review.review_votes as Array<{ is_helpful: boolean }>)?.filter((v) => v.is_helpful).length || 0;
          const isOwner = user?.id === review.rental?.owner_id;

          return (
            <Card key={review.id}>
              <CardContent className="p-4 space-y-3">
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
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-muted'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-muted-foreground mb-2">{review.comment}</p>
                    )}
                    
                    {/* Review Images */}
                    {review.review_images && review.review_images.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 my-2">
                        {(review.review_images as Array<{ image_url: string }>).map((img, idx: number) => (
                          <img
                            key={idx}
                            src={getOptimizedImageUrl(img.image_url, { width: 240, quality: 75 })}
                            srcSet={getSrcSet(img.image_url)}
                            sizes="(max-width: 640px) 33vw, 240px"
                            alt={`Review photo ${idx + 1}`}
                            className="w-full h-24 object-cover rounded-lg"
                          />
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{new Date(review.created_at).toLocaleDateString()}</span>
                      {user && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={() => handleVote(review.id, true)}
                        >
                          <ThumbsUp className="h-3 w-3 mr-1" />
                          Helpful {helpfulCount > 0 && `(${helpfulCount})`}
                        </Button>
                      )}
                    </div>

                    {/* Owner Response */}
                    {review.owner_response && (
                      <div className="mt-3 pl-4 border-l-2 border-muted">
                        <p className="text-xs font-semibold mb-1">Owner Response:</p>
                        <p className="text-sm text-muted-foreground">{review.owner_response}</p>
                        {review.owner_response_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(review.owner_response_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Owner Response Form */}
                    {isOwner && !review.owner_response && (
                      <div className="mt-3">
                        {respondingTo === review.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={ownerResponse}
                              onChange={(e) => setOwnerResponse(e.target.value)}
                              placeholder="Write your response..."
                              rows={3}
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleOwnerResponse(review.id)}>
                                Submit Response
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setRespondingTo(null);
                                  setOwnerResponse("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRespondingTo(review.id)}
                          >
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Respond
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
