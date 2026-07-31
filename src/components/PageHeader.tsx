import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
  children?: ReactNode;
}

export function PageHeader({
  icon,
  title,
  subtitle,
  className,
  titleClassName,
  subtitleClassName,
  children,
}: PageHeaderProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <h1 className={cn("text-2xl font-bold", titleClassName)}>{title}</h1>
        {subtitle && <p className={cn("text-sm text-muted-foreground", subtitleClassName)}>{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
