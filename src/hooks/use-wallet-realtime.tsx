import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface WalletTransaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  status: string;
  created_at: string;
}

/**
 * Hook for real-time wallet updates
 * Subscribes to wallet_transactions table changes
 */
export function useWalletRealtime() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionState, setConnectionState] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtime = async () => {
      // Fetch initial balance
      const { data: wallet } = await supabase
        .from('wallets')
        .select('id, balance')
        .eq('user_id', user.id)
        .single();

      if (wallet) {
        setBalance(wallet.balance);

        // Subscribe to real-time updates
        channel = supabase
          .channel(`wallet:${user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'wallet_transactions',
              filter: `wallet_id=eq.${wallet.id}`,
            },
            async (payload) => {
              console.log('Wallet transaction update:', payload);

              const transaction = payload.new as WalletTransaction;

              // Refetch balance on any transaction change
              const { data: updatedWallet } = await supabase
                .from('wallets')
                .select('balance')
                .eq('user_id', user.id)
                .single();

              if (updatedWallet) {
                setBalance(updatedWallet.balance);

                // Show toast notification for completed transactions
                if (transaction.status === 'completed') {
                  if (transaction.type === 'deposit') {
                    toast.success('Wallet Topped Up', {
                      description: `RM ${transaction.amount.toFixed(2)} added to your wallet`,
                    });
                  } else if (transaction.type === 'rental_earning') {
                    toast.success('Payment Received', {
                      description: transaction.description,
                    });
                  } else if (transaction.type === 'rental_payment') {
                    toast.info('Payment Processed', {
                      description: transaction.description,
                    });
                  }
                }
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              setConnectionState('connected');
              console.log('Wallet realtime connected');
            } else if (status === 'CLOSED') {
              setConnectionState('disconnected');
              console.log('Wallet realtime disconnected');
            } else if (status === 'CHANNEL_ERROR') {
              setConnectionState('disconnected');
              console.error('Wallet realtime error');
            }
          });
      }
      
      setLoading(false);
    };

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user]);

  return { balance, loading, connectionState };
}
