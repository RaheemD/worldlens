import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

// --- Mocks for the browser notification + service worker APIs ---
class MockNotification {
  static permission: NotificationPermission = "default";
  static requestPermission = vi.fn(async () => MockNotification.permission);
  title: string;
  options?: NotificationOptions;
  constructor(title: string, options?: NotificationOptions) {
    this.title = title;
    this.options = options;
  }
}

const swShowNotification = vi.fn(async () => undefined);

const originalNotification = (globalThis as Record<string, unknown>).Notification;
const originalServiceWorkerDescriptor = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");

function installApis() {
  (window as unknown as Record<string, unknown>).Notification = MockNotification as unknown;
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve({ showNotification: swShowNotification }) },
  });
}

beforeEach(() => {
  MockNotification.permission = "default";
  MockNotification.requestPermission = vi.fn(async () => MockNotification.permission);
  swShowNotification.mockClear();
  installApis();
});

afterEach(() => {
  if (originalNotification === undefined) {
    delete (window as unknown as Record<string, unknown>).Notification;
  } else {
    (window as unknown as Record<string, unknown>).Notification = originalNotification;
  }
  if (originalServiceWorkerDescriptor) {
    Object.defineProperty(navigator, "serviceWorker", originalServiceWorkerDescriptor);
  } else {
    // @ts-expect-error cleanup of injected mock
    delete navigator.serviceWorker;
  }
});

describe("usePushNotifications", () => {
  it("detects support and reports the current permission", async () => {
    MockNotification.permission = "granted";
    const { result } = renderHook(() => usePushNotifications());

    await waitFor(() => expect(result.current.isSupported).toBe(true));
    expect(result.current.permission).toBe("granted");
  });

  it("requests permission and updates state when granted", async () => {
    MockNotification.permission = "default";
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.isSupported).toBe(true));

    // Simulate the user accepting the browser prompt.
    MockNotification.permission = "granted";
    MockNotification.requestPermission = vi.fn(async () => "granted" as NotificationPermission);

    let granted = false;
    await act(async () => {
      granted = await result.current.requestPermission();
    });

    expect(MockNotification.requestPermission).toHaveBeenCalledTimes(1);
    expect(granted).toBe(true);
    expect(result.current.permission).toBe("granted");
  });

  it("shows a notification via the service worker when permission is granted", async () => {
    MockNotification.permission = "granted";
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.permission).toBe("granted"));

    let shown = false;
    await act(async () => {
      shown = await result.current.showNotification("Test Title", { body: "Hello traveler" });
    });

    expect(shown).toBe(true);
    expect(swShowNotification).toHaveBeenCalledTimes(1);
    const [title, options] = swShowNotification.mock.calls[0];
    expect(title).toBe("Test Title");
    expect(options).toMatchObject({ body: "Hello traveler", icon: "/pwa-192x192.png" });
  });

  it("does not show a notification when permission is not granted", async () => {
    MockNotification.permission = "denied";
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.permission).toBe("denied"));

    let shown = true;
    await act(async () => {
      shown = await result.current.showNotification("Blocked", { body: "nope" });
    });

    expect(shown).toBe(false);
    expect(swShowNotification).not.toHaveBeenCalled();
  });

  it("fires immediately when a scheduled time is in the past", async () => {
    MockNotification.permission = "granted";
    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.permission).toBe("granted"));

    let ok = false;
    await act(async () => {
      ok = await result.current.scheduleNotification("Past Reminder", {
        body: "should fire now",
        scheduledTime: new Date(Date.now() - 1000),
      });
    });

    expect(ok).toBe(true);
    expect(swShowNotification).toHaveBeenCalledTimes(1);
  });
});
