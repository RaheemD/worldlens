import { useState, useEffect, useCallback } from "react";

interface PushNotificationState {
  isSupported: boolean;
  permission: NotificationPermission | "unsupported";
  isSubscribed: boolean;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    permission: "unsupported",
    isSubscribed: false,
  });

  useEffect(() => {
    // Check if notifications are supported
    const isSupported = "Notification" in window && "serviceWorker" in navigator;
    
    setState(prev => ({
      ...prev,
      isSupported,
      permission: isSupported ? Notification.permission : "unsupported",
    }));
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      console.warn("Push notifications not supported");
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));
      return permission === "granted";
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    }
  }, [state.isSupported]);

  const showNotification = useCallback(async (
    title: string,
    options?: NotificationOptions
  ): Promise<boolean> => {
    if (!state.isSupported || state.permission !== "granted") {
      console.warn("Cannot show notification: permission not granted");
      return false;
    }

    try {
      // Use service worker for persistent notifications if available
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
          icon: "/pwa-192x192.png",
          badge: "/pwa-192x192.png",
          ...options,
        });
      } else {
        // Fallback to basic Notification API
        new Notification(title, {
          icon: "/pwa-192x192.png",
          ...options,
        });
      }
      return true;
    } catch (error) {
      console.error("Error showing notification:", error);
      return false;
    }
  }, [state.isSupported, state.permission]);

  const scheduleNotification = useCallback(async (
    title: string,
    options: NotificationOptions & { scheduledTime: Date }
  ): Promise<boolean> => {
    const { scheduledTime, ...notificationOptions } = options;
    const delay = scheduledTime.getTime() - Date.now();

    if (delay <= 0) {
      return showNotification(title, notificationOptions);
    }

    // For web, we can only use setTimeout (service worker for real scheduling)
    setTimeout(() => {
      showNotification(title, notificationOptions);
    }, delay);

    return true;
  }, [showNotification]);

  return {
    ...state,
    requestPermission,
    showNotification,
    scheduleNotification,
  };
}
