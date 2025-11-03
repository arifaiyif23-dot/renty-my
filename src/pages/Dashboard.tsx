import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Rental } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { RentalCard } from '@/components/RentalCard';
import { StatusBadge } from '@/components/StatusBadge';
import { CountdownTimer } from '@/components/CountdownTimer';
import { Clock, CheckCircle, XCircle } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchRentals();
    }
  }, [user]);

  const fetchRentals = async () => {
    try {
      const { data, error } = await supabase
        .from('rentals')
        .select(`
          *,
          item:items(*),
          renter:profiles!rentals_renter_id_fkey(*),
          owner:profiles!rentals_owner_id_fkey(*)
        `)
        .or(`renter_id.eq.${user?.id},owner_id.eq.${user?.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRentals(data || []);
    } catch (error: any) {
      toast.error('Failed to load rentals');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const updateRentalStatus = async (rentalId: string, status: Rental['status']) => {
    try {
      const rental = rentals.find(r => r.id === rentalId);
      if (!rental) throw new Error('Rental not found');

      // Handle completion confirmation
      if (status === 'completed') {
        const isOwner = rental.owner_id === user?.id;
        const confirmField = isOwner ? 'owner_confirmed_completion' : 'renter_confirmed_completion';
        const otherConfirmed = isOwner ? rental.renter_confirmed_completion : rental.owner_confirmed_completion;
        const alreadyConfirmed = isOwner ? rental.owner_confirmed_completion : rental.renter_confirmed_completion;

        if (alreadyConfirmed) {
          toast.info('You have already confirmed completion');
          return;
        }

        // Update confirmation status
        const updateData: any = { [confirmField]: true };
        
        // If other party has already confirmed, mark as completed
        if (otherConfirmed) {
          updateData.status = 'completed';
        }

        const { error } = await supabase
          .from('rentals')
          .update(updateData)
          .eq('id', rentalId);

        if (error) throw error;

        // Only process payment if both parties confirmed
        if (otherConfirmed) {
          try {
            const { error: paymentError } = await supabase.functions.invoke('process-rental-payment', {
              body: { rentalId }
            });

            if (paymentError) {
              console.error('Payment processing error:', paymentError);
              toast.error('Rental completed but payment processing failed. Please contact support.');
            } else {
              toast.success('Rental completed and payment processed!');
            }
          } catch (paymentError) {
            console.error('Payment processing failed:', paymentError);
            toast.error('Rental completed but payment processing failed. Please contact support.');
          }
        } else {
          toast.success('Completion confirmed. Waiting for the other party.');
        }
      } else {
        // Regular status update
        const { error } = await supabase
          .from('rentals')
          .update({ status })
          .eq('id', rentalId);

        if (error) throw error;
        toast.success(`Rental ${status}`);
      }
      
      fetchRentals();
    } catch (error: any) {
      toast.error('Failed to update rental');
      console.error(error);
    }
  };

  const filterRentals = (status: string[]) => {
    return rentals.filter(r => status.includes(r.status));
  };

  if (loading) {
    return <div className="container mx-auto p-4">Loading...</div>;
  }

  const activeCount = filterRentals(['approved', 'active']).length;
  const pendingCount = filterRentals(['pending']).length;
  const pastCount = filterRentals(['completed', 'cancelled', 'rejected']).length;

  return (
    <>
      <Header />
      <div className="container mx-auto p-4 pb-20 md:pb-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-foreground">My Rentals</h1>
          <div className="flex gap-2">
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {activeCount} Active
            </Badge>
            <Badge variant="secondary" className="gap-1">
              {pendingCount} Pending
            </Badge>
          </div>
        </div>
      
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="bg-muted/20">
          <TabsTrigger value="active" className="data-[state=active]:bg-card data-[state=active]:text-foreground">Active</TabsTrigger>
          <TabsTrigger value="pending" className="data-[state=active]:bg-card data-[state=active]:text-foreground">Pending</TabsTrigger>
          <TabsTrigger value="past" className="data-[state=active]:bg-card data-[state=active]:text-foreground">Past</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="space-y-4">
          {filterRentals(['approved', 'active']).map(rental => (
            <RentalCard 
              key={rental.id} 
              rental={rental}
              isOwner={rental.owner_id === user?.id}
              onStatusUpdate={updateRentalStatus}
              onReviewSuccess={fetchRentals}
            />
          ))}
        </TabsContent>
        
        <TabsContent value="pending" className="space-y-4">
          {filterRentals(['pending']).map(rental => (
            <RentalCard 
              key={rental.id} 
              rental={rental}
              isOwner={rental.owner_id === user?.id}
              onStatusUpdate={updateRentalStatus}
              onReviewSuccess={fetchRentals}
            />
          ))}
        </TabsContent>
        
        <TabsContent value="past" className="space-y-4">
          {filterRentals(['completed', 'cancelled', 'rejected']).map(rental => (
            <RentalCard 
              key={rental.id} 
              rental={rental}
              isOwner={rental.owner_id === user?.id}
              onStatusUpdate={updateRentalStatus}
              onReviewSuccess={fetchRentals}
            />
          ))}
        </TabsContent>
      </Tabs>
      </div>
    </>
  );
}
