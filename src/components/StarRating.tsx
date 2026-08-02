import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
  reviewCount?: number;
  className?: string;
}

const sizeMap = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-6 w-6',
};

export function StarRating({
  rating,
  maxStars = 5,
  size = 'sm',
  showValue = true,
  reviewCount,
  className,
}: StarRatingProps) {
  return (
    <span className={cn('flex items-center gap-1', className)}>
      {Array.from({ length: maxStars }, (_, i) => (
        <Star
          key={i}
          className={cn(
            sizeMap[size],
            i < Math.floor(rating)
              ? 'fill-warning text-warning'
              : 'text-muted-foreground/30'
          )}
        />
      ))}
      {showValue && (
        <span className="font-semibold tabular-nums">{rating.toFixed(1)}</span>
      )}
      {reviewCount !== undefined && reviewCount > 0 && (
        <span>({reviewCount})</span>
      )}
    </span>
  );
}
