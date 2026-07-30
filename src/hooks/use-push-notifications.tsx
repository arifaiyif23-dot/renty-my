import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isNative, isWeb } from "@/lib/platform";

type NotificationPermission_ = "granted" | "denied" | "default";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function nativeRequestPermission(userId?: string): Promise<boolean> {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive === 'granted') {
      PushNotifications.register();
      PushNotifications.addListener('registration', async (token) => {
        if (userId) {
          await supabase.from('push_subscriptions').upsert({
            user_id: userId,
            subscription: JSON.stringify({ token: token.value }),
            endpoint: token.value,
          }, { onConflict: 'endpoint' });
        }
      });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function nativeUnsubscribe(userId?: string): Promise<boolean> {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    PushNotifications.unregister();
    if (userId) {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: 'push_token' });
      if (value) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', value);
      }
    }
    return true;
  } catch {
    return false;
  }
}

async function webRequestPermission(userId?: string, vapidKey?: string): Promise<boolean> {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    toast.error("Push notifications are not supported in this browser");
    return false;
  }

  try {
    const result = await Notification.requestPermission();
    if (result !== "granted") {
      toast.error("Notification permission denied");
      return false;
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      if (!vapidKey) {
        toast.error("Push notifications are not configured");
        return false;
      }
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });
    }

    if (userId) {
      await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        subscription: JSON.stringify(sub),
        endpoint: sub.endpoint,
      }, { onConflict: 'endpoint' });
    }

    toast.success("Notifications enabled! You'll get updates on bookings and messages");
    return true;
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    toast.error("Failed to enable notifications");
    return false;
  }
}

async function webUnsubscribe(userId?: string): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      if (userId) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      }
    }
    return true;
  } catch {
    return false;
  }
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission_>("default");
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (isNative()) {
      setIsSupported(true);
      import('@capacitor/push-notifications').then(({ PushNotifications }) => {
        PushNotifications.checkPermissions().then((result) => {
          setPermission(result.receive);
        });
      }).catch(() => {
        setIsSupported(false);
      });
    } else if (isWeb()) {
      const supported = 'Notification' in window;
      setIsSupported(supported);
      if (supported) {
        setPermission(Notification.permission);
      }
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (isNative()) {
      return nativeRequestPermission(user?.id);
    }
    return webRequestPermission(user?.id, import.meta.env.VITE_VAPID_PUBLIC_KEY);
  }, [user?.id]);

  const unsubscribe = useCallback(async () => {
    if (isNative()) {
      return nativeUnsubscribe(user?.id);
    }
    return webUnsubscribe(user?.id);
  }, [user?.id]);

  const sendTestNotification = useCallback(async () => {
    if (permission !== "granted") {
      toast.error("Please enable notifications first");
      return;
    }
    if (isNative()) {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        await LocalNotifications.schedule({
          notifications: [{
            title: "RENTY",
            body: "Notifications are working! You'll receive updates here.",
            id: Date.now(),
          }]
        });
      } catch {
        toast.error("Notifications not available on this device");
      }
    } else if ('Notification' in window) {
      try {
        new Notification("RENTY", {
          body: "Notifications are working! You'll receive updates here.",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: "test",
          requireInteraction: false,
        });
      } catch {
        toast.error("Failed to send test notification");
      }
    }
  }, [permission]);

  return {
    isSupported,
    permission,
    requestPermission,
    unsubscribe,
    sendTestNotification,
  };
};