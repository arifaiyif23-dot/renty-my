import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Listen for auth changes (handles cross-tab sign-in/out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) {
        setProfile(null);
        setLoading(false);
      }
    });

    // Check active session
    supabase.auth.getSession().then(({ data }) => {
      const session = data?.session ?? null;
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) {
        setLoading(false);
      }
    }).catch((err) => {
      console.error('Failed to get session:', err);
      setError('Unable to connect. Please check your connection and try again.');
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Single source of fetch — runs when user resolves from getSession OR cross-tab sign-in
  useEffect(() => {
    if (user) {
      fetchProfile(user.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Realtime: keep profile in sync so verified badge / permissions update without refresh
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`profile-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          const newData = payload.new as Record<string, unknown>;
          setProfile((prev) => (prev ? { ...prev, ...newData } : newData) as Profile);
        }
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
          console.error('Failed to subscribe to profile changes:', status);
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Refetch profile when returning to the page (catches updates missed by Realtime)
  useEffect(() => {
    if (!user?.id) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchProfile(user.id);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user?.id]);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, phone, location, is_verified, verification_level, trust_score, is_suspended, preferred_role, created_at, total_rentals_completed, total_reviews_received, response_rate, avg_response_time_minutes, last_active_at')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setError('Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string, preferredRole?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          preferred_role: preferredRole || 'renter',
        },
      },
    });
    if (error) throw error;
    
    // Send welcome email
    if (data.user) {
      try {
        await supabase.functions.invoke('send-welcome-email', {
          body: { 
            userId: data.user.id, 
            email: email,
            fullName: fullName 
          }
        });
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
        // Don't throw - user signup succeeded
      }
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setUser(null);
      setProfile(null);
      setSession(null);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, error, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
