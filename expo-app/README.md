# CollexBase Mobile (Expo / React Native)

The native companion app for CollexBase. It reuses the **same backend API** as the
web app (the Next.js routes under `/api/*`), adding a smart card **scanner**,
marketplace, auctions, trades, groups, showcases, the AI advisor, chat, and your
profile — plus push notifications.

> **This app does not run in the v0 web preview.** It is a separate React Native
> runtime. Use the Expo tooling below on your own machine to run, build, and publish it.

---

## 1. Prerequisites

- Node.js 18+
- A deployed CollexBase web app (its URL is the API base for the app)
- [Expo account](https://expo.dev) + the EAS CLI: `npm install -g eas-cli`
- For store submission: a **Google Play Console** account ($25 one-time) and/or an
  **Apple Developer** account ($99/year)

## 2. Configure the API URL

The app talks to your deployed backend. Copy the example env file and set the URL:

```bash
cp .env.example .env
# edit .env
EXPO_PUBLIC_API_URL=https://your-collexbase-app.vercel.app
```

For local testing against a dev server on the same network, use your machine's LAN IP
(e.g. `http://192.168.1.20:3000`) — `localhost` does not resolve from a physical phone.

## 3. Install & run in development

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** (Android/iOS) for quick iteration. Native modules
(camera, secure store, notifications) work fully in a **development build** (next step).

## 4. Build an installable app with EAS

```bash
eas login
eas build:configure

# Android APK for direct download (powers the web /download page)
eas build --platform android --profile preview

# Production app bundle for the Play Store
eas build --platform android --profile production

# iOS (requires an Apple Developer account)
eas build --platform ios --profile production
```

The `preview` profile produces an **APK** you can host and link from the web
`/download` page. The `production` profile produces an **AAB** (Android) / **IPA** (iOS)
for the stores.

## 5. Publish to the stores

```bash
# Google Play
eas submit --platform android --latest

# Apple App Store
eas submit --platform ios --latest
```

Follow the prompts to connect your Play Console / App Store Connect credentials.

## 6. Over-the-air updates

```bash
eas update --branch production --message "Bug fixes"
```

JS-only changes ship instantly without a new store review.

---

## Project structure

```
expo-app/
├── app/                      # expo-router file-based routes
│   ├── _layout.tsx           # Root stack + AuthProvider + push registration
│   ├── login.tsx             # Email/password login (modal)
│   ├── (tabs)/               # Bottom tab navigator
│   │   ├── _layout.tsx       # Tab bar config
│   │   ├── index.tsx         # Home feed (hero + market highlights + quick actions)
│   │   ├── market.tsx        # Marketplace browser
│   │   ├── scan.tsx          # Smart scanner (single + multi card)
│   │   ├── explore.tsx       # Hub linking to feature screens
│   │   └── profile.tsx       # Your profile + stats + sign out
│   ├── auctions.tsx          # Live auctions
│   ├── trades.tsx            # Trade proposals
│   ├── groups.tsx            # Your groups
│   ├── showcases.tsx         # Featured showcases
│   ├── advisor.tsx           # AI opportunities/advisor
│   └── chat.tsx              # Conversations
├── components/
│   ├── ui.tsx                # Shared primitives (Screen, Card, Button, Badge…)
│   └── ListingCard.tsx       # Marketplace card
├── lib/
│   ├── api.ts                # Fetch client (adds Bearer token + JSON handling)
│   ├── auth.ts               # SecureStore token persistence
│   ├── AuthContext.tsx       # Session provider (login / logout / me)
│   ├── notifications.ts      # Expo push registration + handlers
│   ├── theme.ts              # Brand design tokens (matches the web app)
│   └── types.ts              # Shared backend response shapes
├── assets/                   # Icon + splash
├── app.json                  # Expo config (plugins, permissions, scheme)
├── eas.json                  # EAS build/submit profiles
└── .env.example              # API URL template
```

## How it connects to the backend

- **Auth:** `POST /api/auth/login` returns a JWT `token`. It's stored in
  `expo-secure-store` and sent as `Authorization: Bearer <token>` on every request,
  exactly matching `getAuthUserId` on the server. No backend auth changes are needed.
- **Scanner:** uploads a photo and calls `POST /api/scan` (single or multi mode),
  which reuses the existing AI valuation pipeline (`lib/ai-valuation.ts`) and returns
  identification, grading, value, trend, and a CollexSpark comment. Results can be
  saved via the existing collection-create endpoint.
- **Everything else** reads the same endpoints the web app uses
  (`/api/market/list`, `/api/auctions/list`, `/api/trades/list`, `/api/groups/mine`,
  `/api/showcase/discover`, `/api/ai/opportunities`, `/api/chat/threads`,
  `/api/profile/:username`).

## Push notifications

`lib/notifications.ts` registers the device for Expo push tokens and posts the token to
`/api/notifications/register-device` (add this lightweight route on the backend to store
tokens per user, then send via Expo's push service). Notification taps deep-link into the
relevant screen.
