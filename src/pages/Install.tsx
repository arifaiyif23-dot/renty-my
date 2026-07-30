import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Smartphone, CheckCircle2, Zap, Shield, Download } from "lucide-react";
import SEO from "@/components/SEO";
import { isNative } from "@/lib/platform";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const Install = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (isNative()) {
      setIsInstalled(true);
      return;
    }
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  const benefits = [
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Loads instantly, even on slow connections"
    },
    {
      icon: Shield,
      title: "Works Offline",
      description: "Access your rentals without internet"
    },
    {
      icon: Smartphone,
      title: "Native Experience",
      description: "Feels like a real mobile app"
    }
  ];

  return (
    <PageLayout>
      <SEO
        title="Install RENTY App"
        description="Install RENTY on your device for a faster, app-like experience with offline support"
      />

      <div className="container mx-auto px-0 py-12 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-2">
            Install RENTY
          </h1>
          <p className="text-muted-foreground">
            Get the full app experience on your device
          </p>
        </div>

        {isInstalled ? (
          <GlassCard padding="lg" className="mb-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Already Installed!</h2>
            <p className="text-muted-foreground mb-6">
              RENTY is already installed on your device
            </p>
            <Button onClick={() => navigate('/')} className="rounded-xl">
              Go to Home
            </Button>
          </GlassCard>
        ) : (
          <>
            {isInstallable ? (
              <GlassCard padding="lg" className="mb-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Download className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Ready to Install</h2>
                <p className="text-muted-foreground mb-6">
                  Install RENTY for quick access from your home screen
                </p>
                <Button size="lg" className="rounded-xl" onClick={handleInstallClick}>
                  <Download className="w-5 h-5 mr-2" />
                  Install Now
                </Button>
              </GlassCard>
            ) : (
              <GlassCard padding="lg" className="mb-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Install from Browser</h2>
                <p className="text-muted-foreground mb-4">
                  To install RENTY, use your browser's menu:
                </p>
                <div className="text-left max-w-md mx-auto space-y-3 text-sm">
                  <GlassCard variant="subtle" padding="md">
                    <p className="font-semibold mb-1">On iPhone/iPad:</p>
                    <p className="text-muted-foreground">
                      Tap the <strong>Share</strong> button, then select <strong>"Add to Home Screen"</strong>
                    </p>
                  </GlassCard>
                  <GlassCard variant="subtle" padding="md">
                    <p className="font-semibold mb-1">On Android:</p>
                    <p className="text-muted-foreground">
                      Tap the <strong>Menu</strong> (three dots), then select <strong>"Install app"</strong>
                    </p>
                  </GlassCard>
                  <GlassCard variant="subtle" padding="md">
                    <p className="font-semibold mb-1">On Desktop:</p>
                    <p className="text-muted-foreground">
                      Click the <strong>install icon</strong> in the address bar or browser menu
                    </p>
                  </GlassCard>
                </div>
              </GlassCard>
            )}
          </>
        )}

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {benefits.map((benefit) => (
            <GlassCard key={benefit.title} variant="subtle" padding="lg" className="text-center">
              <benefit.icon className="w-10 h-10 text-primary mx-auto mb-3" />
              <h3 className="font-semibold mb-1">{benefit.title}</h3>
              <p className="text-sm text-muted-foreground">{benefit.description}</p>
            </GlassCard>
          ))}
        </div>

        <GlassCard padding="lg">
          <h2 className="font-semibold text-lg mb-4">What You Get</h2>
          <ul className="space-y-3">
            <li className="flex items-start">
              <CheckCircle2 className="w-5 h-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
              <span>Quick access from your home screen</span>
            </li>
            <li className="flex items-start">
              <CheckCircle2 className="w-5 h-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
              <span>Works offline - view your bookings without internet</span>
            </li>
            <li className="flex items-start">
              <CheckCircle2 className="w-5 h-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
              <span>Faster loading with cached content</span>
            </li>
            <li className="flex items-start">
              <CheckCircle2 className="w-5 h-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
              <span>Full-screen experience without browser UI</span>
            </li>
            <li className="flex items-start">
              <CheckCircle2 className="w-5 h-5 text-primary mr-3 mt-0.5 flex-shrink-0" />
              <span>Automatic updates in the background</span>
            </li>
          </ul>
        </GlassCard>
      </div>
    </PageLayout>
  );
};

export default Install;
