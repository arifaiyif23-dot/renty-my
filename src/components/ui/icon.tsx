import { forwardRef, useState, useEffect, type SVGProps, type ComponentType } from "react";
import { cn } from "@/lib/utils";
import type { IconStyle } from "@/lib/icons";
import { loadIcon } from "@/lib/icons";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: string;
  style?: IconStyle;
  fallback?: boolean;
}

const Icon = forwardRef<SVGSVGElement, IconProps>(
  ({ name, style = "linear", className, fallback = true, ...props }, ref) => {
    const [Component, setComponent] = useState<ComponentType<SVGProps<SVGSVGElement>> | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
      let cancelled = false;
      setFailed(false);

      loadIcon(name, style).then((mod) => {
        if (!cancelled) {
          if (mod) {
            setComponent(() => mod);
          } else {
            setFailed(true);
          }
        }
      }).catch(() => {
        if (!cancelled) setFailed(true);
      });

      return () => { cancelled = true; };
    }, [name, style]);

    if (failed && fallback && style !== "linear") {
      return <Icon name={name} style="linear" className={className} {...props} />;
    }

    if (!Component) {
      return (
        <svg
          ref={ref}
          className={cn("size-5", className)}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          {...props}
        >
          <circle cx="12" cy="12" r="10" strokeDasharray="4 3" opacity="0.4" />
        </svg>
      );
    }

    return (
      <Component
        ref={ref}
        className={cn("size-5", className)}
        {...props}
      />
    );
  },
);
Icon.displayName = "Icon";

export { Icon };
