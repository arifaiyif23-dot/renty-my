import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/GlassCard';

export default function Offline() {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      navigate(-1);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [navigate]);

  const handleRetry = () => {
    if (navigator.onLine) {
      navigate(0);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <GlassCard className="max-w-md w-full text-center" padding="lg">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <WifiOff className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-2">You're Offline</h1>
        <p className="text-sm text-muted-foreground mb-6">
          It looks like you've lost your internet connection. Please check your network and try again.
        </p>
        <div className="text-left text-sm text-muted-foreground space-y-2 mb-6">
          <p className="font-medium">Troubleshooting tips:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Check your Wi-Fi or mobile data connection</li>
            <li>Try turning airplane mode off and on</li>
            <li>Restart your router if using Wi-Fi</li>
            <li>Move to an area with better signal</li>
          </ul>
        </div>

        <Button
          onClick={handleRetry}
          className="w-full rounded-xl"
          disabled={!isOnline}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {isOnline ? 'Retry Connection' : 'Still Offline...'}
        </Button>

        {isOnline && (
          <p className="text-sm text-center text-success mt-3" role="status">
            ✓ Connection restored! Click retry to continue.
          </p>
        )}
      </GlassCard>
    </div>
  );
}
