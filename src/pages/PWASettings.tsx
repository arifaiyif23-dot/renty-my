import Header from "@/components/Header";
import { PWAFeatures } from "@/components/PWAFeatures";
import { Card } from "@/components/ui/card";
import { Smartphone, Zap, Bell, Wifi } from "lucide-react";

export default function PWASettings() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 pt-24 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">App Settings</h1>
          <p className="text-muted-foreground">
            Configure your RENTY app experience
          </p>
        </div>

        {/* Benefits Section */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Why Install RENTY?</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex gap-3">
              <div className="p-2 bg-primary/10 rounded-lg h-fit">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Lightning Fast</h3>
                <p className="text-sm text-muted-foreground">
                  Instant loading with cached content. No waiting, just browsing.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="p-2 bg-primary/10 rounded-lg h-fit">
                <Smartphone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Native Experience</h3>
                <p className="text-sm text-muted-foreground">
                  Works just like a mobile app. Add to home screen for quick access.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="p-2 bg-primary/10 rounded-lg h-fit">
                <Wifi className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Offline Browsing</h3>
                <p className="text-sm text-muted-foreground">
                  Browse items even when offline. Perfect for spotty connections.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="p-2 bg-primary/10 rounded-lg h-fit">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Push Notifications</h3>
                <p className="text-sm text-muted-foreground">
                  Never miss a booking or message. Get notified instantly.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* PWA Features Component */}
        <PWAFeatures />

        {/* Installation Instructions */}
        <Card className="p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Installation Guide</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">📱 On iOS (Safari)</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Tap the Share button (square with arrow)</li>
                <li>Scroll down and tap "Add to Home Screen"</li>
                <li>Tap "Add" to confirm</li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold mb-2">🤖 On Android (Chrome)</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Tap the menu button (three dots)</li>
                <li>Tap "Install app" or "Add to Home Screen"</li>
                <li>Tap "Install" to confirm</li>
              </ol>
            </div>

            <div>
              <h3 className="font-semibold mb-2">💻 On Desktop (Chrome/Edge)</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Click the install icon in the address bar</li>
                <li>Or use browser menu → "Install RENTY"</li>
                <li>Click "Install" to confirm</li>
              </ol>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}