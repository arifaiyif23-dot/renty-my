import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { DollarSign, Loader2, CheckCircle, XCircle, Clock, Filter } from 'lucide-react';
import { AdminLayout } from '@/components/AdminLayout';
import { invokeAdminOperation } from '@/lib/adminOperations';
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
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface Payout {
  id: string;
  rental_id: string;
  owner_id: string;
  payout_amount: number;
  rental_amount: number;
  platform_fee: number;
  status: string;
  bank_name: string | null;
  account_number: string | null;
  account_holder_name: string | null;
  created_at: string;
  processed_at: string | null;
  failure_reason: string | null;
  owner: {
    full_name: string;
    phone: string | null;
  };
}

export default function AdminPayouts() {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showFailDialog, setShowFailDialog] = useState(false);
  const [transactionRef, setTransactionRef] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchPayouts();
  }, []);

  const fetchPayouts = async () => {
    try {
      const { data, error } = await supabase
        .from('payouts')
        .select(`
          *,
          owner:profiles!owner_id(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayouts(data || []);
    } catch (error) {
      console.error('Error fetching payouts:', error);
      toast.error('Failed to load payouts');
    } finally {
      setLoading(false);
    }
  };

  const handleCompletePayout = async () => {
    if (!selectedPayout || !transactionRef) {
      toast.error('Please enter transaction reference');
      return;
    }

    setProcessing(true);
    try {
      await invokeAdminOperation({ action: 'process_payout', payoutId: selectedPayout.id, status: 'completed', transactionReference: transactionRef });

      toast.success('Payout marked as completed');
      setShowCompleteDialog(false);
      setTransactionRef('');
      setSelectedPayout(null);
      fetchPayouts();
    } catch (error: unknown) {
      console.error('Error completing payout:', error);
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const handleFailPayout = async () => {
    if (!selectedPayout || !failureReason) {
      toast.error('Please enter failure reason');
      return;
    }

    setProcessing(true);
    try {
      await invokeAdminOperation({ action: 'process_payout', payoutId: selectedPayout.id, status: 'failed', failureReason });

      toast.success('Payout marked as failed');
      setShowFailDialog(false);
      setFailureReason('');
      setSelectedPayout(null);
      fetchPayouts();
    } catch (error: unknown) {
      console.error('Error failing payout:', error);
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const filteredPayouts = payouts.filter(p => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  const stats = {
    totalPending: payouts.filter(p => p.status === 'pending').length,
    totalCompleted: payouts.filter(p => p.status === 'completed').length,
    totalAmount: payouts.reduce((sum, p) => sum + parseFloat(p.payout_amount.toString()), 0),
    platformRevenue: payouts.filter(p => p.status === 'completed').reduce((sum, p) => sum + parseFloat(p.platform_fee.toString()), 0)
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      held: { label: 'Held', variant: 'secondary' as const, icon: Clock },
      awaiting_bank_details: { label: 'Awaiting Bank', variant: 'secondary' as const, icon: XCircle },
      pending: { label: 'Ready', variant: 'default' as const, icon: Clock },
      completed: { label: 'Paid', variant: 'default' as const, icon: CheckCircle },
      failed: { label: 'Failed', variant: 'destructive' as const, icon: XCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, variant: 'default' as const, icon: Clock };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1 rounded-full">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <DollarSign className="h-8 w-8" />
              Payout Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Process and manage owner payouts
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="card-base rounded-lg p-5">
              <p className="text-sm text-muted-foreground mb-1">Pending Payouts</p>
              <div className="text-2xl font-bold">{stats.totalPending}</div>
            </div>

            <div className="card-base rounded-lg p-5">
              <p className="text-sm text-muted-foreground mb-1">Completed</p>
              <div className="text-2xl font-bold">{stats.totalCompleted}</div>
            </div>

            <div className="card-base rounded-lg p-5">
              <p className="text-sm text-muted-foreground mb-1">Total Payouts</p>
              <div className="text-2xl font-bold">RM {stats.totalAmount.toFixed(2)}</div>
            </div>

            <div className="card-base rounded-lg p-5">
              <p className="text-sm text-muted-foreground mb-1">Platform Revenue</p>
              <div className="text-2xl font-bold text-success">RM {stats.platformRevenue.toFixed(2)}</div>
            </div>
          </div>

          {/* Filters */}
          <div className="card-base rounded-lg p-5 mb-6">
            <div className="flex items-center gap-4">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <div className="flex gap-2">
                {['all', 'held', 'awaiting_bank_details', 'pending', 'completed', 'failed'].map((status) => (
                  <Button className="rounded-lg"
                    key={status}
                    variant={filter === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter(status)}
                  >
                    {status === 'awaiting_bank_details' ? 'No Bank' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Payouts List */}
          <div className="card-base rounded-lg p-5">
            <h3 className="font-semibold mb-1">Payouts</h3>
            <p className="text-sm text-muted-foreground mb-4">{filteredPayouts.length} payout(s)</p>

            {filteredPayouts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No payouts found</p>
              </div>
            ) : (
                <div className="space-y-4">
                  {filteredPayouts.map((payout) => (
                    <div key={payout.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-semibold text-lg mb-1">
                            RM {parseFloat(payout.payout_amount.toString()).toFixed(2)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Owner: {payout.owner?.full_name || "Unknown"}
                          </div>
                        </div>
                        {getStatusBadge(payout.status)}
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                        <div>
                          <span className="text-muted-foreground">Rental Amount:</span>
                          <span className="ml-2 font-medium">RM {parseFloat(payout.rental_amount.toString()).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Platform Fee:</span>
                          <span className="ml-2 font-medium">RM {parseFloat(payout.platform_fee.toString()).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Bank:</span>
                          <span className="ml-2 font-medium">{payout.bank_name || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Account:</span>
                          <span className="ml-2 font-mono text-xs">{payout.account_number ? '****' + payout.account_number.slice(-4) : 'N/A'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Account Holder:</span>
                          <span className="ml-2 font-medium">{payout.account_holder_name || 'N/A'}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Created:</span>
                          <span className="ml-2">{format(new Date(payout.created_at), 'PPp')}</span>
                        </div>
                        {payout.processed_at && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Processed:</span>
                            <span className="ml-2">{format(new Date(payout.processed_at), 'PPp')}</span>
                          </div>
                        )}
                        {payout.failure_reason && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Failure Reason:</span>
                            <span className="ml-2 text-destructive">{payout.failure_reason}</span>
                          </div>
                        )}
                      </div>

                      {payout.status === 'pending' && (
                        <div className="flex gap-2 pt-3 border-t">
                          <Button className="rounded-lg"
                            size="sm"
                            onClick={() => {
                              setSelectedPayout(payout);
                              setShowCompleteDialog(true);
                            }}
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Mark as Paid
                          </Button>
                          <Button className="rounded-lg"
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setSelectedPayout(payout);
                              setShowFailDialog(true);
                            }}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Mark as Failed
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>

        {/* Complete Payout Dialog */}
        <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Complete Payout</AlertDialogTitle>
              <AlertDialogDescription>
                Confirm that you have transferred RM {selectedPayout && parseFloat(selectedPayout.payout_amount.toString()).toFixed(2)} to the owner's bank account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="transaction_ref">Transaction Reference Number</Label>
                <Input className="rounded-lg"
                  id="transaction_ref"
                  placeholder="e.g., TXN123456789"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setShowCompleteDialog(false);
                setTransactionRef('');
                setSelectedPayout(null);
              }}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleCompletePayout} disabled={processing || !transactionRef}>
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Confirm Payment'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Fail Payout Dialog */}
        <AlertDialog open={showFailDialog} onOpenChange={setShowFailDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mark Payout as Failed</AlertDialogTitle>
              <AlertDialogDescription>
                Please provide a reason for the failed payout. The owner will be notified.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="failure_reason">Failure Reason</Label>
                <Textarea
                  id="failure_reason"
                  placeholder="e.g., Invalid bank account, insufficient funds, etc."
                  value={failureReason}
                  onChange={(e) => setFailureReason(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setShowFailDialog(false);
                setFailureReason('');
                setSelectedPayout(null);
              }}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleFailPayout} disabled={processing || !failureReason}>
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Mark as Failed'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AdminLayout>
  );
}
