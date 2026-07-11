import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Gift, Share2, Copy, Users, TrendingUp, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Referral {
  id: string;
  referral_code: string;
  status: string;
  referee_id: string | null;
  created_at: string;
  profiles?: {
    full_name: string;
  };
}

export const ReferralSystem = () => {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState("");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, earnings: 0 });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      fetchOrCreateReferralCode();
      fetchReferrals();
    }
  }, [user]);

  const fetchOrCreateReferralCode = async () => {
    if (!user) return;

    try {
      // Check if user already has a referral code
      const { data: existing, error: fetchError } = await supabase
        .from('referrals')
        .select('referral_code')
        .eq('referrer_id', user.id)
        .is('referee_id', null)
        .single();

      if (existing && !fetchError) {
        setReferralCode(existing.referral_code);
      } else {
        // Generate new code
        const { data: newCode } = await supabase.rpc('generate_referral_code');
        
        if (newCode) {
          // Create referral entry
          const { error: insertError } = await supabase
            .from('referrals')
            .insert({
              referrer_id: user.id,
              referral_code: newCode,
              status: 'pending'
            });

          if (!insertError) {
            setReferralCode(newCode);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching/creating referral code:', error);
    }
  };

  const fetchReferrals = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('referrals')
        .select('id, referral_code, status, referee_id, created_at, referrer_reward')
        .eq('referrer_id', user.id)
        .not('referee_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch referee profiles separately
      const referralsWithProfiles = await Promise.all(
        (data || []).map(async (referral) => {
          if (referral.referee_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', referral.referee_id)
              .single();
            
            return { ...referral, profiles: profile };
          }
          return { ...referral, profiles: null };
        })
      );

      setReferrals(referralsWithProfiles as Referral[]);

      // Calculate stats
      const completed = data?.filter(r => r.status === 'rewarded').length || 0;
      const earnings = completed * 20; // RM 20 per completed referral
      setStats({
        total: data?.length || 0,
        completed,
        earnings,
      });
    } catch (error) {
      console.error('Error fetching referrals:', error);
    }
  };

  const copyToClipboard = () => {
    const referralLink = `${window.location.origin}/?ref=${referralCode}`;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const shareViaWhatsApp = () => {
    const referralLink = `${window.location.origin}/?ref=${referralCode}`;
    const message = `Join RENTY and get RM 10 credit! Use my referral code: ${referralCode}\n${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  if (!user) return null;

  const referralLink = `${window.location.origin}/?ref=${referralCode}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Gift className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-2xl font-bold">Referral Program</h2>
          <p className="text-sm text-muted-foreground">
            Earn RM 20 for each friend who completes their first rental
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Referrals</p>
              <p className="text-3xl font-bold">{stats.total}</p>
            </div>
            <Users className="w-10 h-10 text-primary/20" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-3xl font-bold">{stats.completed}</p>
            </div>
            <Check className="w-10 h-10 text-green-500/20" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Earnings</p>
              <p className="text-3xl font-bold">RM {stats.earnings}</p>
            </div>
            <TrendingUp className="w-10 h-10 text-primary/20" />
          </div>
        </Card>
      </div>

      {/* Share Section */}
      <Card className="p-6 space-y-4">
        <h3 className="font-semibold text-lg">Your Referral Link</h3>
        
        <div className="flex gap-2">
          <Input value={referralLink} readOnly className="flex-1" />
          <Button onClick={copyToClipboard} variant="outline">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>

        <div className="flex gap-2">
          <Button onClick={shareViaWhatsApp} className="flex-1">
            <Share2 className="w-4 h-4 mr-2" />
            Share via WhatsApp
          </Button>
        </div>

        <div className="bg-muted p-4 rounded-lg space-y-2">
          <p className="font-semibold text-sm">How it works:</p>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• Your friend signs up using your referral link</li>
            <li>• They get RM 10 credit instantly</li>
            <li>• You get RM 20 credit after their first rental</li>
          </ul>
        </div>
      </Card>

      {/* Referral List */}
      {referrals.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold text-lg mb-4">Your Referrals</h3>
          <div className="space-y-3">
            {referrals.map((referral) => (
              <div key={referral.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{referral.profiles?.full_name || 'New User'}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(referral.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={referral.status === 'rewarded' ? 'default' : 'secondary'}>
                  {referral.status === 'rewarded' ? 'Earned RM 20' : 'Pending'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
