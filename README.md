# Cash

A React Native CLI app for Android and iOS with one shared demo wallet and a local SQLite backend. The opening wallet has ৳12,000 in simulated deposits and ৳450 in trade profits. The 7-day and 30-day charts show cumulative trading P/L within each selected period.

## Run locally

Use Node 24 or later, Xcode and CocoaPods for iOS, or Android Studio with the Android SDK for Android. Start the API and Metro in separate terminals.

```sh
npm install
npm run server
```

```sh
npm start
```

With an Android emulator running, use `npm run android`. For the iOS simulator, run `pod install --project-directory=ios` followed by `npm run ios`. For a USB-connected Android phone with USB debugging enabled, run `adb reverse tcp:4100 tcp:4100` before `npm run android`. The Android emulator can also reach the host via 10.0.2.2:4100. The iOS simulator uses 127.0.0.1:4100.

## Demo controls

The server prints its generated admin key when it starts. Enter that key under Admin. Set CASH_ADMIN_PIN before starting the server to supply your own key. CASH_DB overrides the database location (default server/cash.sqlite).

- Deposit adds a selected bKash preset to the demo wallet.
- Trade shows the administrator's signed return before confirmation. A ৳1,000 stake at +6.25% credits ৳62.50. The server settles the signed result in integer paisa, rounding its absolute value to the nearest paisa. A rate change invalidates a stale trade quote.
- Withdraw immediately reserves the requested amount. Approval finalizes the reservation. Declining restores the amount. Activity shows the decision.
- Pull down on a page to refresh after changes from another simulator.

This is a local single-wallet demonstration. All deposits and withdrawals are simulated. Customer accounts, live bKash payments, reconciliation, and production deployment are outside this demo.

## Android release APK

The release bundles its JavaScript and connects to the local demo API. For an Android phone, start the server with `npm run server`, enable USB debugging, connect the phone, and run `adb reverse tcp:4100 tcp:4100`. A phone with the debug version already installed requires removal of that version before installing the release because their signing certificates differ. The shared wallet is stored by the server.

Build from the `android` directory with `./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64`. The signed file is written to `app/build/outputs/apk/release/app-release.apk`. Back up the private `android/signing` directory securely to sign future updates with the same certificate.
