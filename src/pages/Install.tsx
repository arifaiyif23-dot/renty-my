import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, CheckCircle2, Zap, Shield, Download } from "lucide-react";
import SEO from "@/components/SEO";

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
    // Check if already installed
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
    <div className="min-h-screen pb-mobile-nav">
      <SEO 
        title="Install RENTY App"
        description="Install RENTY on your device for a faster, app-like experience with offline support"
      />
      <Header />

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Install RENTY
          </h1>
          <p className="text-lg text-muted-foreground">
            Get the full app experience on your device
          </p>
        </div>

        {isInstalled ? (
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Already Installed!</h2>
                <p className="text-muted-foreground mb-6">
                  RENTY is already installed on your device
                </p>
                <Button onClick={() => navigate('/')}>
                  Go to Home
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {isInstallable ? (
              <Card className="mb-8">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Download className="w-16 h-16 text-primary mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2">Ready to Install</h2>
                    <p className="text-muted-foreground mb-6">
                      Install RENTY for quick access from your home screen
                    </p>
                    <Button size="lg" onClick={handleInstallClick}>
                      <Download className="w-5 h-5 mr-2" />
                      Install Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="mb-8">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <Smartphone className="w-16 h-16 text-primary mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2">Install from Browser</h2>
                    <p className="text-muted-foreground mb-4">
                      To install RENTY, use your browser's menu:
                    </p>
                    <div className="text-left max-w-md mx-auto space-y-3 text-sm">
                      <div className="glass-card p-4 rounded-lg">
                        <p className="font-semibold mb-2">📱 On iPhone/iPad:</p>
                        <p className="text-muted-foreground">
                          Tap the <strong>Share</strong> button, then select <strong>"Add to Home Screen"</strong>
                        </p>
                      </div>
                      <div className="glass-card p-4 rounded-lg">
                        <p className="font-semibold mb-2">🤖 On Android:</p>
                        <p className="text-muted-foreground">
                          Tap the <strong>Menu</strong> (three dots), then select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>
                        </p>
                      </div>
                      <div className="glass-card p-4 rounded-lg">
                        <p className="font-semibold mb-2">💻 On Desktop:</p>
                        <p className="text-muted-foreground">
                          Click the <strong>install icon</strong> in the address bar or browser menu
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Benefits */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {benefits.map((benefit) => (
            <Card key={benefit.title}>
              <CardHeader>
                <benefit.icon className="w-10 h-10 text-primary mb-3" />
                <CardTitle className="text-lg">{benefit.title}</CardTitle>
                <CardDescription>{benefit.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle>What You Get</CardTitle>
            <CardDescription>Everything you love about RENTY, enhanced</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Install;
