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

6. **Rewards stay calm, free, and private.** Tokens, boxes, cars, paints, and parts are stored only on the phone. Boxes can never be bought with real money: no purchase APIs, no ads for boxes, no "buy tokens", ever (a test fails if a payment library appears). Nothing resets or is taken away, so no streaks that break; no countdowns, limited-time offers, or scarcity. Odds are always shown on the odds screen and come from the same table the game rolls from (`src/constants/rewards.ts`). Rewards never depend on *what* the user answered: every "Did this actually happen?" answer earns the same.

## Product rules

- **Rewards** (rules live in `src/constants/rewards.ts`, logic in `src/data/rewards.ts` and `src/data/loot.ts`, both tested without a phone):
  - Tokens: +5 for parking a worry (first 3 per day), +20 for finishing a worry window (a visit where at least one car was let go or given a small step; once per window), +10 per check-in answer.
  - Boxes: a Glovebox per finished window; a Toolbox when the 5th window of a Monday-to-Sunday week is finished; a Golden Crate for the 10th, 25th, and 50th worry let go. A Glovebox has a 2% and a Toolbox a 5% chance of giving a Golden Crate instead. Golden Crates are always Epic or better. Every 10th box is guaranteed Epic or better.
  - Rarities Common / Rare / Epic / Legendary (gray, blue, purple, gold; always shown with their name). The seven starters are Common. Rare, Epic, and Legendary cars are locked placeholders in `src/constants/car-data.ts`; until a car's art exists, a roll that lands on a car of a rarity with none gives a mod part of that rarity instead. Say so on the odds screen (it does).
  - A duplicate car waits for the user to choose Keep (a separate copy with its own paint and parts) or Trade (for a Glovebox).
  - Mod shop: Gloss paint (10 colors) from the start; Matte, Metallic, Pearlescent, Chrome after 5, 15, 30, 50 finished windows; Color-shift only from Golden Crates (then free on any car). Parts have five slots (rims, spoiler, underglow, plate, stickers); their pictures are placeholders. Paint is drawn by recoloring the car picture with an SVG color matrix (`paintMatrix`), so check it on a device.
  - Each worry stores `ownedCarId`, so repainting a car updates the worries already parked in it.
  - The hidden dev menu (long-press the gate) can add tokens, boxes, and finished windows. It is development-only.

- Visiting a worry (the "Visiting hours" screen): the user picks **Let it go** (car drives out) or **Plan one small step** (they type up to 140 characters), or **Not now** (nothing saved, the car stays parked and locked). The first two save the choice, the step, and the date (`reviewedAt`) via `markReviewed`; the "Did this actually happen?" check-in still comes 7 days after parking and shows the step.
- The daily reminder reads "The gate is open. Time to visit your parked worries." Tapping it opens `/review`.
- **Test tools are development-only.** Long-pressing the gate on the Lot tab (1.5 s) opens a hidden menu to open the gate by hand for 15 minutes and to send the reminder in 5 seconds. They exist only when `__DEV__` is true; `setTestWindow` does nothing in release builds, so the lock rule can't be bypassed by real users. Never ship a visible "open now" control.
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

## Design: the night lot

Each parked worry is a car in a painted parking space on dark asphalt. The worry window is when the gate barrier lifts and you can visit your cars. A parking ticket shows when a car's gate opens. Calm above all: soft night colors, slow animations, nothing flashing, no sound.

- Palette and type live in `src/constants/theme.ts` (`Night`, plus a higher-contrast variant `useTheme()` picks when Increase Contrast is on). Use semantic tokens, never hex values in screens. The warm lamp `accent` is for the one primary action and "the gate is open"; the soft-coral `crisis` color is only for crisis help. Don't add red.
- The app is dark-only on purpose (the lot at night is its identity); there's no in-app appearance switch. `Appearance.setColorScheme('dark')` keeps system alerts, keyboard, and pickers dark too.
- Text uses the system font and scales with Dynamic Type; nothing below 13 pt, nothing lighter than regular. Headings use SF Pro Rounded (`title`, `subtitle`). Keep contrast at 4.5:1 or better for text (the numbers are in `theme.ts`).
- Illustrations are in `src/components/lot/` (`Car`, `ParkingSpot`, `Gate`, `ParkingTicket`). The gate, ticket, and painted lines are drawn with `react-native-svg`; the cars are top-down PNGs in `assets/cars/`, all facing up, trimmed and sized to 480 px tall (about 200 KB each). They are decorative: hide them from VoiceOver and put the meaning in text.
- **The car catalog** is `src/constants/car-catalog.ts`: id, name, style group (JDM / Euro / American), picture, `locked` flag, plus `aspect` and `length` so cars fit their spots. The seven starter cars are all unlocked. The database stores only a car's id (`worries.car`, no fixed list), so a new car is a picture plus a catalog entry, no migration. Everything asks `isUnlocked(car)` whether a car can be used; the Garage tab draws locked cars as silhouettes. The file's header explains how to add locked cars, paints, and mods later.
- When parking, a random unlocked car pulls into the spot and can be swapped before confirming. Cars are always fitted into a spot with `SpotCar`/`Car` (never stretched, nose-up, shorter cars a little smaller). Check any new picture faces up, like the others.
- Motion: slow, one-shot (car settles in, gate lifts, car drives off). No looping animations. Use Reanimated with `ReduceMotion.System` so Reduce Motion is honored. Never make people wait on an animation longer than ~0.5 s. Use `x.set(...)` for shared values written inside effects (the React Compiler lint requires it).
- **The one lively exception is opening a box** (`src/app/open-box.tsx`): the box shakes harder, bursts open, a reel of cards spins about 4 s, then the winner pops with particles and one soft flash of its rarity color. Keep it kind: the flash is a single pulse (never a strobe or more than three per second), Skip is always there, and Reduce Motion or Quick opening (a Settings switch) skip the show entirely. Sounds (`assets/sounds/`, made by `node scripts/make-sounds.js`) are soft, have a mute toggle on the screen and in Settings, and respect the silent switch. Haptics are strong only here, and only at the shake, the burst, and the landing: none on each reel tick (that made the spin stutter). `src/dev/reel-lab.tsx` (development only, in the Garage's Test boxes card) measures what slows the reel.
- The reel is honest: the reward is rolled with the real odds and saved before the spin, and filler cards come from the same odds with nothing arranged around the winner (`buildReel`, with tests). Never stage near-misses.
- State is never color alone: the gate and cars always have a written status.

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
