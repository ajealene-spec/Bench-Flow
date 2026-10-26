# Bench Flow on the App Store: checklist

This covers the iOS build made with Capacitor 7. The native project lives in `ios/` (Swift Package Manager, no CocoaPods).

## Before first upload: decide the bundle ID

The bundle ID is `app.benchflow.notebook` (set in `capacitor.config.ts` as `appId`, and in `ios/App/App.xcodeproj`). You can change it **before your first App Store upload**. After that, Apple treats it as a different app. To change it: edit `appId` in `capacitor.config.ts`, change `PRODUCT_BUNDLE_IDENTIFIER` in Xcode (Signing & Capabilities), then run `npm run ios:sync`.

## 1. Install Xcode
- [ ] Install Xcode from the Mac App Store (large download, about 10 GB or more).
- [ ] Open it once and accept the license. Let it install the iOS platform.
- [ ] Point the command line tools at Xcode. You run this yourself:
  `sudo xcode-select -s /Applications/Xcode.app`
- [ ] Check it: `xcodebuild -version` should print an Xcode version, not an error.

## 2. Open and build the project
- [ ] From the project folder: `npm install`, then `npm run ios:sync` (builds the web app and copies it into `ios/`).
- [ ] Create the icon and splash images: `npm run ios:assets` (run again if `src/assets/brand/icon.svg` changes).
- [ ] Open the project: `npm run ios:open`. Xcode opens `ios/App/App.xcodeproj`.

## 3. Signing
- [ ] In Xcode, select the **App** target, then **Signing & Capabilities**.
- [ ] Tick **Automatically manage signing**.
- [ ] Choose your **Team**. Sign in with your Apple ID under Xcode > Settings > Accounts first.
- [ ] Confirm the bundle identifier matches `app.benchflow.notebook` (or your new one).

## 4. Run on the simulator or your iPhone
- [ ] Pick an iPhone simulator (or your connected iPhone) in the Xcode toolbar and press Run.
- [ ] Check: the notch and home bar do not cover the nav or the timer tray; timers ask for notification permission on first start; a timer finishing gives a haptic tap.
- [ ] Check offline: turn on Airplane Mode and confirm the app still opens and runs an experiment.
- [ ] Physical device: enable Developer Mode on the iPhone (Settings > Privacy & Security > Developer Mode) if prompted.

## 5. Apple Developer Program
- [ ] Enroll at developer.apple.com/programs. It costs **$99 per year**, and approval can take a day or two.
- [ ] Enrollment as an individual is enough for a personal app. The name on the account appears as the seller.

## 6. App Store Connect
- [ ] Go to appstoreconnect.apple.com > Apps > **+** > New App.
- [ ] Platform iOS, name **Bench Flow**, primary language, the bundle ID above, and a SKU (any unique text, for example `benchflow-ios-1`).
- [ ] Add the **Privacy Policy URL**. Use the public page once the site is deployed: `https://bench-flow.vercel.app/privacy`.
- [ ] Add a short description, keywords, support URL (the GitHub issues page) and category (Productivity or Medical; Productivity fits best for a lab notebook).

## 7. Privacy nutrition label
Answer **Data Not Collected** for every data type. Bench Flow stores data only on the device and has no analytics or tracking. The optional AI features send protocol text only when the user adds their own key and asks; the app's own server does not keep it. Re-check this if you ever add analytics, crash reporting or accounts. Those change the answers.

## 8. Age rating
- [ ] Answer the questionnaire in App Store Connect. Every category is **None**. There is no user-generated public content, no web browsing for children, and no gambling. The result is likely 4+.

## 9. Screenshots
- [ ] **6.9-inch iPhone** (required): 1320 x 2868 or 1290 x 2796 px. Take them from the iPhone 16 Pro Max or 17 Pro Max simulator (Cmd+S in Simulator saves a screenshot).
- [ ] **13-inch iPad** (required if the app runs on iPad): 2064 x 2752 or 2048 x 2732 px. Use an iPad Pro 13-inch simulator.
- [ ] Use 3 to 10 screenshots per size. Show a live experiment, the timer tray and the Focus Mode step view.

## 10. Archive and upload
- [ ] In Xcode, set the run destination to **Any iOS Device (arm64)**.
- [ ] Bump the version if you re-upload: **Product > Archive**. Xcode writes the version under the target's General tab (Version 1.0, Build 1 for the first upload).
- [ ] When the archive finishes, the Organizer window opens. Choose **Distribute App > App Store Connect > Upload**. Keep the defaults and let Xcode manage signing.
- [ ] In App Store Connect, the build appears under TestFlight after processing (10 to 30 minutes). Pick it under the app version, then **Submit for Review**.

## 11. Review tips (avoid guideline 4.2, "minimum functionality")
Apple rejects apps that are a website in a wrapper. Lead the review notes with what is native:
- Local notifications when a timer ends, even with the app in the background.
- Haptic feedback when a timer completes.
- Full offline use: protocols, experiments and notes live in the device's database.
- Safe-area layout for the notch and home bar, and the splash and status bar set up natively.
- Add a short **Review notes** paragraph: no account is needed; the app works fully offline; the optional AI features need a user-supplied key and are not required to review the app.
- Ask the reviewer to try: create a protocol from pasted text, start an experiment, start a timer and lock the phone.

## Known gaps
- `npx cap add ios --packagemanager SPM` fails in Capacitor CLI 7.6.9: the flag is lowercased before the CocoaPods check. The iOS project was created from the same SPM template with `cap sync ios`. Re-running `cap add` is not needed.
- The Vercel `/api` routes must stay online for the AI features. Those features are optional, so the app still works if they are down.
