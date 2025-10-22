import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Rental } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';

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
      toast.success(`Rental ${status}`);
      fetchRentals();
    } catch (error: any) {
      toast.error('Failed to update rental');
      console.error(error);
    }
  };

  const filterRentals = (status: string[]) => {
    return rentals.filter(r => status.includes(r.status));
  };

  const RentalCard = ({ rental }: { rental: Rental }) => {
    const isOwner = rental.owner_id === user?.id;
    
    return (
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg">{rental.item?.title}</CardTitle>
            <Badge>{rental.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm space-y-1">
            <p><strong>Dates:</strong> {format(new Date(rental.start_date), 'MMM d, yyyy')} - {format(new Date(rental.end_date), 'MMM d, yyyy')}</p>
            <p><strong>Total:</strong> RM {rental.total_price}</p>
            <p><strong>{isOwner ? 'Renter' : 'Owner'}:</strong> {isOwner ? rental.renter?.full_name : rental.owner?.full_name}</p>
          </div>
          
          {isOwner && rental.status === 'pending' && (
            <div className="flex gap-2">
              <Button 
                size="sm" 
                onClick={() => updateRentalStatus(rental.id, 'approved')}
              >
                Approve
              </Button>
              <Button 
                size="sm" 
                variant="destructive"
                onClick={() => updateRentalStatus(rental.id, 'rejected')}
              >
                Reject
              </Button>
            </div>
          )}
          
          {rental.status === 'approved' && (
            <Button 
              size="sm" 
              onClick={() => updateRentalStatus(rental.id, 'active')}
            >
              Mark as Active
            </Button>
          )}
          
          {rental.status === 'active' && (
            <Button 
              size="sm" 
              onClick={() => updateRentalStatus(rental.id, 'completed')}
            >
              Complete Rental
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return <div className="container mx-auto p-4">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">My Rentals</h1>
      
      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="space-y-4">
          {filterRentals(['approved', 'active']).map(rental => (
            <RentalCard key={rental.id} rental={rental} />
          ))}
        </TabsContent>
        
        <TabsContent value="pending" className="space-y-4">
          {filterRentals(['pending']).map(rental => (
            <RentalCard key={rental.id} rental={rental} />
          ))}
        </TabsContent>
        
        <TabsContent value="past" className="space-y-4">
          {filterRentals(['completed', 'cancelled', 'rejected']).map(rental => (
            <RentalCard key={rental.id} rental={rental} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
