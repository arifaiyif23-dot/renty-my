import { cn } from "@/lib/utils";

interface SkeletonV2Props {
  className?: string;
  variant?: "text" | "circular" | "rectangular" | "card" | "card-lg";
  width?: string | number;
  height?: string | number;
  count?: number;
}

const variantStyles: Record<string, string> = {
  text: "h-4 w-full rounded-lg",
  circular: "rounded-full",
  rectangular: "rounded-lg",
  card: "h-64 w-full rounded-lg",
  "card-lg": "h-80 w-full rounded-lg",
};

const SkeletonV2 = ({
  className,
  variant = "text",
  width,
  height,
  count = 1,
}: SkeletonV2Props) => {
  const base = cn(
    "animate-shimmer bg-muted",
    variantStyles[variant],
    className
  );

  const items = Array.from({ length: count }, (_, i) => i);

  if (count === 1) {
    return (
      <div
        className={base}
        style={{ width, height }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {items.map((i) => (
        <div
          key={i}
          className={base}
          style={{ width, height }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
};

export { SkeletonV2 };
