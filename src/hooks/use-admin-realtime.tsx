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

    let verificationChannel: ReturnType<typeof supabase.channel> | null = null;
    let fraudChannel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtime = async () => {
      // Subscribe to new verification requests
      verificationChannel = supabase
        .channel('admin-verifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'verification_requests',
          },
          (payload) => {
            console.log('New verification request:', payload);
            const verification = payload.new as any;
            
            setStats(prev => ({
              ...prev,
              newVerifications: prev.newVerifications + 1,
            }));

            toast.info('New Verification Request', {
              description: `${verification.full_name_on_document} submitted ${verification.document_type} verification`,
              duration: 5000,
            });
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setConnectionState('connected');
            console.log('Admin verification realtime connected');
          } else if (status === 'CLOSED') {
            setConnectionState('disconnected');
          } else if (status === 'CHANNEL_ERROR') {
            setConnectionState('disconnected');
            console.error('Admin verification realtime error');
          }
        });

      // Subscribe to new fraud alerts
      fraudChannel = supabase
        .channel('admin-fraud-alerts')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'fraud_alerts',
          },
          (payload) => {
            console.log('New fraud alert:', payload);
            const alert = payload.new as any;
            
            setStats(prev => ({
              ...prev,
              newFraudAlerts: prev.newFraudAlerts + 1,
            }));

            const severity = alert.risk_score >= 80 ? 'error' : alert.risk_score >= 60 ? 'warning' : 'info';
            
            if (severity === 'error') {
              toast.error('High Risk Fraud Alert', {
                description: `${alert.alert_type} - Risk Score: ${alert.risk_score}`,
                duration: 10000,
              });
            } else {
              toast.warning('New Fraud Alert', {
                description: `${alert.alert_type} - Risk Score: ${alert.risk_score}`,
                duration: 7000,
              });
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Admin fraud alerts realtime connected');
          }
        });
    };

    setupRealtime();

    return () => {
      if (verificationChannel) {
        supabase.removeChannel(verificationChannel);
      }
      if (fraudChannel) {
        supabase.removeChannel(fraudChannel);
      }
    };
  }, [user]);

  const resetStats = () => {
    setStats({ newVerifications: 0, newFraudAlerts: 0 });
  };

  return { stats, connectionState, resetStats };
}
