import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { AppRole } from '@/types';

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    verifyAdminAccess();
  }, []);

  // Show the access-denied toast exactly once, when verification resolves to
  // "not an admin" — previously it fired during render on every re-render.
  useEffect(() => {
    if (!loading && isAdmin === false) {
      toast.error('Access denied. Admin privileges required.');
    }
  }, [loading, isAdmin]);

  const verifyAdminAccess = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const { data, error } = await supabase.functions.invoke('verify-admin', {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (error) {
        console.error('Admin verification error:', error);
        setIsAdmin(false);
        toast.error('Failed to verify admin access');
      } else {
        setIsAdmin(data?.isAdmin === true);
      }
    } catch (error) {
      console.error('Admin verification error:', error);
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.error('Connection timeout. Please check your network and try again.');
      }
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
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminRole() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    supabase.functions.invoke('verify-admin', { signal: controller.signal })
      .then(({ data }) => {
        setRole(data?.role || null);
      })
      .catch((error) => {
        console.error('Admin role check error:', error);
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setLoading(false);
      });

    return () => controller.abort();
  }, []);

  return { role, isSuperAdmin: role === 'super_admin', loading };
}
