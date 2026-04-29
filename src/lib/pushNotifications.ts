// Frontend helpers for the Web Push opt-in/out flow.
// VAPID public key must be set as VITE_VAPID_PUBLIC_KEY in .env (build-time).

import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export const isPushSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

export const getPushPermission = (): NotificationPermission =>
  isPushSupported() ? Notification.permission : 'denied';

// Convert the URL-safe base64 VAPID public key into the Uint8Array the browser wants
const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

const getRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg ?? null;
};

// Saves the Web Push subscription to Supabase. Idempotent (UNIQUE on user_id+endpoint).
const saveSubscriptionToServer = async (sub: PushSubscription): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const json = sub.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!p256dh || !auth) throw new Error('Subscription missing keys');

  const { error } = await supabase.from('user_push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent.slice(0, 200),
      last_used_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,endpoint' }
  );
  if (error) throw error;
};

const removeSubscriptionFromServer = async (endpoint: string): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('user_push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint);
};

export type SubscribeFailure =
  | 'unsupported'
  | 'no_vapid_key'
  | 'permission_denied'
  | 'no_service_worker'
  | 'subscribe_failed'
  | 'save_failed';

export type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: SubscribeFailure; error?: unknown };

const FAILURE_MESSAGES: Record<SubscribeFailure, string> = {
  unsupported: "This browser doesn't support push notifications.",
  no_vapid_key: "VAPID public key isn't configured. Add VITE_VAPID_PUBLIC_KEY to your .env and restart the dev server.",
  permission_denied: "Browser blocked notifications. Enable them in site settings.",
  no_service_worker: "Service worker isn't registered yet. Reload the page and try again.",
  subscribe_failed: "Browser refused the subscription. Check the console for details.",
  save_failed: "We got the subscription but couldn't save it. Check your connection.",
};

export const describeSubscribeFailure = (reason: SubscribeFailure): string => FAILURE_MESSAGES[reason];

/**
 * Asks for permission and registers a Web Push subscription.
 * Returns a tagged result so callers can show a specific error message.
 */
export const subscribeToPush = async (): Promise<SubscribeResult> => {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  if (!VAPID_PUBLIC_KEY) {
    console.warn('VITE_VAPID_PUBLIC_KEY not set in .env');
    return { ok: false, reason: 'no_vapid_key' };
  }

  let permission: NotificationPermission;
  try {
    permission = await Notification.requestPermission();
  } catch (error) {
    return { ok: false, reason: 'permission_denied', error };
  }
  if (permission !== 'granted') return { ok: false, reason: 'permission_denied' };

  const reg = await getRegistration();
  if (!reg) return { ok: false, reason: 'no_service_worker' };

  let sub: PushSubscription | null;
  try {
    sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
  } catch (error) {
    console.error('Push subscribe() failed:', error);
    return { ok: false, reason: 'subscribe_failed', error };
  }

  try {
    await saveSubscriptionToServer(sub);
  } catch (error) {
    console.error('Saving push subscription failed:', error);
    return { ok: false, reason: 'save_failed', error };
  }

  return { ok: true };
};

/**
 * Unsubscribes from push and removes the subscription from the server.
 */
export const unsubscribeFromPush = async (): Promise<void> => {
  const reg = await getRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await removeSubscriptionFromServer(endpoint);
};

/** Quick check: is the current device subscribed? */
export const isCurrentlySubscribed = async (): Promise<boolean> => {
  const reg = await getRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
};
