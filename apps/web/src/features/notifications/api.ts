import { api } from '../../auth/api';

export async function getPushConfiguration() {
  return (
    await api.get<{ configured: boolean; publicKey?: string }>(
      '/notifications/configuration',
    )
  ).data;
}

export async function savePushSubscription(subscription: PushSubscription) {
  const value = subscription.toJSON();
  if (!value.endpoint || !value.keys?.p256dh || !value.keys.auth) {
    throw new Error('Push subscription is incomplete');
  }
  return (
    await api.post('/notifications/subscriptions', {
      endpoint: value.endpoint,
      keys: value.keys,
      userAgent: navigator.userAgent,
    })
  ).data;
}

export async function removePushSubscription(endpoint: string) {
  return (
    await api.delete('/notifications/subscriptions', { data: { endpoint } })
  ).data;
}

export function urlBase64ToUint8Array(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}
