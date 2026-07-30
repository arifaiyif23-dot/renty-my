import { useState, useEffect } from "react";
import { isNative } from "@/lib/platform";

function getInitialOnlineStatus(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

export const useOfflineStatus = () => {
  const [isOnline, setIsOnline] = useState(getInitialOnlineStatus);
  const [showIndicator, setShowIndicator] = useState(!getInitialOnlineStatus());

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowIndicator(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowIndicator(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    let cleanupNetwork: (() => void) | undefined;
    if (isNative()) {
      import('@capacitor/network').then(({ Network }) => {
        Network.getStatus().then((status) => {
          setIsOnline(status.connected);
          setShowIndicator(!status.connected);
        });
        Network.addListener('networkStatusChange', (status) => {
          setIsOnline(status.connected);
          setShowIndicator(!status.connected);
        }).then((listener) => {
          cleanupNetwork = () => listener.remove();
        });
      });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      cleanupNetwork?.();
    };
  }, []);

  return { isOnline, showIndicator };
};