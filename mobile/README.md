# Mizan POS for Android

The Android app opens the cloud app (`server.url` in `capacitor.config.json`)
and adds what a browser can't do:

- **Camera barcode scanning** — Google ML Kit (`@capacitor-mlkit/barcode-scanning`).
- **Receipt printing** — paired Bluetooth printers and Sunmi terminals' built-in
  printer ("InnerPrinter"), through our own plugin
  (`android/app/src/main/java/app/mizan/pos/MizanPrinterPlugin.java`). The web
  app draws the receipt and sends ESC/POS raster bytes (`apps/web/src/lib/escpos.ts`).
- **Push notifications** — Firebase Cloud Messaging (`@capacitor/push-notifications`).

Because the screens come from the server, every web change reaches phones
immediately. A new APK is only needed when this folder changes.

## Releases

The **Release Android app** workflow builds the APK on every change to `mobile/`
(or by hand from the Actions tab) and uploads it to the GitHub release
`android`. The download link never changes:

`https://github.com/ZakariaBrahimi/TayssirSoftware-Electron-App/releases/download/android/Mizan-POS.apk`

It is also on the website's `/download` page.

## Signing key (do this once)

Without a key, each build is signed with a temporary key and phones must
uninstall the app before installing a newer APK. Create a key once and keep it
safe (losing it means users reinstall):

```sh
keytool -genkeypair -v -keystore mizan-release.jks -alias mizan \
  -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 mizan-release.jks   # copy the output
```

In GitHub → Settings → Secrets and variables → Actions, add:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | the base64 output |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password |
| `ANDROID_KEY_ALIAS` | `mizan` |
| `ANDROID_KEY_PASSWORD` | the key password |

The same key is needed later for the Google Play Store.

## Push notifications (optional)

1. Create a project at <https://console.firebase.google.com> and add an Android
   app with the package name `app.mizan.pos`.
2. Download `google-services.json` and save its content as the GitHub secret
   `GOOGLE_SERVICES_JSON`, then run the workflow again.
3. In Firebase → Project settings → Service accounts, generate a private key and
   set its JSON (or its base64) as `FIREBASE_SERVICE_ACCOUNT` on the server
   (Railway). Settings → Notifications then shows the phones that receive the
   daily stock summary.

## Local development

```sh
cd mobile
npm install
npx cap sync android
npx cap open android   # Android Studio
```

To test against a local server, temporarily set `server.url` to
`http://<your-computer-ip>:3000/pos` and add `"cleartext": true`.
