import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Bell, BellOff, Wifi, WifiOff, Download, CheckCircle } from "lucide-react";
import { useOfflineStatus } from "@/hooks/use-offline-status";

export const PWAFeatures = () => {
  const { isSupported, permission, requestPermission, sendTestNotification } = usePushNotifications();
  const { isOnline } = useOfflineStatus();
  const [notificationsEnabled, setNotificationsEnabled] = useState(permission === "granted");

  const handleNotificationToggle = async (enabled: boolean) => {
    if (enabled) {
      const success = await requestPermission();
      setNotificationsEnabled(success);
    } else {
      setNotificationsEnabled(false);
    }
  };

  const isStandalone = isNative() || window.matchMedia('(display-mode: standalone)').matches;

  return (
    <div className="space-y-4">
      {/* Installation Status */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isStandalone ? 'bg-success/10' : 'bg-muted'}`}>
              <Download className={`w-5 h-5 ${isStandalone ? 'text-success' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <h3 className="font-semibold">App Installation</h3>
              <p className="text-sm text-muted-foreground">
                {isStandalone ? "Installed as app" : "Running in browser"}
              </p>
            </div>
          </div>
          {isStandalone && (
            <Badge variant="default" className="gap-1">
              <CheckCircle className="w-3 h-3" />
              Installed
            </Badge>
          )}
        </div>
      </Card>

      {/* Push Notifications */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${notificationsEnabled ? 'bg-primary/10' : 'bg-muted'}`}>
              {notificationsEnabled ? (
                <Bell className="w-5 h-5 text-primary" />
              ) : (
                <BellOff className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <h3 className="font-semibold">Push Notifications</h3>
              <p className="text-sm text-muted-foreground">
                Get instant updates on bookings and messages
              </p>
            </div>
          </div>
          {isSupported && (
            <Switch
              checked={notificationsEnabled}
              onCheckedChange={handleNotificationToggle}
            />
          )}
        </div>

        {!isSupported && (
          <div className="text-sm text-muted-foreground">
            Push notifications are not supported in this browser
          </div>
        )}

        {notificationsEnabled && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={sendTestNotification}
            className="w-full"
          >
            Send Test Notification
          </Button>
        )}
      </Card>

      {/* Offline Status */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isOnline ? 'bg-success/10' : 'bg-destructive/10'}`}>
              {isOnline ? (
                <Wifi className="w-5 h-5 text-success" />
              ) : (
                <WifiOff className="w-5 h-5 text-destructive" />
              )}
            </div>
            <div>
              <h3 className="font-semibold">Connection Status</h3>
              <p className="text-sm text-muted-foreground">
                {isOnline ? "You're online" : "You're offline - cached data available"}
              </p>
            </div>
          </div>
          <Badge variant={isOnline ? "default" : "secondary"}>
            {isOnline ? "Online" : "Offline"}
          </Badge>
        </div>
      </Card>

      {/* PWA Features */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3">App Features</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-success" />
            <span>Offline browsing of items</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-success" />
            <span>Fast app-like experience</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-success" />
            <span>Background sync for actions</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-success" />
            <span>Cached images & content</span>
          </div>
        </div>
      </Card>
    </div>
  );
};