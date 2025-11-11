import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <WifiOff className="w-8 h-8 text-destructive" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl">You're Offline</CardTitle>
          <CardDescription>
            It looks like you've lost your internet connection. Please check your network and try again.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>Troubleshooting tips:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Check your Wi-Fi or mobile data connection</li>
              <li>Try turning airplane mode off and on</li>
              <li>Restart your router if using Wi-Fi</li>
              <li>Move to an area with better signal</li>
            </ul>
          </div>
          
          <Button 
            onClick={handleRetry} 
            className="w-full" 
            disabled={!isOnline}
            aria-live="polite"
          >
            <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
            {isOnline ? 'Retry Connection' : 'Still Offline...'}
          </Button>

          {isOnline && (
            <p className="text-sm text-center text-green-600" role="status">
              ✓ Connection restored! Click retry to continue.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
