import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Search, Mail, ExternalLink, HelpCircle, MessageCircle } from "lucide-react";
import Header from "@/components/Header";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function Help() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqKeys = Array.from({ length: 10 }, (_, i) => i + 1);

  const filtered = faqKeys.filter(
    (i) =>
      t(`help.faq${i}q`).toLowerCase().includes(search.toLowerCase()) ||
      t(`help.faq${i}a`).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Header />
      <div className="container mx-auto p-4 max-w-3xl pb-mobile-nav">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <HelpCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("help.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("help.subtitle")}</p>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("help.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>

        <div className="space-y-2 mb-8">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("help.noResults")}</p>
          ) : (
            filtered.map((i) => (
              <GlassCard
                key={i}
                variant="subtle"
                padding="md"
                className="cursor-pointer hover:border-primary/50 transition-colors select-none"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-medium text-sm">{t(`help.faq${i}q`)}</h3>
                  {openIndex === i ? (
                    <ChevronDown className="h-4 w-4 mt-1 flex-shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 mt-1 flex-shrink-0 text-muted-foreground" />
                  )}
                </div>
                {openIndex === i && (
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{t(`help.faq${i}a`)}</p>
                )}
              </GlassCard>
            ))
          )}
        </div>

        <GlassCard padding="lg">
          <h2 className="font-semibold text-lg mb-4">{t("help.stillNeedHelp")}</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-success/10 flex items-center justify-center">
                <MessageCircle className="h-4 w-4 text-success" />
              </div>
              <div>
                <p className="font-medium text-sm">{t("help.whatsapp")}</p>
                <a href="https://wa.me/60123456789" target="_blank" rel="noopener noreferrer" className="text-sm text-success hover:underline">
                  +60 12-345 6789
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">{t("help.emailUs")}</p>
                <a href="mailto:support@renty.my" className="text-sm text-primary hover:underline">
                  support@renty.my
                </a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <ExternalLink className="h-4 w-4 text-primary" />
              </div>
              <div className="text-sm">
                <Button variant="link" className="p-0 h-auto text-sm" asChild>
                  <Link to="/terms">{t("help.termsOfService")}</Link>
                </Button>
                <span className="text-muted-foreground mx-2">|</span>
                <Button variant="link" className="p-0 h-auto text-sm" asChild>
                  <Link to="/privacy">{t("help.privacyPolicy")}</Link>
                </Button>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </>
  );
}
