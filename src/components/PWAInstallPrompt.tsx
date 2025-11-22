import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Download, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if user already dismissed the prompt
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSince = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) return; // Don't show again for 7 days
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show prompt after 30 seconds of usage
      setTimeout(() => {
        setShowPrompt(true);
      }, 30000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setShowPrompt(false);
      setIsInstalled(true);
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
  };

  if (isInstalled || !showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom duration-300">
      <Card className="p-4 shadow-lg border-2 border-primary/20 bg-card">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 hover:bg-accent rounded-full transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex gap-3">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Smartphone className="w-6 h-6 text-primary" />
          </div>

          <div className="flex-1">
            <h3 className="font-semibold mb-1">Install RENTY App</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Get quick access, offline browsing, and instant notifications
            </p>

            <div className="flex gap-2">
              <Button onClick={handleInstall} size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                Install
              </Button>
              <Button onClick={handleDismiss} variant="ghost" size="sm">
                Not now
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-2 text-xs text-center">
          <div>
            <div className="font-semibold">⚡ Fast</div>
            <div className="text-muted-foreground">Instant load</div>
          </div>
          <div>
            <div className="font-semibold">📱 Native</div>
            <div className="text-muted-foreground">Like an app</div>
          </div>
          <div>
            <div className="font-semibold">🔔 Alerts</div>
            <div className="text-muted-foreground">Stay updated</div>
          </div>
        </div>
      </Card>
    </div>
  );
};