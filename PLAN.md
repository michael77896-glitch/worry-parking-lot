# Worry Parking Lot: v1 Plan

Screens in the order to build them. Each step should leave the app runnable in Expo Go. Rules in [CLAUDE.md](CLAUDE.md) apply to every screen.

## Step 0: Foundation (no screen) — DONE

Built: SQLite data layer with the lock rule (tested), window math, settings, tab shell with the crisis button, theme tokens, shared disclaimer. The starter Home/Explore content and web-only files were removed.

- Replace the starter Home/Explore tabs and template content.
- Theme (light/dark), shared text and button components, a persistent **crisis button** in the app shell.
- `src/data/`: SQLite setup, a `worries` table (id, text, parkedAt, unlocksAt, reviewedAt, followUpDueAt, outcome, outcomeAt), and the lock rule enforced in queries.
- Settings store for the worry window (time, length).

## Screens

1. **Crisis Resources** (DONE, numbers still need verifying before release): Built first because it is required and everything links to it. Static and offline. 988 Suicide & Crisis Lifeline (call and text 988), 911 for immediate danger, a short calm line saying you are not alone. Reachable from every screen.
2. **Park a Worry** (DONE; pushed route `/park` with its own Back link, linked from the Parking Lot): The main action. A text box, a "Park it" button, and a confirmation that says when it will unlock. The text is not shown again after parking.
3. **Parking Lot** (DONE; lists unreviewed worries via `listParked`, which never selects the text; opens-at times come from `readableAt`; doesn't live-refresh when the window opens, only on screen focus): Lists parked worries without revealing their text (count, parked time, "unlocks at ..."). Empty state included. This is the home screen.
4. **Worry Window Setup** (DONE; route `/window`, opened from Settings; the reminder is optional and off until the user turns it on; Step 9's "delete all data" must also call `cancelWindowReminder()`): The user picks the daily time and length. Ask for the notification permission here, with a plain explanation of why. Schedule the daily local reminder.
5. **Daily Review** (DONE; route `/review`, entered from a "Review N worries" button on the Parking Lot. Decision to confirm: "Release" marks the worry reviewed; "Keep parked" changes nothing, so the worry stays locked and returns at the next window): Opens when the window is open. Walks through each unlocked worry one at a time. For each: read it, then "Release", or "Keep an eye on it". Marks it reviewed and sets the 7-day follow-up. Closed state shows the time of the next window.
6. **Follow-up ("Did this actually happen?")** (DONE; route `/followup`, entered from a "Look back at N worries" button on the Parking Lot or by tapping a check-in notification. Only reviewed worries get a check-in. "Not now" leaves one for later. Check-in notifications are optional, follow the daily-reminder setting, and are rebuilt by `syncFollowUpReminders`; Step 9's "delete" actions must call it too. The notification tap routing is untested on a device): Shown for worries 7 days after parking. Choices: happened, partly, didn't happen. Gentle copy either way. Reachable from the Parking Lot and from a local notification.
7. **Scoreboard**: Neutral numbers: worries parked, followed up, and how many came true. A simple list of past worries with outcomes. No interpretation or advice.
8. **Onboarding**: How it works in three short cards, the not-a-medical-device disclaimer, and the first-time window setup. Shown on first launch. Crisis button still visible.
9. **Settings**: Edit the window, view the disclaimer, delete one worry or all data (with confirmation), app version.

## Out of scope for v1

Accounts, cloud sync or backup, sharing, widgets, Android, any AI features, analytics.

## Open questions

- Does the 7-day follow-up count from the day it was parked, or from the day it was reviewed? The plan assumes **parked**.
- Should a worry not reviewed during its window carry over to the next day automatically? The plan assumes **yes**.
- Is "partly happened" a third outcome, or do we keep it binary? The plan assumes three.
- Is 988 enough, or do we also want Crisis Text Line (text HOME to 741741)? Confirm numbers against official sources before release. US only for v1.
- Should worry text be encrypted at rest beyond iOS file protection?
- iCloud device backups copy app data off the phone. Is that acceptable under "all data stays on the phone", or should we exclude the database from backup?
