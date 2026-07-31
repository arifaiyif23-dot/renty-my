import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Bell, Loader2, ArrowLeft, Save } from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
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
  const { t } = useTranslation();
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
      toast.error(t("notificationSettings.failedToLoad"));
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
      toast.success(t("notificationSettings.saved"));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("notificationSettings.failedToSave"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageLayout variant="narrow" className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </PageLayout>
    );
  }

  const notificationToggles: { key: keyof NotificationPreference }[] = [
    { key: "rental_requests" },
    { key: "rental_updates" },
    { key: "messages" },
    { key: "reviews" },
    { key: "payment_updates" },
    { key: "verification_updates" },
    { key: "marketing" },
  ];

  const deliveryToggles: { key: "push_enabled" | "email_enabled" }[] = [
    { key: "push_enabled" },
    { key: "email_enabled" },
  ];

  return (
    <PageLayout variant="narrow">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" className="rounded-lg" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <PageHeader
            icon={<Bell className="h-5 w-5 text-primary" />}
            title={t("notificationSettings.title")}
            subtitle={t("notificationSettings.subtitle")}
            titleClassName="text-xl"
            subtitleClassName="text-xs"
          />
        </div>

        <GlassCard padding="lg" className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-3">{t("notificationSettings.types")}</h3>
            <div className="space-y-3">
              {notificationToggles.map(({ key }) => (
                <div key={key} className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium">{t(`notificationSettings.${key}`)}</p>
                    <p className="text-xs text-muted-foreground">{t(`notificationSettings.${key}Desc`)}</p>
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
            <h3 className="text-sm font-semibold mb-3">{t("notificationSettings.delivery")}</h3>
            <div className="space-y-3">
              {deliveryToggles.map(({ key }) => (
                <div key={key} className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium">{t(`notificationSettings.${key}`)}</p>
                    <p className="text-xs text-muted-foreground">{t(`notificationSettings.${key}Desc`)}</p>
                  </div>
                  <Switch
                    checked={prefs[key]}
                    onCheckedChange={() => togglePref(key)}
                  />
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full rounded-lg">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {t("notificationSettings.save")}
          </Button>
        </GlassCard>
    </PageLayout>
  );
}
