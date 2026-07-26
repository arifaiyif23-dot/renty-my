import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Camera, ShieldCheck, Wallet, Sparkles } from "lucide-react";
import Header from "@/components/Header";
import { toast } from "sonner";

export default function VendorOnboarding() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) navigate("/auth");
  }, [user, navigate]);

  const finish = async () => {
    if (!user) {
      toast.error(t('onboarding.signInRequired'));
      navigate("/auth");
      return;
    }
    if (!profile?.is_verified) {
      toast.error(t('onboarding.verifyRequired'), { duration: 5000 });
      navigate("/verification");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq("id", user.id);
      if (error) throw error;
      navigate("/list-item");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t('onboarding.failedToComplete');
      toast.error(message);
      console.error("Onboarding error:", error);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      icon: ShieldCheck,
      title: t('onboarding.step1Title'),
      desc: t('onboarding.step1Desc'),
      action: t('onboarding.step1Action'),
      to: "/verification",
    },
    {
      icon: Wallet,
      title: t('onboarding.step2Title'),
      desc: t('onboarding.step2Desc'),
      action: t('onboarding.step2Action'),
      to: "/earnings",
    },
    {
      icon: Camera,
      title: t('onboarding.step3Title'),
      desc: t('onboarding.step3Desc'),
      action: t('onboarding.step3Action'),
      to: "/list-item",
    },
  ];

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-2xl pb-mobile-nav">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-mono uppercase tracking-wider mb-3">
            <Sparkles className="h-3 w-3" /> {t('onboarding.badge')}
          </div>
          <h1 className="text-3xl font-bold mb-2">{t('onboarding.welcome', { name: profile?.full_name?.split(" ")[0] || "vendor" })}</h1>
          <p className="text-muted-foreground">{t('onboarding.subtitle')}</p>
        </div>

        <div className="space-y-3">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const done =
              (i === 0 && profile?.is_verified) ||
              (i === 1 && false);
            return (
              <GlassCard key={s.title} variant={done ? "subtle" : "default"} padding="md" className={done ? "border-primary/40" : ""}>
                <div className="flex items-start gap-4">
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
                    done ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}>
                    {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm mb-0.5">
                      {i + 1}. {s.title}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{s.desc}</p>
                    <Button
                      size="sm"
                      className="rounded-xl"
                      variant={done ? "outline" : "default"}
                      onClick={() => navigate(s.to)}
                    >
                      {done ? t('onboarding.checkDone') : s.action}
                    </Button>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col gap-2">
          <Button onClick={finish} disabled={loading} className="w-full h-12 rounded-xl">
            {t('onboarding.finishCta')}
          </Button>
          <Button variant="ghost" onClick={() => navigate("/")} className="w-full rounded-xl">
            {t('onboarding.later')}
          </Button>
        </div>
      </div>
    </>
  );
}
