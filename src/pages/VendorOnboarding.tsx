import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Camera, ShieldCheck, Wallet, Sparkles } from "lucide-react";
import Header from "@/components/Header";
import { toast } from "sonner";

const STEPS = [
  {
    icon: ShieldCheck,
    title: "Sahkan identiti",
    desc: "Muat naik IC untuk KYC (5 minit). Wajib sebelum list.",
    action: "Ke Verifikasi",
    to: "/verification",
  },
  {
    icon: Wallet,
    title: "Tambah akaun bank",
    desc: "Untuk terima payout dari sewaan.",
    action: "Tetapkan Akaun",
    to: "/earnings",
  },
  {
    icon: Camera,
    title: "List barang pertama",
    desc: "Ambil 3-5 gambar jelas, tulis harga & lokasi.",
    action: "Mula List",
    to: "/list-item",
  },
];

export default function VendorOnboarding() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) navigate("/auth");
  }, [user, navigate]);

  const finish = async () => {
    if (!user) {
      toast.error("Please sign in to continue");
      navigate("/auth");
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
      const message = error instanceof Error ? error.message : "Failed to complete onboarding";
      toast.error(message);
      console.error("Onboarding error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-2xl pb-mobile-nav">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-mono uppercase tracking-wider mb-3">
            <Sparkles className="h-3 w-3" /> Vendor onboarding
          </div>
          <h1 className="text-3xl font-bold mb-2">Selamat datang, {profile?.full_name?.split(" ")[0] || "vendor"}!</h1>
          <p className="text-muted-foreground">3 langkah untuk mula terima tempahan.</p>
        </div>

        <div className="space-y-3">
          {STEPS.map((s, i) => {
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
                      {done ? "Semak" : s.action}
                    </Button>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col gap-2">
          <Button onClick={finish} disabled={loading} className="w-full h-12 rounded-xl">
            Terus ke list barang →
          </Button>
          <Button variant="ghost" onClick={() => navigate("/")} className="w-full rounded-xl">
            Lain kali
          </Button>
        </div>
      </div>
    </>
  );
}
