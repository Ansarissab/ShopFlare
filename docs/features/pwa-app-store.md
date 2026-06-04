# PWA App Store Distribution

## Overview

ShopFlare is a PWA — it runs as a full-screen native app when installed from the browser.
It can also be distributed via Google Play using Trusted Web Activities (TWA) at $0 hosting cost.

## iOS — Add to Home Screen (Recommended)

No App Store submission needed. iOS 16.4+ supports PWA push notifications when installed.

1. Open your store URL in Safari on iPhone/iPad
2. Tap the Share button (box with arrow)
3. Select "Add to Home Screen"
4. Tap Add

**Push notifications:** Work on iOS 16.4+ when the PWA is launched from the home screen.
**iOS 26+:** Every site added to home screen opens as a web app automatically.

## Google Play — Trusted Web Activity (TWA)

A TWA wraps your PWA in a thin Android shell. Users install from Play; the app opens your URL.

### Prerequisites

- Java JDK 11+
- Android SDK (or Android Studio)
- Google Play Developer account ($25 one-time fee)
- Your deployed store URL (e.g. `https://mystore.pages.dev`)

### Step 1: Install Bubblewrap

```bash
npm install -g @bubblewrap/cli
```

### Step 2: Configure packaging/twa/twa-config.json

Edit `packaging/twa/twa-config.json`:
- Set `host` to your store domain (e.g. `mystore.pages.dev`)
- Set `name` and `launcherName` to your store name
- Set `packageId` (reverse domain, e.g. `com.mystore.shop`)
- Match `themeColor` / `backgroundColor` to your store colors

### Step 3: Generate signing key

```bash
cd packaging/twa
keytool -genkeypair -v -keystore release.keystore -alias release \
  -keyalg RSA -keysize 2048 -validity 10000
```

Keep `release.keystore` private — **never commit it to git**.

### Step 4: Get SHA-256 fingerprint

```bash
keytool -list -v -keystore release.keystore -alias release | grep "SHA256:"
```

Copy the fingerprint (format: `XX:XX:XX:...`).

### Step 5: Update assetlinks.json

Edit `public/.well-known/assetlinks.json` — replace `REPLACE_WITH_YOUR_SIGNING_KEY_SHA256_FINGERPRINT` with your fingerprint (colons included).

Deploy your store so `https://your-domain/.well-known/assetlinks.json` is accessible.

### Step 6: Init and build

```bash
cd packaging/twa
bubblewrap init --manifest https://your-domain/manifest.webmanifest
bubblewrap build
```

This produces `app-release-signed.apk`.

### Step 7: Upload to Play Console

1. Go to [play.google.com/console](https://play.google.com/console)
2. Create a new app
3. Upload the APK under Releases → Production (or Internal Testing first)
4. Fill in store listing (screenshots, description)
5. Submit for review

### Updating the app

When you push changes to your store, users get them immediately (it's a web app).
Only rebuild the APK when you change app metadata (name, icon, package ID).

## PWABuilder (Alternative)

[PWABuilder](https://www.pwabuilder.com) provides a GUI for both Android TWA and iOS packaging.
Enter your store URL → it generates an installable package. Good for non-developers.

## Lighthouse PWA Audit

Run regularly to ensure installability:

```bash
npx lighthouse https://your-store-url --only-categories=pwa --output=html
```

All categories should pass (green).
