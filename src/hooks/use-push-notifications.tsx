import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if push notifications are supported
    setIsSupported('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window);
    
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!isSupported) {
      toast.error("Push notifications are not supported in this browser");
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === "granted") {
        toast.success("Notifications enabled! You'll get updates on bookings and messages");
        return true;
      } else {
        toast.error("Notification permission denied");
        return false;
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      toast.error("Failed to enable notifications");
      return false;
    }
  };

  const sendTestNotification = () => {
    if (permission !== "granted") {
      toast.error("Please enable notifications first");
      return;
    }

    new Notification("RENTY", {
      body: "Notifications are working! You'll receive updates here.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "test",
      requireInteraction: false,
    });
  };

  return {
    isSupported,
    permission,
    requestPermission,
    sendTestNotification,
  };
};