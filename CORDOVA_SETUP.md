# Cordova Mobile Build Guide

This project now includes a Cordova wrapper in the `cordova-app` folder.

## 1) Prerequisites

- Node.js installed
- Android Studio installed (SDK + emulator)
- Java JDK 21 (recommended)
- Gradle 8.x available in PATH

## 2) Start backend server

From project root:

```bash
npm start
```

For internet usage across different Wi-Fi networks, set your hosted backend URL before sync/build:

```powershell
$env:MOBILE_API_BASE='https://<your-render-service>.onrender.com'
npm.cmd run mobile:android:build:hosted
```

This command validates `https://<your-render-service>.onrender.com/api/health` before APK build.

For local development fallback (optional), include local candidates during sync/build:

```powershell
$env:MOBILE_INCLUDE_LOCAL_FALLBACKS='1'
npm.cmd run mobile:android:build
```

To override API URL in app runtime:

```js
localStorage.setItem('farmersfriend_api_base', 'http://YOUR_LAN_IP:3000');
```

If backend is unreachable, mobile APK falls back to on-device offline data for login and core features.

## 3) Install Cordova dependencies

From project root:

```bash
cd cordova-app
npm install
cd ..
```

## 4) Sync website files into Cordova

```bash
npm run mobile:sync
```

## 4.1) Generate app icon and splash assets

This uses your `image/logo.jpeg` and produces:

- `cordova-app/resources/icon.png`
- `cordova-app/resources/splash.png`

Then `cordova-res` generates Android density-specific images.

```bash
npm install
cd cordova-app
npm install
cd ..
npm run mobile:assets
```

## 5) Add Android platform (first time)

```bash
npm run mobile:android:add
```

## 6) Build APK

```bash
npm run mobile:android:build
```

PowerShell (if multiple JDKs are installed):

```powershell
$env:JAVA_HOME='C:\Program Files\Zulu\zulu-21'
$env:GRADLE_HOME='C:\Users\<YOUR_USER>\gradle-tools\gradle-8.10.2'
$env:PATH="$env:JAVA_HOME\bin;$env:GRADLE_HOME\bin;$env:PATH"
npm.cmd run mobile:android:build
```

APK output is typically at:

- `cordova-app/platforms/android/app/build/outputs/apk/debug/app-debug.apk`

## 7) Run on emulator/device

```bash
npm run mobile:android:run
```

## Notes

- Every time frontend files change, run `npm run mobile:sync` before build.
- `mobile:android:build` now runs full prebuild automatically:
  - sync web files
  - generate icon/splash assets
  - remove legacy duplicate launcher JPEGs
- The sync script copies:
  - `index.html`, `login.html`, `product-details.html`
  - `script.js`, `style.css`, `api.js`
  - `image/`, `database/`
