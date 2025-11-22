import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Clock, AlertTriangle, Eye, ShieldAlert, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface WithdrawalData {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  bank_name: string | null;
  account_number: string | null;
  account_holder_name: string | null;
  created_at: string;
  processed_at: string | null;
  rejection_reason: string | null;
  risk_score: number;
  auto_approved: boolean;
  notes: string | null;
  profiles: {
    full_name: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
  wallet_balance?: number;
}

export function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalData | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchWithdrawals();
    
    // Set up realtime subscription
    const channel = supabase
      .channel('admin-withdrawals')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'withdrawal_requests'
      }, () => {
        fetchWithdrawals();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchWithdrawals = async () => {
    try {
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .order('created_at', { ascending: false});

      if (error) throw error;

      // Fetch profiles and wallet balances for each withdrawal
      const withdrawalsWithData = await Promise.all(
        (data || []).map(async (w) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url, is_verified')
            .eq('id', w.user_id)
            .single();

          const { data: wallet } = await supabase
            .from('wallets')
            .select('balance')
            .eq('user_id', w.user_id)
            .single();
          
          return {
            ...w,
            profiles: profile || { full_name: 'Unknown', avatar_url: null, is_verified: false },
            wallet_balance: wallet?.balance || 0
          };
        })
      );

      setWithdrawals(withdrawalsWithData);
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
      toast.error('Failed to load withdrawals');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selectedWithdrawal || !actionType) return;

    setProcessing(selectedWithdrawal.id);
    try {
      const { data, error } = await supabase.functions.invoke('process-withdrawal', {
        body: {
          withdrawalId: selectedWithdrawal.id,
          action: actionType,
          notes: notes || undefined,
          rejectionReason: actionType === 'reject' ? rejectionReason : undefined
        }
      });

      console.log('Withdrawal response:', { data, error });

      if (error) {
        console.error('Withdrawal error:', error);
        // Map errors to user-friendly messages
        if (error.message?.includes('Insufficient balance')) {
          toast.error("User doesn't have enough balance. Please verify wallet.");
        } else if (error.message?.includes('limit exceeded')) {
          toast.error("Transaction limit exceeded for this user.");
        } else if (error.message?.includes('already')) {
          toast.error("This withdrawal was already processed.");
        } else {
          toast.error(error.message || 'Failed to process withdrawal');
        }
        return;
      }

      if (!data?.success) {
        const errorMsg = data?.error || 'Failed to process withdrawal';
        console.error('Withdrawal failed:', data);
        
        // Provide context for admins
        if (errorMsg.includes('Insufficient balance')) {
          const details = data?.details;
          toast.error(`Insufficient balance. Current: RM${details?.current_balance || 0}, Required: RM${details?.required || 0}`);
        } else if (errorMsg.includes('limit exceeded')) {
          toast.error(`Transaction limit: ${data?.details?.reason || errorMsg}`);
        } else {
          toast.error(errorMsg);
        }
        return;
      }

      // Success with details
      // Optimistically update local state
      setWithdrawals(prev => prev.filter(w => w.id !== selectedWithdrawal.id));
      
      if (actionType === 'approve') {
        const deducted = data.deducted || 0;
        const fee = data.processingFee || 0;
        toast.success('Withdrawal Approved!', {
          description: `Deducted RM${deducted.toFixed(2)} (RM${fee.toFixed(2)} fee included)`
        });
      } else {
        toast.success('Withdrawal rejected successfully');
      }
      
      setSelectedWithdrawal(null);
      setActionType(null);
      setNotes('');
      setRejectionReason('');
      
      // Refetch in background to ensure sync
      fetchWithdrawals();
    } catch (error: any) {
      console.error('Unexpected error:', error);
      toast.error('An unexpected error occurred. Please try again.');
      // Refetch to restore correct state
      fetchWithdrawals();
    } finally {
      setProcessing(null);
    }
  };

  const getRiskBadge = (score: number) => {
    if (score >= 50) {
      return <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-3 w-3" />High Risk</Badge>;
    } else if (score >= 30) {
      return <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" />Medium Risk</Badge>;
    } else {
      return <Badge variant="default" className="gap-1">Low Risk</Badge>;
    }
  };

  const getStatusBadge = (status: string, autoApproved: boolean) => {
    const config: Record<string, any> = {
      pending: { variant: 'secondary', icon: Clock, color: 'text-yellow-600' },
      approved: { variant: 'default', icon: CheckCircle, color: 'text-green-600' },
      rejected: { variant: 'destructive', icon: XCircle, color: 'text-red-600' },
      processing: { variant: 'outline', icon: Clock, color: 'text-blue-600' }
    };

    const statusConfig = config[status] || config.pending;
    const Icon = statusConfig.icon;

    return (
      <div className="flex items-center gap-2">
        <Badge variant={statusConfig.variant} className="gap-1">
          <Icon className={`w-3 h-3 ${statusConfig.color}`} />
          {status}
        </Badge>
        {autoApproved && <Badge variant="outline">Auto</Badge>}
      </div>
    );
  };

  const filterByStatus = (status: string) => {
    if (status === 'all') return withdrawals;
    return withdrawals.filter(w => w.status === status);
  };

  const [activeFilter, setActiveFilter] = useState('pending');
  const filteredWithdrawals = filterByStatus(activeFilter);

  if (loading) {
    return <div className="text-center py-8">Loading withdrawals...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {[
          { key: 'pending', label: 'Pending', count: withdrawals.filter(w => w.status === 'pending').length },
          { key: 'approved', label: 'Approved', count: withdrawals.filter(w => w.status === 'approved').length },
          { key: 'rejected', label: 'Rejected', count: withdrawals.filter(w => w.status === 'rejected').length },
          { key: 'all', label: 'All', count: withdrawals.length }
        ].map(({ key, label, count }) => (
          <Button
            key={key}
            variant={activeFilter === key ? 'default' : 'outline'}
            onClick={() => setActiveFilter(key)}
            className="gap-2"
          >
            {label}
            <Badge variant="secondary">{count}</Badge>
          </Button>
        ))}
      </div>

      {/* Withdrawals List */}
      {filteredWithdrawals.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No withdrawals found</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredWithdrawals.map((withdrawal) => (
            <Card key={withdrawal.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <Avatar>
                    <AvatarImage src={withdrawal.profiles.avatar_url || ''} />
                    <AvatarFallback>{withdrawal.profiles.full_name[0]}</AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{withdrawal.profiles.full_name}</h3>
                      {withdrawal.profiles.is_verified && (
                        <Badge variant="outline" className="text-xs">✓ Verified</Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Amount</p>
                        <p className="font-semibold text-lg">RM {withdrawal.amount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Current Balance</p>
                        <p className="font-semibold">RM {withdrawal.wallet_balance?.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Bank</p>
                        <p>{withdrawal.bank_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Account</p>
                        <p>{withdrawal.account_number ? `****${withdrawal.account_number.slice(-4)}` : 'N/A'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(withdrawal.created_at), 'MMM dd, yyyy HH:mm')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {getStatusBadge(withdrawal.status, withdrawal.auto_approved)}
                  {getRiskBadge(withdrawal.risk_score)}
                  
                  {withdrawal.status === 'pending' && (
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {
                          setSelectedWithdrawal(withdrawal);
                          setActionType('approve');
                        }}
                        disabled={!!processing}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setSelectedWithdrawal(withdrawal);
                          setActionType('reject');
                        }}
                        disabled={!!processing}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {withdrawal.rejection_reason && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded">
                  <p className="text-sm font-semibold">Rejection Reason:</p>
                  <p className="text-sm">{withdrawal.rejection_reason}</p>
                </div>
              )}

              {withdrawal.notes && (
                <div className="mt-4 p-3 bg-muted rounded">
                  <p className="text-sm font-semibold">Admin Notes:</p>
                  <p className="text-sm">{withdrawal.notes}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog 
        open={!!selectedWithdrawal && !!actionType} 
        onOpenChange={() => {
          setSelectedWithdrawal(null);
          setActionType(null);
          setNotes('');
          setRejectionReason('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'approve' ? 'Approve Withdrawal' : 'Reject Withdrawal'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                Are you sure you want to {actionType} this withdrawal of{' '}
                <strong>RM {selectedWithdrawal?.amount.toFixed(2)}</strong> for{' '}
                <strong>{selectedWithdrawal?.profiles.full_name}</strong>?
              </p>

              {actionType === 'approve' && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-900 text-sm">
                  <p className="font-semibold">⚠️ This will deduct RM {selectedWithdrawal?.amount.toFixed(2)} from the user's wallet immediately.</p>
                  <p className="mt-1">Current balance: RM {selectedWithdrawal?.wallet_balance?.toFixed(2)}</p>
                </div>
              )}

              {actionType === 'reject' && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Rejection Reason (required)</label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain why this withdrawal was rejected..."
                    className="min-h-[100px]"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-semibold">Admin Notes (optional)</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any internal notes..."
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              disabled={!!processing || (actionType === 'reject' && !rejectionReason)}
              className={actionType === 'reject' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {processing ? 'Processing...' : `Confirm ${actionType === 'approve' ? 'Approval' : 'Rejection'}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}