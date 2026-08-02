import { useState, useEffect, useRef } from "react";
import { Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { optimizeImage } from "@/utils/imageOptimization";
import { sanitizeMessage } from "@/utils/sanitize";

interface ReviewFormProps {
  rentalId: string;
  revieweeId: string;
  onSuccess?: () => void;
}

export const ReviewForm = ({ rentalId, revieweeId, onSuccess }: ReviewFormProps) => {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const previewUrlsRef = useRef<string[]>([]);
  previewUrlsRef.current = previewUrls;

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + images.length > 5) {
      toast.error("Maximum 5 images allowed");
      return;
    }

    setImages([...images, ...files]);
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviewUrls([...previewUrls, ...urls]);
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setImages(images.filter((_, i) => i !== index));
    setPreviewUrls(previewUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check for duplicate review
      const { data: existing } = await supabase
        .from('reviews')
        .select('id')
        .eq('rental_id', rentalId)
        .eq('reviewer_id', user.id)
        .maybeSingle();
      if (existing) {
        throw new Error('You have already submitted a review for this rental');
      }

      const sanitizedComment = comment.trim() ? sanitizeMessage(comment.trim()) : null;

      // Upload all images FIRST so a mid-upload failure can't orphan a review with no images
      const uploadedImageUrls: string[] = [];
      if (images.length > 0) {
        toast.info("Compressing and uploading images...");
        const tempId = crypto.randomUUID();

        for (const image of images) {
          const optimizedBlob = await optimizeImage(image);
          const optimizedFile = new File([optimizedBlob], `${image.name.split('.')[0]}.webp`, {
            type: 'image/webp'
          });

          const fileName = `${tempId}/${crypto.randomUUID()}.webp`;

          const { error: uploadError } = await supabase.storage
            .from('review-images')
            .upload(fileName, optimizedFile);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('review-images')
            .getPublicUrl(fileName);

          uploadedImageUrls.push(publicUrl);
        }
      }

      // Insert the review row WITH the image URLs in the same logical step
      const { data: reviewData, error: reviewError } = await supabase.from('reviews')
        .insert({
          rental_id: rentalId,
          reviewer_id: user.id,
          reviewee_id: revieweeId,
          rating,
          comment: sanitizedComment,
        })
        .select()
        .single();

      if (reviewError) {
        throw new Error(`Failed to save review after uploading images: ${reviewError.message}`);
      }

      if (uploadedImageUrls.length > 0) {
        const { error: imageInsertError } = await supabase.from('review_images').insert(
          uploadedImageUrls.map((url) => ({ review_id: reviewData.id, image_url: url }))
        );
        if (imageInsertError) throw imageInsertError;
      }

      toast.success("Review submitted successfully!");
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      setRating(0);
      setComment("");
      setImages([]);
      setPreviewUrls([]);
      onSuccess?.();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to submit review");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">Your Rating</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="transition-transform hover:scale-110"
              aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
            >
              <Star
                className={`h-8 w-8 ${
                  star <= (hoveredRating || rating)
                    ? 'fill-warning text-warning'
                    : 'text-muted'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">Your Review (Optional)</label>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 2000))}
          placeholder="Share your experience..."
          rows={4}
          maxLength={2000}
        />
      </div>

      <div>
        <Label htmlFor="images" className="text-sm font-medium mb-2 block">
          Photos (Optional - Max 5)
        </Label>
        <Input
          id="images"
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageSelect}
          disabled={images.length >= 5}
          className="cursor-pointer"
        />
        {previewUrls.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            {previewUrls.map((url, index) => (
              <div key={url} className="relative group">
                <img
                  src={url}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-24 object-cover rounded-lg"
                  loading="lazy"
                />
                <button
                  onClick={() => removeImage(index)}
                  aria-label={`Remove image ${index + 1}`}
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button onClick={handleSubmit} disabled={isSubmitting || rating === 0} className="w-full">
        {isSubmitting ? "Submitting..." : "Submit Review"}
      </Button>
    </div>
  );
};
