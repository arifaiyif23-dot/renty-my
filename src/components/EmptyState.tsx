// Back-compat shim — the entire app should use EnhancedEmptyState going forward.
// This preserves the older prop surface so existing imports keep working.
import EnhancedEmptyState from "./EnhancedEmptyState";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  showRetry?: boolean;
  onRetry?: () => void;
}

export default function EmptyState(props: EmptyStateProps) {
  return <EnhancedEmptyState {...props} variant="default" />;
}
