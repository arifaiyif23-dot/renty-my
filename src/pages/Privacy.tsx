import { useState } from "react";
import Header from "@/components/Header";
import SEO from "@/components/SEO";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Download, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Privacy() {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState<string | null>(null);

  const submitRequest = async (type: "export" | "deletion") => {
    if (!user) {
      toast.error("Sign in dulu untuk buat permintaan data.");
      return;
    }
    setSubmitting(type);
    const { error } = await supabase
      .from("data_requests")
      .insert({ user_id: user.id, request_type: type });
    setSubmitting(null);
    if (error) toast.error(error.message);
    else toast.success("Permintaan direkodkan. Admin akan proses dalam 30 hari.");
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO title="Dasar Privasi — Renty" description="Bagaimana Renty mengumpul, menyimpan, dan melindungi data peribadi anda selari dengan PDPA Malaysia." />
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-10 pb-mobile-nav space-y-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Dasar Privasi</h1>
            <p className="text-sm text-muted-foreground font-mono">
              Selari dengan Personal Data Protection Act 2010 (Malaysia)
            </p>
          </div>
        </div>

        <Section title="1. Data yang Dikumpul">
          <ul className="list-disc pl-6 space-y-1 text-sm">
            <li><b>Akaun:</b> nama penuh, email, nombor telefon, kata laluan (hashed).</li>
            <li><b>e-KYC:</b> nombor MyKad (hashed one-way), gambar dokumen identiti, selfie liveness.</li>
            <li><b>Perbankan (Vendor):</b> nombor akaun bank (encrypted dengan pgcrypto).</li>
            <li><b>Transaksi:</b> booking, pembayaran, mesej (encrypted), gambar handover.</li>
            <li><b>Teknikal:</b> IP address (untuk rate limiting), log akses data sensitif.</li>
          </ul>
        </Section>

        <Section title="2. Tujuan Penggunaan">
          <ul className="list-disc pl-6 space-y-1 text-sm">
            <li>Fasilitasi booking dan pembayaran antara Renter dan Vendor.</li>
            <li>Verifikasi identiti (e-KYC) untuk keselamatan platform.</li>
            <li>Notifikasi transaksional (email dan in-app) berkaitan booking.</li>
            <li>Deteksi dan pencegahan fraud/scam.</li>
            <li>Penyelesaian pertikaian (dispute resolution).</li>
          </ul>
          <p className="text-sm mt-2">
            <b>Kami tidak menjual data peribadi anda kepada pihak ketiga.</b>
          </p>
        </Section>

        <Section title="3. Subprocessors">
          <p className="text-sm mb-2">Renty menggunakan penyedia pihak ketiga berikut:</p>
          <ul className="list-disc pl-6 space-y-1 text-sm">
            <li><b>Supabase</b> (Singapore region) — pangkalan data, auth, storage.</li>
            <li><b>Resend</b> — penghantaran email transaksional.</li>
            <li><b>ToyyibPay</b> — pemprosesan pembayaran FPX/kad (mod escrow).</li>
            <li><b>Google Gemini</b> — analisis dokumen KYC (verifikasi auto).</li>
          </ul>
        </Section>

        <Section title="4. Keselamatan Data">
          <ul className="list-disc pl-6 space-y-1 text-sm">
            <li>MyKad disimpan dalam bentuk <b>SHA-256 hash sahaja</b> — tak boleh reverse.</li>
            <li>Nombor akaun bank dan mesej peribadi di-encrypt guna <b>pgcrypto (AES)</b>.</li>
            <li>Dokumen sensitif diakses via signed URL yang tamat dalam 10 minit.</li>
            <li>Row-Level Security (RLS) pada semua jadual database.</li>
            <li>Rate limiting pada login (5/15min) dan signup (3/jam).</li>
          </ul>
        </Section>

        <Section title="5. Tempoh Penyimpanan">
          <ul className="list-disc pl-6 space-y-1 text-sm">
            <li>Data akaun aktif — sepanjang tempoh akaun.</li>
            <li>Dokumen e-KYC — 7 tahun (comply dengan keperluan audit kewangan).</li>
            <li>Rekod transaksi — 7 tahun.</li>
            <li>Log akses data sensitif — 2 tahun.</li>
            <li>Selepas akaun ditamatkan, data akan di-anonymize dalam 30 hari kecuali yang perlu disimpan untuk audit undang-undang.</li>
          </ul>
        </Section>

        <Section title="6. Hak Anda Di Bawah PDPA">
          <p className="text-sm mb-3">
            Anda berhak untuk mengakses, membetulkan, atau memadam data peribadi anda.
            Guna butang di bawah untuk hantar permintaan formal (kami akan proses dalam
            30 hari).
          </p>

          {!user && (
            <Alert className="mb-4 rounded-xl">
              <AlertDescription className="text-sm">
                Sign in dulu untuk buat permintaan data.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => submitRequest("export")}
              disabled={!user || submitting !== null}
            >
              <Download className="h-4 w-4 mr-2" />
              {submitting === "export" ? "Menghantar..." : "Request Data Export"}
            </Button>
            <Button
              variant="outline"
              className="rounded-xl text-destructive hover:text-destructive"
              onClick={() => submitRequest("deletion")}
              disabled={!user || submitting !== null}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {submitting === "deletion" ? "Menghantar..." : "Request Account Deletion"}
            </Button>
          </div>
        </Section>

        <Section title="7. Hubungi Data Protection Officer">
          <p className="text-sm">
            <Shield className="inline h-4 w-4 mr-1" />
            Email: <a href="mailto:privacy@renty.my" className="text-primary underline">privacy@renty.my</a>
          </p>
        </Section>

        <p className="text-xs text-muted-foreground mt-10 font-mono">
          Dasar Privasi Renty · terakhir dikemas kini {new Date().toLocaleDateString("ms-MY")}
        </p>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
