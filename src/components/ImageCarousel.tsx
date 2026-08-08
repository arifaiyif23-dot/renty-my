import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getOptimizedImageUrl, getSrcSet } from "@/utils/imageOptimization";

interface ImageCarouselProps {
  images: { image_url: string; id: string }[];
  title: string;
}

export default function ImageCarousel({ images, title }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  if (!images || images.length === 0) {
    return (
      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
        <p className="text-muted-foreground">No images available</p>
      </div>
    );
  }

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goToNext();
      else goToPrevious();
    }
  };

  return (
    <div className="relative group">
      <div
        className="aspect-[4/3] md:aspect-video bg-muted rounded-xl overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={getOptimizedImageUrl(images[currentIndex].image_url, { width: 1200, quality: 85 })}
          srcSet={getSrcSet(images[currentIndex].image_url)}
          sizes="(max-width: 640px) 100vw, 75vw"
          alt={`${title} - Image ${currentIndex + 1}`}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>

      {images.length > 1 && (
        <>
          <Button
            variant="secondary"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 md:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity bg-card hover:bg-card/90 rounded-full"
            onClick={goToPrevious}
            aria-label="Previous image"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 md:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity bg-card hover:bg-card/90 rounded-full"
            onClick={goToNext}
            aria-label="Next image"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </>
      )}

      {images.length > 1 && (
        <div className="absolute bottom-3 right-3 bg-card text-foreground px-2.5 py-1 rounded-full text-xs font-medium">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {images.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              aria-label={`Go to image ${index + 1}`}
              className={cn(
                "rounded-full transition-all min-h-[44px] min-w-[44px] flex items-center justify-center",
                index === currentIndex
                  ? "bg-white w-4 h-1.5"
                  : "bg-white/50 w-1.5 h-1.5"
              )}
            />
          ))}
        </div>
      )}

      {images.length > 1 && (
        <div className="hidden md:flex gap-2 mt-3 overflow-x-auto pb-2">
          {images.map((image, index) => (
            <button
              key={image.id}
              onClick={() => setCurrentIndex(index)}
              aria-label={`Go to image ${index + 1}`}
              className={cn(
                "flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden border-2 transition-all",
                index === currentIndex
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-primary/50"
              )}
            >
              <img
                src={getOptimizedImageUrl(image.image_url, { width: 160, quality: 70 })}
                srcSet={getSrcSet(image.image_url, { quality: 70 })}
                sizes="80px"
                alt={`Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
