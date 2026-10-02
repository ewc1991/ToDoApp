// Push subscription setup for the "Enable notifications" menu item.
// Firestore write (where the subscription is saved) stays in Header.jsx,
// next to the auth/db imports it already has — this file is just the
// browser-API half.

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window

// applicationServerKey has to be bytes, not the base64url string VAPID keys
// are normally handed around as.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

// Reuses an existing subscription rather than minting a new one each time —
// resubscribing with the same key returns the same endpoint anyway, but this
// skips the no-op round trip.
export async function subscribeToPush() {
  if (!pushSupported()) return null
  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!publicKey) { console.error('VITE_VAPID_PUBLIC_KEY is not set'); return null }

  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  })
  return subscription.toJSON() // { endpoint, keys: { p256dh, auth } }
}

// A Firestore document id can't contain "/", which every push endpoint URL
// does — base64url-encode it instead. Deterministic, so re-subscribing the
// same device overwrites its own doc rather than piling up duplicates.
export const subscriptionDocId = (endpoint) =>
  btoa(endpoint).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
