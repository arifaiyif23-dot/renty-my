import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/PageLayout";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Printer,
  FileText,
  User,
  Package,
  Calendar,
  DollarSign,
  BadgeCheck,
  Stamp,
} from "lucide-react";
import { format } from "date-fns";
import { formatTime, formatDuration } from "@/lib/rentalTime";

interface AgreementContent {
  itemTitle: string;
  category: string;
  deposit: number;
  pricePerDay: number;
  pricePerHour?: number | null;
  ownerId: string;
  ownerName: string;
  ownerVerificationLevel: string | null;
  renterId: string;
  renterName: string;
  renterVerificationLevel: string | null;
  startDate: string;
  endDate: string;
  pickupTime?: string;
  returnTime?: string;
  days: number;
  totalHours?: number;
  totalPrice: number;
  originalTotalPrice: number | null;
  discountAmount: number;
}

interface Agreement {
  id: string;
  rental_id: string;
  terms_version: string;
  content: AgreementContent;
  renter_accepted_at: string | null;
  renter_full_name: string | null;
  owner_accepted_at: string | null;
  owner_full_name: string | null;
  created_at: string;
}

export default function RentalAgreement() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("rental_agreements")
        .select("*")
        .eq("rental_id", id)
        .maybeSingle();
      setAgreement((data as Agreement | null) ?? null);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <LoadingSpinner />;

  if (!agreement) {
    return (
      <PageLayout variant="narrow" className="text-center py-20">
        <p className="text-muted-foreground">{t("rentalAgreement.notFound")}</p>
        <Button variant="outline" className="mt-4 rounded-lg" asChild>
          <Link to="/">{t("userProfile.backHome")}</Link>
        </Button>
      </PageLayout>
    );
  }

  const c = agreement.content;
  const fmtMoney = (v: number) =>
    `RM ${Number(v).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (s: string) => format(new Date(s), "MMM d, yyyy");
  const fmtTime = (s?: string) => (s ? formatTime(s) : "");
  const fmtHours = (h?: number) => (h ? formatDuration(h) : "");
  const levelLabel = (level: string | null | undefined) =>
    level ? t(`rentalAgreement.level.${level}`, { defaultValue: level }) : t("rentalAgreement.level.unverified");

  const RenterRow = ({ name, level, acceptedAt }: { name: string; level: string | null; acceptedAt: string | null }) => (
    <div className="flex items-start gap-3">
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
        <User className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <p className="font-medium">{name}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <BadgeCheck className="h-3.5 w-3.5" />
          {t("rentalAgreement.verification", { level: levelLabel(level) })}
        </p>
      </div>
      {acceptedAt && (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success bg-success/10 rounded-full px-3 py-1">
          <Stamp className="h-3.5 w-3.5" />
          {fmtDate(acceptedAt)}
        </span>
      )}
    </div>
  );

  return (
    <PageLayout variant="narrow">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> {t("rentalAgreement.back")}
        </Button>
        <Button variant="outline" size="sm" className="rounded-lg" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" /> {t("rentalAgreement.download")}
        </Button>
      </div>

      <GlassCard padding="lg" className="print:shadow-none print:border-0">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 mb-4 print:hidden">
            <FileText className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{t("rentalAgreement.pageTitle")}</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{t("rentalAgreement.subtitle")}</p>
          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
            <span>
              {t("rentalAgreement.agreementId")}: <span className="font-mono font-medium text-foreground">{agreement.id.slice(0, 8).toUpperCase()}</span>
            </span>
            <span>
              {t("rentalAgreement.termsVersion")}: <span className="font-medium text-foreground">{agreement.terms_version}</span>
            </span>
          </div>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="font-semibold text-lg mb-4">{t("rentalAgreement.sectionParties")}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t("rentalAgreement.vendor")}</p>
                <RenterRow name={c.ownerName} level={c.ownerVerificationLevel} acceptedAt={agreement.owner_accepted_at} />
              </div>
              <div className="bg-muted/50 rounded-lg p-4 space-y-1">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{t("rentalAgreement.renter")}</p>
                <RenterRow name={c.renterName} level={c.renterVerificationLevel} acceptedAt={agreement.renter_accepted_at} />
              </div>
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" /> {t("rentalAgreement.sectionItem")}
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">{t("rentalAgreement.category")}</p>
                <p className="font-medium capitalize">{c.category}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("rentalAgreement.pricePerDay")}</p>
                <p className="font-medium">{fmtMoney(c.pricePerDay)}</p>
              </div>
              {c.pricePerHour ? (
                <div>
                  <p className="text-muted-foreground">{t("rentalAgreement.pricePerHour")}</p>
                  <p className="font-medium">{fmtMoney(c.pricePerHour)}</p>
                </div>
              ) : null}
              <div className="col-span-2">
                <p className="text-muted-foreground">{t("rentalAgreement.itemTitle")}</p>
                <p className="font-medium">{c.itemTitle}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">{t("rentalAgreement.deposit")}</p>
                <p className="font-medium">{fmtMoney(c.deposit)}</p>
              </div>
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" /> {t("rentalAgreement.sectionPeriod")}
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">{t("rentalAgreement.startDate")}</p>
                <p className="font-medium">{fmtDate(c.startDate)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("rentalAgreement.endDate")}</p>
                <p className="font-medium">{fmtDate(c.endDate)}</p>
              </div>
              {(c.pickupTime || c.returnTime) && (
                <>
                  <div>
                    <p className="text-muted-foreground">{t("rentalAgreement.pickupTime")}</p>
                    <p className="font-medium">{fmtTime(c.pickupTime)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("rentalAgreement.returnTime")}</p>
                    <p className="font-medium">{fmtTime(c.returnTime)}</p>
                  </div>
                </>
              )}
              <div>
                <p className="text-muted-foreground">{c.totalHours ? t("rentalAgreement.totalHours") : t("rentalAgreement.days", { count: c.days })}</p>
                <p className="font-medium">{c.totalHours ? fmtHours(c.totalHours) : c.days}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("rentalAgreement.totalPrice")}</p>
                <p className="font-medium text-lg">
                  <DollarSign className="h-4 w-4 inline text-primary mr-1" />
                  {fmtMoney(c.totalPrice)}
                </p>
              </div>
            </div>
          </section>

          <Separator />

          <section>
            <h2 className="font-semibold text-lg mb-4">{t("rentalAgreement.sectionTerms")}</h2>
            <ol className="space-y-3 text-sm text-foreground/90">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <li key={n} className="flex gap-3">
                  <span className="shrink-0 font-mono text-xs text-primary mt-0.5">{String(n).padStart(2, "0")}</span>
                  <span>{t(`rentalAgreement.clause${n}`)}</span>
                </li>
              ))}
            </ol>
          </section>

          <Separator />

          <section>
            <h2 className="font-semibold text-lg mb-4">{t("rentalAgreement.sectionAcceptance")}</h2>
            <p className="text-sm text-muted-foreground mb-4">{t("rentalAgreement.acceptanceNote")}</p>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="border border-muted rounded-lg p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">{t("rentalAgreement.renterAccepted")}</p>
                {agreement.renter_accepted_at && agreement.renter_full_name ? (
                  <p className="font-medium">
                    {t("rentalAgreement.acceptedOn", {
                      name: agreement.renter_full_name,
                      date: fmtDate(agreement.renter_accepted_at),
                    })}
                  </p>
                ) : (
                  <p className="text-muted-foreground">{t("rentalAgreement.pendingAcceptance")}</p>
                )}
              </div>
              <div className="border border-muted rounded-lg p-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">{t("rentalAgreement.ownerAccepted")}</p>
                {agreement.owner_accepted_at && agreement.owner_full_name ? (
                  <p className="font-medium">
                    {t("rentalAgreement.acceptedOn", {
                      name: agreement.owner_full_name,
                      date: fmtDate(agreement.owner_accepted_at),
                    })}
                  </p>
                ) : (
                  <p className="text-muted-foreground">{t("rentalAgreement.pendingAcceptance")}</p>
                )}
              </div>
            </div>
          </section>
        </div>
      </GlassCard>
    </PageLayout>
  );
}
