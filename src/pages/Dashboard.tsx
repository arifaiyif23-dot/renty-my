import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Rental } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { RentalCard } from '@/components/RentalCard';

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
      const { error } = await supabase
        .from('rentals')
        .update({ status })
        .eq('id', rentalId);

      if (error) throw error;

      // If rental is completed, trigger payment to owner
      if (status === 'completed') {
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

  return (
    <>
      <Header />
      <div className="container mx-auto p-4 pb-mobile-nav">
        <h1 className="text-3xl font-bold mb-6 text-foreground">My Rentals</h1>
      
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
