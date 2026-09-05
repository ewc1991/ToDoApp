# Notes webhook

`POST /api/notes` writes a note straight into Firestore. The app's `onSnapshot`
listener on `users/{uid}/notes` picks it up live — an open tab updates without a
refresh.

## Setup

**1. Service account key.** Firebase Console → Project settings → Service accounts
→ *Generate new private key*. Downloads a JSON file. Treat it like a password: it
bypasses `firestore.rules` entirely. Don't commit it.

**2. Your uid.** Firebase Console → Authentication → Users → copy the User UID.
(Or run `firebase.auth().currentUser.uid` in the app's devtools console.)

**3. A shared secret.** Any long random string:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**4. Set three env vars** in Vercel → Project → Settings → Environment Variables
(Production, and Preview if you want to test there first):

| Name | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | the entire contents of the JSON file from step 1 |
| `NOTES_USER_UID` | the uid from step 2 |
| `NOTES_WEBHOOK_SECRET` | the secret from step 3 |

Paste the JSON whole, newlines and all — Vercel handles multi-line values, and
`JSON.parse` sorts out the escaped `\n` inside `private_key`.

**5. Deploy.** Push to `main`; Vercel picks up `api/notes.js` automatically. No
`vercel.json` needed — the `api/` directory works alongside the Vite build.

## Calling it

```bash
curl -X POST https://<your-app>.vercel.app/api/notes \
  -H "Authorization: Bearer $NOTES_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"body": "buy milk"}'
```

```json
{ "ok": true, "id": "1757030400000-k3f9a2c" }
```

The body can arrive three ways, whichever is easiest for the caller:

- JSON `{"body": "..."}` — also accepts `text` or `note` as the key
- raw `Content-Type: text/plain` — the whole body becomes the note
- secret in `X-Webhook-Secret:` instead of `Authorization: Bearer` — some
  automation tools can't set an auth header

## Responses

| Code | Meaning |
|---|---|
| 201 | saved, returns the new note's `id` |
| 400 | empty body |
| 401 | missing or wrong secret |
| 405 | not a POST |
| 413 | body over 10,000 characters |
| 500 | misconfigured env, or the Firestore write failed |

## iOS Shortcut

*Get Contents of URL* → your endpoint, Method `POST`, Headers
`Authorization: Bearer <secret>`, Request Body JSON with one text field `body`.
Wire it to *Dictate Text* and you have voice-to-note from the lock screen.

## Notes on hardening

There's no rate limiting. The secret is the only gate, so if it ever leaks, rotate
the env var and redeploy — that invalidates every caller at once. If you later
want per-caller revocation, swap the single secret for a list and log which one
was used.
