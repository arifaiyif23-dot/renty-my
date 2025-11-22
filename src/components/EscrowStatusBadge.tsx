import { Badge } from '@/components/ui/badge';
import { Lock, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface EscrowStatusBadgeProps {
  status: string;
  className?: string;
}

export function EscrowStatusBadge({ status, className }: EscrowStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'held':
        return {
          icon: Lock,
          label: 'Held in Escrow',
          className: 'bg-amber-500/20 text-amber-800 dark:text-amber-400 border-amber-500/30'
        };
      case 'released':
        return {
          icon: CheckCircle,
          label: 'Released',
          className: 'bg-green-500/20 text-green-800 dark:text-green-400 border-green-500/30'
        };
      case 'disputed':
        return {
          icon: AlertTriangle,
          label: 'Disputed (Frozen)',
          className: 'bg-red-500/20 text-red-800 dark:text-red-400 border-red-500/30'
        };
      case 'refunded':
        return {
          icon: XCircle,
          label: 'Refunded',
          className: 'bg-blue-500/20 text-blue-800 dark:text-blue-400 border-blue-500/30'
        };
      case 'partial_release':
        return {
          icon: CheckCircle,
          label: 'Partially Released',
          className: 'bg-purple-500/20 text-purple-800 dark:text-purple-400 border-purple-500/30'
        };
      default:
        return {
          icon: Lock,
          label: status,
          className: 'bg-muted text-muted-foreground'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Badge className={`gap-1.5 ${config.className} ${className || ''}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}