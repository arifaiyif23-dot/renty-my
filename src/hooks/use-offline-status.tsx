import { useState, useEffect } from "react";

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

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline, showIndicator };
};