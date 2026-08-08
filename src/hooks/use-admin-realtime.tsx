import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface RealtimeStats {
  newVerifications: number;
  newFraudAlerts: number;
}

/**
 * Hook for real-time admin notifications
 * Subscribes to verification_requests and fraud_alerts table changes
 */
export function useAdminRealtime() {
  const { user } = useAuth();
  const [stats, setStats] = useState<RealtimeStats>({
    newVerifications: 0,
    newFraudAlerts: 0,
  });
  const [connectionState, setConnectionState] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

  useEffect(() => {
    if (!user) {
      return;
    }

    let disposed = false;
    const activeChannels: Array<ReturnType<typeof supabase.channel>> = [];

    const subscribe = (
      name: string,
      table: string,
      callback: (payload: { new: Record<string, unknown> }) => void,
      onStatus: (status: string) => void
    ) => {
      // Unique per-subscription channel name so overlapping tabs/remount don't
      // share listeners and double-fire events.
      const channel = supabase
        .channel(`${name}-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table },
          callback
        )
        .subscribe(onStatus);
      if (!disposed) {
        activeChannels.push(channel);
      }
    };

    subscribe(
      'admin-verifications',
      'verification_requests',
      ({ new: verification }) => {
        setStats((prev) => ({
          ...prev,
          newVerifications: prev.newVerifications + 1,
        }));
        toast.info('New Verification Request', {
          description: `${(verification as { full_name_on_document: string }).full_name_on_document} submitted ${(verification as { document_type: string }).document_type} verification`,
          duration: 5000,
        });
      },
      (status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionState('connected');
        } else if (status === 'CLOSED') {
          setConnectionState('disconnected');
        } else if (status === 'CHANNEL_ERROR') {
          setConnectionState('disconnected');
          console.error('Admin verification realtime error');
        }
      }
    );

    subscribe(
      'admin-fraud-alerts',
      'fraud_alerts',
      (payload) => {
        const alert = payload.new as { risk_score: number; alert_type: string };
        setStats((prev) => ({
          ...prev,
          newFraudAlerts: prev.newFraudAlerts + 1,
        }));

        const risk = (alert as { risk_score: number }).risk_score ?? 0;
        const type = (alert as { alert_type: string }).alert_type;
        const severity = risk >= 80 ? 'error' : risk >= 60 ? 'warning' : 'info';

        if (severity === 'error') {
          toast.error('High Risk Fraud Alert', {
            description: `${type} - Risk Score: ${risk}`,
            duration: 10000,
          });
        } else {
          toast.warning('New Fraud Alert', {
            description: `${type} - Risk Score: ${risk}`,
            duration: 7000,
          });
        }
      },
      () => {
        // Subscribed successfully
      }
    );

    return () => {
      disposed = true;
      activeChannels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [user]);

  const resetStats = () => {
    setStats({ newVerifications: 0, newFraudAlerts: 0 });
  };

  return { stats, connectionState, resetStats };
}
