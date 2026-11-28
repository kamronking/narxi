# Security

## Firestore rules (MOST IMPORTANT)
`firestore.rules` locks the database so each visitor can read/write ONLY their
own `users/{uid}` document. This protects stored phone numbers: no visitor can
read anyone else's data. The Cloudflare Worker uses the Admin service account,
which bypasses these rules, so the Telegram bot keeps working.

Deploy after any change:
```
npm i -g firebase-tools
firebase login
firebase deploy --only firestore:rules --project narxi-e5d33
```
Or paste the contents of `firestore.rules` into
Firebase Console -> Firestore Database -> Rules -> Publish.

Never ship `allow read, write: if true;` (Firebase's 30-day test mode) to production.

## Not a secret
The `apiKey` in `docs/index.html` is a public Firebase project identifier, not a
password. Security comes from the rules above, not from hiding it.

## Secrets live in Cloudflare, never in the repo
`TG_BOT_TOKEN`, `GH_TOKEN`, `FIREBASE_SA`, `WEBHOOK_SECRET`, `ADMIN_CHAT` are
Worker env bindings. Never paste them into code, issues, or chats.

## Account hardening (do once, by hand)
Turn on 2FA and use a unique password on every account the project depends on:
- Namecheap (domain) · Cloudflare (DNS + Worker) · GitHub (code) · Google/Firebase (data)
Losing any one of these = losing the project.

## Rate limiting
Add a Cloudflare rule so `api.narxi.site` can't be spammed:
Cloudflare dashboard -> Security -> WAF -> Rate limiting rules ->
~30 requests / minute per IP on `api.narxi.site`.
