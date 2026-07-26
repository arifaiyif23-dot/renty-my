import Header from "@/components/Header";
import { PWAFeatures } from "@/components/PWAFeatures";
import { GlassCard } from "@/components/ui/GlassCard";
import { Smartphone, Zap, Bell, Wifi } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function PWASettings() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 pt-24 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("pwa.appSettings")}</h1>
            <p className="text-sm text-muted-foreground">{t("pwa.subtitle")}</p>
          </div>
        </div>

        <GlassCard padding="lg" className="mb-6">
          <h2 className="text-lg font-semibold mb-4">{t("pwa.whyInstall")}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex gap-3">
              <div className="p-2 bg-primary/10 rounded-xl h-fit">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">{t("pwa.lightningFast")}</h3>
                <p className="text-xs text-muted-foreground">{t("pwa.lightningFastDesc")}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="p-2 bg-primary/10 rounded-xl h-fit">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">{t("pwa.nativeExperience")}</h3>
                <p className="text-xs text-muted-foreground">{t("pwa.nativeExperienceDesc")}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="p-2 bg-primary/10 rounded-xl h-fit">
                <Wifi className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">{t("pwa.offlineBrowsing")}</h3>
                <p className="text-xs text-muted-foreground">{t("pwa.offlineBrowsingDesc")}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="p-2 bg-primary/10 rounded-xl h-fit">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">{t("pwa.pushNotifications")}</h3>
                <p className="text-xs text-muted-foreground">{t("pwa.pushNotificationsDesc")}</p>
              </div>
            </div>
          </div>
        </GlassCard>

        <PWAFeatures />

        <GlassCard padding="lg" className="mt-6">
          <h2 className="text-lg font-semibold mb-4">{t("pwa.installGuide")}</h2>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm mb-2">{t("pwa.iosTitle")}</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>{t("pwa.iosStep1")}</li>
                <li>{t("pwa.iosStep2")}</li>
                <li>{t("pwa.iosStep3")}</li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">{t("pwa.androidTitle")}</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>{t("pwa.androidStep1")}</li>
                <li>{t("pwa.androidStep2")}</li>
                <li>{t("pwa.androidStep3")}</li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">{t("pwa.desktopTitle")}</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>{t("pwa.desktopStep1")}</li>
                <li>{t("pwa.desktopStep2")}</li>
                <li>{t("pwa.desktopStep3")}</li>
              </ol>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
