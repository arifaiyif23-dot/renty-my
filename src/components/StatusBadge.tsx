import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Rental } from '@/types';

interface StatusBadgeProps {
  status: Rental['status'];
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = {
    pending: {
      label: 'Pending Approval',
      icon: Clock,
      variant: 'secondary' as const,
      className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
    },
    approved: {
      label: 'Approved',
      icon: CheckCircle,
      variant: 'default' as const,
      className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    },
    active: {
      label: 'Active Rental',
      icon: Loader2,
      variant: 'default' as const,
      className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
    },
    completed: {
      label: 'Completed',
      icon: CheckCircle,
      variant: 'outline' as const,
      className: 'bg-muted text-muted-foreground',
    },
    cancelled: {
      label: 'Cancelled',
      icon: XCircle,
      variant: 'destructive' as const,
      className: 'bg-destructive/10 text-destructive border-destructive/20',
    },
    rejected: {
      label: 'Rejected',
      icon: AlertCircle,
      variant: 'destructive' as const,
      className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    },
  };

  const { label, icon: Icon, className } = config[status] || config.pending;
  const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';

  return (
    <Badge className={`${className} gap-1.5`}>
      <Icon className={`${iconSize} ${status === 'active' ? 'animate-spin' : ''}`} />
      {label}
    </Badge>
  );
}
