import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Download, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export default function Privacy() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState<string | null>(null);

  const submitRequest = async (type: "export" | "deletion") => {
    if (!user) {
      toast.error(t('privacy.signInRequired'));
      return;
    }
    setSubmitting(type);
    const { error } = await supabase
      .from("data_requests")
      .insert({ user_id: user.id, request_type: type });
    setSubmitting(null);
    if (error) toast.error(error.message);
    else toast.success(t('privacy.requestSuccess'));
  };

  return (
    <PageLayout variant="narrow" className="py-10 space-y-8">
      <SEO title={t('privacy.title') + " — Renty"} description={t('privacy.subtitle')} />
        <PageHeader
          icon={<Shield className="h-5 w-5 text-primary" />}
          title={t('privacy.title')}
          subtitle={t('privacy.subtitle')}
          subtitleClassName="font-mono"
          className="mb-2"
        />

        <Section title={t('privacy.section1Title')}>
          <ul className="list-disc pl-6 space-y-1 text-sm">
            <li><b>Akaun:</b> nama penuh, email, nombor telefon, kata laluan (hashed).</li>
            <li><b>e-KYC:</b> nombor MyKad (hashed one-way), gambar dokumen identiti, selfie liveness.</li>
            <li><b>Perbankan (Vendor):</b> nombor akaun bank (encrypted dengan pgcrypto).</li>
            <li><b>Transaksi:</b> booking, pembayaran, mesej (encrypted), gambar handover.</li>
            <li><b>Teknikal:</b> IP address (untuk rate limiting), log akses data sensitif.</li>
          </ul>
        </Section>

        <Section title={t('privacy.section2Title')}>
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

        <Section title={t('privacy.section3Title')}>
          <p className="text-sm mb-2">Renty menggunakan penyedia pihak ketiga berikut:</p>
          <ul className="list-disc pl-6 space-y-1 text-sm">
            <li><b>Supabase</b> (Singapore region) — pangkalan data, auth, storage.</li>
            <li><b>Resend</b> — penghantaran email transaksional.</li>
            <li><b>ToyyibPay</b> — pemprosesan pembayaran FPX/kad (mod escrow).</li>
            <li><b>Google Gemini</b> — analisis dokumen KYC (verifikasi auto).</li>
          </ul>
        </Section>

        <Section title={t('privacy.section4Title')}>
          <ul className="list-disc pl-6 space-y-1 text-sm">
            <li>MyKad disimpan dalam bentuk <b>SHA-256 hash sahaja</b> — tak boleh reverse.</li>
            <li>Nombor akaun bank dan mesej peribadi di-encrypt guna <b>pgcrypto (AES)</b>.</li>
            <li>Dokumen sensitif diakses via signed URL yang tamat dalam 10 minit.</li>
            <li>Row-Level Security (RLS) pada semua jadual database.</li>
            <li>Rate limiting pada login (5/15min) dan signup (3/jam).</li>
          </ul>
        </Section>

        <Section title={t('privacy.section5Title')}>
          <ul className="list-disc pl-6 space-y-1 text-sm">
            <li>Data akaun aktif — sepanjang tempoh akaun.</li>
            <li>Dokumen e-KYC — 7 tahun (comply dengan keperluan audit kewangan).</li>
            <li>Rekod transaksi — 7 tahun.</li>
            <li>Log akses data sensitif — 2 tahun.</li>
            <li>Selepas akaun ditamatkan, data akan di-anonymize dalam 30 hari kecuali yang perlu disimpan untuk audit undang-undang.</li>
          </ul>
        </Section>

        <Section title={t('privacy.section6Title')}>
          <p className="text-sm mb-3">
            Anda berhak untuk mengakses, membetulkan, atau memadam data peribadi anda.
            Guna butang di bawah untuk hantar permintaan formal (kami akan proses dalam
            30 hari).
          </p>

          {!user && (
            <Alert className="mb-4 rounded-lg">
              <AlertDescription className="text-sm">
                {t('privacy.signInPrompt')}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => submitRequest("export")}
              disabled={!user || submitting !== null}
            >
              <Download className="h-4 w-4 mr-2" />
              {submitting === "export" ? t('privacy.submitting') : t('privacy.requestExport')}
            </Button>
            <Button
              variant="outline"
              className="rounded-lg text-destructive hover:text-destructive"
              onClick={() => submitRequest("deletion")}
              disabled={!user || submitting !== null}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {submitting === "deletion" ? t('privacy.submitting') : t('privacy.requestDeletion')}
            </Button>
          </div>
        </Section>

        <Section title={t('privacy.section7Title')}>
          <p className="text-sm">
            <Shield className="inline h-4 w-4 mr-1" />
            {t('privacy.contactDpo')}
          </p>
        </Section>

        <p className="text-xs text-muted-foreground mt-10 font-mono">
          {t('privacy.lastUpdated', { date: new Date().toLocaleDateString() })}
        </p>
    </PageLayout>
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
