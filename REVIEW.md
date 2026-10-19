# Pre-release review

Reviewed against [CLAUDE.md](CLAUDE.md) at commit `101e589`. Covers the source, installed dependencies, and the database file. Only what was tried on a phone during development is device-verified.

## Fix before release

1. **The crisis screen depends on the database loading.** `SQLiteProvider` in `src/app/_layout.tsx` wraps the whole app, including `/crisis`. If the database fails to open or migrate (full disk, corrupt file), the app errors or shows a blank screen with no crisis numbers. This breaks CLAUDE.md rule 3. Fix: show a fallback screen with the numbers, or move the crisis route outside the provider.
2. **The crisis numbers are unverified.** `lastVerified` in `src/constants/crisis.ts` is `null`. Confirm 988, 911, and Text HOME to 741741 against 988lifeline.org and crisistextline.org. The `sms:741741&body=HOME` link format and the `tel:` links are untested on a real phone.
3. **VoiceOver reaches the crisis button last.** It is the last element in the root view. Render it first in the tree, keeping its `zIndex`, so VoiceOver reads it first. *Fixed in the night-lot redesign.*

## Needs a decision

4. **iCloud backup vs "stays on the phone".** expo-sqlite stores the database in the app's Documents folder, which iPhone backups include. The app never sends data anywhere, but a backup copies it off the phone. Excluding it needs native code (a development build, not Expo Go). Recommended for v1: keep backups and reword the copy, e.g. "The app never sends your worries anywhere. They're included in your iPhone backup if you use one." Onboarding and Settings currently say "Nothing is sent anywhere."
5. **Notification text and the app switcher.** Lock-screen banners ("Your worry window is open", "A worry you parked a week ago…") reveal what the app is. Neutral wording avoids that. The app-switcher preview can show worry text from the Review or Look back screens.
6. **The lock is a nudge, not security.** Changing the phone's clock or time zone opens the window early, and reviewed worries stay readable in the Record tab. That is by design. Don't describe it as protection.

## Passed

- **Medical claims:** A search of all source and config found only the disclaimer itself, which appears in onboarding, Settings, and the crisis screen. The store listing is not written yet and must follow the same rule.
- **Network and logging:** No `fetch`, analytics, crash reporter, or `console` calls in the source. The only network use is the chat and helpline links, when the user taps them. Notifications are local only: no push tokens requested, `expo-updates` not installed. Notification text is fixed and never includes a worry.
- **Crisis access:** One tap from every screen including onboarding, hidden only on the crisis screen itself. The screen is static, works offline, and is not behind onboarding.
- **Lock rule:** Worry text is read in three places. `listWorries` enforces the lock in SQL. `listDueFollowUps` and `listReviewed` return only worries already reviewed.
- **Real deletion:** `secure_delete` and `VACUUM` are in place. A test confirms deleted text cannot be found in the database file afterward. All 19 data tests, typecheck, lint, and the iOS export pass.

## Housekeeping

- Several dependencies look unused: `expo-web-browser`, `expo-device`, `expo-glass-effect`, `@expo/ui`, `react-dom`, `react-native-web`, and others. Check what expo-router needs before removing any.
- The icon and splash screen are still Expo defaults.

## Open questions from PLAN.md

| Question | Status |
|---|---|
| Follow-up counts from parked or reviewed? | Built as **parked**. A worry first reviewed after day 7 gets its check-in right away. |
| Unreviewed worries carry over? | Built as **yes**. |
| "Partly" as an outcome? | Built as **three outcomes**. |
| 988 only, or Crisis Text Line too? | **Both** are in. The data is US-only; decide whether to limit the store listing to the US. |
| Encrypt at rest? | **Skip for v1.** It needs a development build and key storage, and does not help against someone holding the unlocked phone. iPhone file protection still applies. |
| iCloud backup? | See item 4. |
