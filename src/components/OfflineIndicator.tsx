import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WifiOff, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      reconnectTimer = setTimeout(() => {
        setShowReconnected(false);
        reconnectTimer = null;
      }, 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  if (isOnline && !showReconnected) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 animate-in slide-in-from-top">
      {!isOnline ? (
        <Alert variant="destructive" className="shadow-lg">
          <WifiOff className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>You're offline. Some features may be unavailable.</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.location.reload()}
              className="shrink-0"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-success bg-success/10 shadow-lg">
          <Wifi className="h-4 w-4 text-success" />
          <AlertDescription className="text-success">
            Back online! Your connection has been restored.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
