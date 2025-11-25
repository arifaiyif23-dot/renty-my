import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Rental } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { RentalCard } from '@/components/RentalCard';
import { IncomingRequests } from '@/components/IncomingRequests';
import { StatusBadge } from '@/components/StatusBadge';
import { CountdownTimer } from '@/components/CountdownTimer';
import { Clock, CheckCircle, XCircle, Calendar as CalendarIcon, GitBranch } from 'lucide-react';
import { RentalTimeline } from '@/components/RentalTimeline';
import { BulkActionsBar } from '@/components/BulkActionsBar';
import { RentalCalendarView } from '@/components/RentalCalendarView';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function Dashboard() {
  const { user } = useAuth();
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRentals, setSelectedRentals] = useState<Set<string>>(new Set());
  const [selectedRentalTimeline, setSelectedRentalTimeline] = useState<Rental | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);

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
      setRentals((data || []) as Rental[]);
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

      // Update rental status
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

  const toggleRentalSelection = (rentalId: string) => {
    setSelectedRentals(prev => {
      const next = new Set(prev);
      if (next.has(rentalId)) {
        next.delete(rentalId);
      } else {
        next.add(rentalId);
      }
      return next;
    });
  };

  const handleBulkComplete = async () => {
    const confirmations = Array.from(selectedRentals).map(async (rentalId) => {
      await updateRentalStatus(rentalId, 'completed');
    });
    
    await Promise.all(confirmations);
    setSelectedRentals(new Set());
    toast.success(`${selectedRentals.size} rentals marked for completion`);
  };

  const handleBulkCancel = async () => {
    const cancellations = Array.from(selectedRentals).map(async (rentalId) => {
      await updateRentalStatus(rentalId, 'cancelled');
    });
    
    await Promise.all(cancellations);
    setSelectedRentals(new Set());
    toast.success(`${selectedRentals.size} rentals cancelled`);
  };

  if (loading) {
    return <div className="container mx-auto p-4">Loading...</div>;
  }

  const activeCount = filterRentals(['paid', 'active']).length;
  const pendingCount = filterRentals(['pending_approval', 'approved']).length;
  const pastCount = filterRentals(['completed', 'cancelled', 'rejected']).length;

  return (
    <>
      <Header />
      <div className="container mx-auto p-4 pb-20 md:pb-4">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <h1 className="text-3xl font-bold text-foreground">My Rentals</h1>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {activeCount} Active
            </Badge>
            <Badge variant="secondary" className="gap-1">
              {pendingCount} Pending
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCalendar(true)}
            >
              <CalendarIcon className="h-4 w-4 mr-2" />
              Calendar View
            </Button>
          </div>
        </div>

        {/* Incoming Requests for Owners */}
        {rentals.some(r => r.status === 'pending_approval' && r.owner_id === user?.id) && (
          <div className="mb-6">
            <IncomingRequests 
              rentals={rentals.filter(r => r.owner_id === user?.id)} 
              onUpdate={fetchRentals} 
            />
          </div>
        )}
      
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="bg-muted/20">
          <TabsTrigger value="active" className="data-[state=active]:bg-card data-[state=active]:text-foreground">Active</TabsTrigger>
          <TabsTrigger value="pending" className="data-[state=active]:bg-card data-[state=active]:text-foreground">Pending</TabsTrigger>
          <TabsTrigger value="past" className="data-[state=active]:bg-card data-[state=active]:text-foreground">Past</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="space-y-4">
          {filterRentals(['paid', 'active']).map(rental => (
            <div key={rental.id} className="relative">
              <div className="absolute left-4 top-4 z-10">
                <Checkbox
                  checked={selectedRentals.has(rental.id)}
                  onCheckedChange={() => toggleRentalSelection(rental.id)}
                  className="bg-card"
                />
              </div>
              <RentalCard 
                rental={rental}
                isOwner={rental.owner_id === user?.id}
                onStatusUpdate={updateRentalStatus}
                onReviewSuccess={fetchRentals}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRentalTimeline(rental)}
                className="mt-2"
              >
                <GitBranch className="h-4 w-4 mr-2" />
                View Timeline
              </Button>
            </div>
          ))}
        </TabsContent>
        
        <TabsContent value="pending" className="space-y-4">
          {filterRentals(['pending_approval', 'approved']).map(rental => (
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
          {filterRentals(['completed', 'cancelled', 'rejected', 'disputed']).map(rental => (
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

      <BulkActionsBar
        selectedCount={selectedRentals.size}
        onClearSelection={() => setSelectedRentals(new Set())}
        onBulkComplete={handleBulkComplete}
        onBulkCancel={handleBulkCancel}
        showComplete={true}
        showCancel={true}
      />

      {/* Timeline Dialog */}
      <Dialog open={!!selectedRentalTimeline} onOpenChange={() => setSelectedRentalTimeline(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Rental Timeline</DialogTitle>
          </DialogHeader>
          {selectedRentalTimeline && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{selectedRentalTimeline.item?.title || 'Item'}</CardTitle>
                </CardHeader>
                <CardContent>
                  <RentalTimeline rental={selectedRentalTimeline} />
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Calendar Dialog */}
      <Dialog open={showCalendar} onOpenChange={setShowCalendar}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rental Calendar</DialogTitle>
          </DialogHeader>
          <RentalCalendarView rentals={rentals} />
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}
