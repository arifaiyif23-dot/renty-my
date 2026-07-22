import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PUBLIC_VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);

    if ('Notification' in window) {
      setPermission(Notification.permission);
    }

    if (supported) {
      restoreSubscription();
    }
  }, []);

  const restoreSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setSubscription(sub);
    } catch {
      // Service worker not ready yet
    }
  };

  const requestPermission = async () => {
    if (!isSupported) {
      toast.error("Push notifications are not supported in this browser");
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === "granted") {
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();

        if (!sub) {
          if (!PUBLIC_VAPID_KEY) {
            toast.error("Push notifications are not configured");
            return false;
          }
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: PUBLIC_VAPID_KEY,
          });
        }

        setSubscription(sub);

        if (user) {
          await supabase.from('push_subscriptions').upsert({
            user_id: user.id,
            subscription: JSON.stringify(sub),
            endpoint: sub.endpoint,
          }, { onConflict: 'endpoint' });
        }

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
    subscription,
    requestPermission,
    sendTestNotification,
  };
};