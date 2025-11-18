import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminRoute } from '@/components/AdminRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { Loader2, Save, Settings, DollarSign, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import Header from '@/components/Header';
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

interface PlatformSetting {
  id: string;
  key: string;
  value: string | number;
  description: string;
}

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Record<string, PlatformSetting>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*');

      if (error) throw error;

      const settingsMap: Record<string, PlatformSetting> = {};
      data?.forEach(setting => {
        settingsMap[setting.key] = {
          ...setting,
          value: typeof setting.value === 'string' ? setting.value : String(setting.value)
        };
      });
      setSettings(settingsMap);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const getSetting = (key: string): number => {
    const value = settings[key]?.value;
    return parseFloat(String(value || '0'));
  };

  const handleChange = (key: string, value: string) => {
    setPendingChanges(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(pendingChanges).map(([key, value]) => ({
        key,
        value: JSON.stringify(value),
        updated_at: new Date().toISOString()
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('platform_settings')
          .update({ value: update.value, updated_at: update.updated_at })
          .eq('key', update.key);

        if (error) throw error;
      }

      toast.success('Settings updated successfully');
      setPendingChanges({});
      await fetchSettings();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
      setShowConfirm(false);
    }
  };

  const getCurrentValue = (key: string): number => {
    return pendingChanges[key] ? parseFloat(pendingChanges[key]) : getSetting(key);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasChanges = Object.keys(pendingChanges).length > 0;

  return (
    <AdminRoute>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Settings className="h-8 w-8" />
                Platform Settings
              </h1>
              <p className="text-muted-foreground mt-2">
                Configure platform fees, limits, and operational parameters
              </p>
            </div>
            <Button
              onClick={() => setShowConfirm(true)}
              disabled={!hasChanges || saving}
              size="lg"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>

          <div className="space-y-6">
            {/* Platform Fee Rate */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Platform Commission
                </CardTitle>
                <CardDescription>
                  Percentage charged on rental transactions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Platform Fee Rate: {(getCurrentValue('platform_fee_rate') * 100).toFixed(1)}%</Label>
                  <Slider
                    value={[getCurrentValue('platform_fee_rate') * 100]}
                    onValueChange={([value]) => handleChange('platform_fee_rate', (value / 100).toFixed(3))}
                    min={0}
                    max={30}
                    step={0.1}
                    className="mt-2"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Example: RM100 rental = RM{(100 * getCurrentValue('platform_fee_rate')).toFixed(2)} platform fee
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Withdrawal Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowDownToLine className="h-5 w-5" />
                  Withdrawal Configuration
                </CardTitle>
                <CardDescription>
                  Set limits and fees for user withdrawals
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="min_withdrawal">Minimum Withdrawal (RM)</Label>
                    <Input
                      id="min_withdrawal"
                      type="number"
                      step="0.01"
                      value={getCurrentValue('min_withdrawal_amount')}
                      onChange={(e) => handleChange('min_withdrawal_amount', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="max_withdrawal">Maximum Withdrawal (RM)</Label>
                    <Input
                      id="max_withdrawal"
                      type="number"
                      step="0.01"
                      value={getCurrentValue('max_withdrawal_amount')}
                      onChange={(e) => handleChange('max_withdrawal_amount', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="withdrawal_fee">Processing Fee (RM)</Label>
                  <Input
                    id="withdrawal_fee"
                    type="number"
                    step="0.01"
                    value={getCurrentValue('withdrawal_processing_fee')}
                    onChange={(e) => handleChange('withdrawal_processing_fee', e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Fixed fee charged per withdrawal
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Top-up Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowUpFromLine className="h-5 w-5" />
                  Top-Up Configuration
                </CardTitle>
                <CardDescription>
                  Set limits for wallet top-ups
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="min_topup">Minimum Top-Up (RM)</Label>
                    <Input
                      id="min_topup"
                      type="number"
                      step="0.01"
                      value={getCurrentValue('min_topup_amount')}
                      onChange={(e) => handleChange('min_topup_amount', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="max_topup">Maximum Top-Up (RM)</Label>
                    <Input
                      id="max_topup"
                      type="number"
                      step="0.01"
                      value={getCurrentValue('max_topup_amount')}
                      onChange={(e) => handleChange('max_topup_amount', e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Auto-Approval Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Automated Processing</CardTitle>
                <CardDescription>
                  Configure automatic withdrawal approval thresholds
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="auto_threshold">Auto-Approve Below (RM)</Label>
                    <Input
                      id="auto_threshold"
                      type="number"
                      step="0.01"
                      value={getCurrentValue('auto_approve_threshold')}
                      onChange={(e) => handleChange('auto_approve_threshold', e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Low-risk withdrawals below this amount are auto-approved
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="min_age">Minimum Account Age (days)</Label>
                    <Input
                      id="min_age"
                      type="number"
                      value={getCurrentValue('min_account_age_days')}
                      onChange={(e) => handleChange('min_account_age_days', e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Required account age for auto-approval
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Settings Update</AlertDialogTitle>
              <AlertDialogDescription>
                You are about to update the following platform settings:
                <ul className="mt-4 space-y-2">
                  {Object.entries(pendingChanges).map(([key, value]) => (
                    <li key={key} className="text-sm">
                      <strong>{settings[key]?.description || key}:</strong>{' '}
                      {settings[key]?.value} → {value}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 font-semibold">
                  These changes will affect all users immediately. Are you sure?
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Confirm'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminRoute>
  );
}