import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    verifyAdminAccess();
  }, []);

  const verifyAdminAccess = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-admin');
      
      if (error) {
        console.error('Admin verification error:', error);
        setIsAdmin(false);
        toast.error('Failed to verify admin access');
      } else {
        setIsAdmin(data?.isAdmin === true);
      }
    } catch (error) {
      console.error('Admin verification error:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    toast.error('Access denied. Admin privileges required.');
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
