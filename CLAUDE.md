# Worry Parking Lot

An iPhone app built with Expo (SDK 57, Expo Router, TypeScript). Users "park" a worry, it stays locked until their daily worry window, then they review it. A week after parking, the app asks "did this actually happen?" and tracks how many worries came true.

See [PLAN.md](PLAN.md) for the v1 screens and build order. See [AGENTS.md](AGENTS.md) for Expo-specific rules (check versioned docs before touching Expo APIs; use `npx expo install` for packages).

## Non-negotiable rules

These override convenience. If a task conflicts with one, stop and ask.

1. **All data stays on the phone.** No backend, no accounts, no analytics, no crash reporters that send worry text, no third-party SDKs that make network calls with user data. Do not add a dependency that phones home. Worry text must never be logged to the console in committed code.
2. **No medical claims.** The app does not diagnose, treat, cure, or prevent anything, and must not imply it does. Do not use words like "therapy", "treatment", "anxiety disorder", "clinically proven", "heals", or "reduces anxiety" in UI copy, app store text, or code comments describing user benefit. Describe it as a journaling and reflection tool. The disclaimer ("not a medical device, not a substitute for professional care") must appear in onboarding and in Settings.
3. **Crisis resources must always be reachable.** There is a Crisis Resources screen with the 988 Suicide & Crisis Lifeline (call or text 988, US). It must be reachable in one tap from every screen (persistent entry point, not buried in Settings), must work offline, and must not depend on any data loading. Never gate it behind onboarding. Keep it factual and calm. Don't present it as a feature to be dismissed.
4. **Worries are locked until the worry window.** A parked worry cannot be viewed or edited before the user's daily window opens. The lock is the core mechanic, so enforce it in the data layer (selectors/queries), not only by hiding UI. Decide edge cases (time zone change, window edited mid-day) in one place and document them in code.
5. **Respect the user's state.** Copy is gentle and non-judgmental. Never shame a missed review or a worry that came true. The "came true" count is a neutral record, not a score to optimize.

## Product rules

- Daily worry window: user picks a time and length (default 15 minutes). Notifications are **local only** (`expo-notifications`); no push server.
- Follow-up: 7 days after a worry is parked, ask "Did this actually happen?" Outcomes are recorded per worry. The stats screen shows how many came true out of how many were followed up, never a diagnosis or interpretation.
- Deleting data must be real: the user can delete a single worry and wipe everything from Settings.

## Stack and conventions

- Routes live in `src/app/` (Expo Router); components, hooks, and data code live outside it (`src/components`, `src/hooks`, `src/data`, `src/constants`).
- Local storage: `expo-sqlite`, opened once by `SQLiteProvider` in `src/app/_layout.tsx` (it runs `migrate`). Keep all database access behind `src/data/` (import from `@/data`); screens get the db with `useSQLiteContext()` and never write SQL. Dates are stored as UTC ISO strings; "window" logic uses the device's local time zone.
- The lock rule lives in `src/data/worries.ts` (`READABLE`): `listWorries` returns locked worries with `text: null`, straight from SQL. Add new reads through that path. Window math is in `src/data/window.ts` (pure, no imports).
- Crisis access: `CrisisButton` is rendered once in the root layout and hidden only on `/crisis`. Tab screens use `<Screen>` (leaves room under the button). **Never present a screen as a native modal or sheet**: it draws above the crisis button.
- Crisis numbers/URLs are in `src/constants/crisis.ts` (unverified until `lastVerified` is set). The shared disclaimer text is `DISCLAIMER` in `src/constants/copy.ts`.
- Must run in **Expo Go on iOS** (App Store Expo Go supports SDK 57 only). Before adding a library with native code, check it ships in Expo Go; otherwise raise it before installing.
- SDK 58 starter code may not match SDK 57. Example: native tabs import from `expo-router/unstable-native-tabs`. Verify against the installed package or the v57 docs.
- iPhone first. Support dark mode, Dynamic Type, and VoiceOver labels on every interactive element.
- Don't hand-edit `ios/` or `android/` if they appear; configure in `app.json`.

## Commands

```bash
npx expo start            # dev server (scan QR in Expo Go, same Wi-Fi)
npx expo start --tunnel   # if the phone can't reach the PC
npx tsc --noEmit          # typecheck
npx expo lint             # lint
npx expo-doctor           # dependency/config diagnosis
npx expo install --fix    # align package versions with the SDK
```

Run typecheck and lint before calling any task done.

## Git

Small commits, imperative messages. Commits and PRs made by Claude end with the attribution line the harness provides.
