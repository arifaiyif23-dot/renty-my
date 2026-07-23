import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Bell, Loader2, ArrowLeft, Save } from "lucide-react";
import Header from "@/components/Header";
import { useNavigate } from "react-router-dom";
import type { NotificationPreference } from "@/types";

const DEFAULT_PREFS: NotificationPreference = {
  id: "",
  user_id: "",
  rental_requests: true,
  rental_updates: true,
  messages: true,
  reviews: true,
  payment_updates: true,
  verification_updates: true,
  marketing: false,
  push_enabled: true,
  email_enabled: true,
  created_at: "",
  updated_at: "",
};

export default function NotificationSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<NotificationPreference>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadPreferences();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setPrefs(data);
      } else {
        const { data: newPrefs, error: createError } = await supabase
          .from("notification_preferences")
          .insert({ user_id: user!.id })
          .select()
          .single();

        if (createError) throw createError;
        if (newPrefs) setPrefs(newPrefs);
      }
    } catch {
      toast.error("Failed to load notification preferences");
    } finally {
      setLoading(false);
    }
  };

  const togglePref = (key: keyof NotificationPreference) => {
    if (typeof prefs[key] === "boolean") {
      setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({
          user_id: user!.id,
          rental_requests: prefs.rental_requests,
          rental_updates: prefs.rental_updates,
          messages: prefs.messages,
          reviews: prefs.reviews,
          payment_updates: prefs.payment_updates,
          verification_updates: prefs.verification_updates,
          marketing: prefs.marketing,
          push_enabled: prefs.push_enabled,
          email_enabled: prefs.email_enabled,
        })
        .eq("user_id", user!.id);

      if (error) throw error;
      toast.success("Notification preferences saved");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="container mx-auto p-4 max-w-2xl pb-mobile-nav flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </>
    );
  }

  const notificationToggles: { key: keyof NotificationPreference; label: string; desc: string }[] = [
    { key: "rental_requests", label: "Rental Requests", desc: "When someone requests to rent your item" },
    { key: "rental_updates", label: "Rental Updates", desc: "Status changes on your bookings" },
    { key: "messages", label: "Messages", desc: "New messages from other users" },
    { key: "reviews", label: "Reviews", desc: "When you receive a new review" },
    { key: "payment_updates", label: "Payment Updates", desc: "Payment confirmations and payout notifications" },
    { key: "verification_updates", label: "Verification Updates", desc: "Identity verification status changes" },
    { key: "marketing", label: "Marketing", desc: "Promotions, tips, and platform updates" },
  ];

  const deliveryToggles: { key: "push_enabled" | "email_enabled"; label: string; desc: string }[] = [
    { key: "push_enabled", label: "Push Notifications", desc: "Receive notifications in-app and on your device" },
    { key: "email_enabled", label: "Email Notifications", desc: "Receive notifications via email" },
  ];

  return (
    <>
      <Header />
      <div className="container mx-auto p-4 max-w-2xl pb-mobile-nav">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Notification Preferences</h1>
            <p className="text-xs text-muted-foreground">Choose which notifications you receive</p>
          </div>
        </div>

        <GlassCard padding="lg" className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-3">Notification Types</h3>
            <div className="space-y-3">
              {notificationToggles.map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={prefs[key] as boolean}
                    onCheckedChange={() => togglePref(key as keyof NotificationPreference)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-sm font-semibold mb-3">Delivery Methods</h3>
            <div className="space-y-3">
              {deliveryToggles.map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={prefs[key]}
                    onCheckedChange={() => togglePref(key)}
                  />
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Preferences
          </Button>
        </GlassCard>
      </div>
    </>
  );
}
