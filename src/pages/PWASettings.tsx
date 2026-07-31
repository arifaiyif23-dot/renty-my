import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { PWAFeatures } from "@/components/PWAFeatures";
import { GlassCard } from "@/components/ui/GlassCard";
import { Smartphone, Zap, Bell, Wifi } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function PWASettings() {
  const { t } = useTranslation();

  return (
    <PageLayout className="py-8">
        <PageHeader
          icon={<Smartphone className="h-5 w-5 text-primary" />}
          title={t("pwa.appSettings")}
          subtitle={t("pwa.subtitle")}
          className="mb-8"
        />

        <GlassCard padding="lg" className="mb-6">
          <h2 className="text-lg font-semibold mb-4">{t("pwa.whyInstall")}</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex gap-3">
              <div className="p-2 bg-primary/10 rounded-lg h-fit">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">{t("pwa.lightningFast")}</h3>
                <p className="text-xs text-muted-foreground">{t("pwa.lightningFastDesc")}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="p-2 bg-primary/10 rounded-lg h-fit">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">{t("pwa.nativeExperience")}</h3>
                <p className="text-xs text-muted-foreground">{t("pwa.nativeExperienceDesc")}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="p-2 bg-primary/10 rounded-lg h-fit">
                <Wifi className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">{t("pwa.offlineBrowsing")}</h3>
                <p className="text-xs text-muted-foreground">{t("pwa.offlineBrowsingDesc")}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="p-2 bg-primary/10 rounded-lg h-fit">
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
    </PageLayout>
  );
}
