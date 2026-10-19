import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_WINDOW, validateWindow, type WindowSettings } from './window';

export async function getSettings(db: SQLiteDatabase): Promise<WindowSettings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key IN ('startMinutes', 'lengthMinutes')`,
  );
  const stored = Object.fromEntries(rows.map((r) => [r.key, Number(r.value)]));
  return {
    startMinutes: stored.startMinutes ?? DEFAULT_WINDOW.startMinutes,
    lengthMinutes: stored.lengthMinutes ?? DEFAULT_WINDOW.lengthMinutes,
  };
}

/** Whether the user wants a daily reminder at the start of their window. Off until they turn it on. */
export async function getRemindersEnabled(db: SQLiteDatabase): Promise<boolean> {
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'remindersEnabled'`,
  );
  return row?.value === '1';
}

export async function saveRemindersEnabled(db: SQLiteDatabase, enabled: boolean): Promise<void> {
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES ('remindersEnabled', $value)
     ON CONFLICT(key) DO UPDATE SET value = $value`,
    { $value: enabled ? '1' : '0' },
  );
}

async function getFlag(db: SQLiteDatabase, key: string, fallback: boolean): Promise<boolean> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = $key', {
    $key: key,
  });
  return row ? row.value === '1' : fallback;
}

async function saveFlag(db: SQLiteDatabase, key: string, value: boolean): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES ($key, $value) ON CONFLICT(key) DO UPDATE SET value = $value',
    { $key: key, $value: value ? '1' : '0' },
  );
}

/** Sound effects when opening boxes. On until the user mutes them. */
export const getSoundEnabled = (db: SQLiteDatabase) => getFlag(db, 'soundEnabled', true);
export const saveSoundEnabled = (db: SQLiteDatabase, on: boolean) => saveFlag(db, 'soundEnabled', on);

/** Quick opening skips the reel and goes straight to the reveal. Off until the user turns it on. */
export const getQuickOpening = (db: SQLiteDatabase) => getFlag(db, 'quickOpening', false);
export const saveQuickOpening = (db: SQLiteDatabase, on: boolean) => saveFlag(db, 'quickOpening', on);

/** True once the user has finished the first-run walkthrough. */
export async function getOnboardingDone(db: SQLiteDatabase): Promise<boolean> {
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'onboardingDone'`,
  );
  return row?.value === '1';
}

export async function saveOnboardingDone(db: SQLiteDatabase): Promise<void> {
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES ('onboardingDone', '1')
     ON CONFLICT(key) DO UPDATE SET value = '1'`,
  );
}

export async function saveSettings(
  db: SQLiteDatabase,
  changes: Partial<WindowSettings>,
): Promise<WindowSettings> {
  const next = { ...(await getSettings(db)), ...changes };
  validateWindow(next);
  await db.withTransactionAsync(async () => {
    for (const [key, value] of Object.entries(next)) {
      await db.runAsync(
        'INSERT INTO settings (key, value) VALUES ($key, $value) ON CONFLICT(key) DO UPDATE SET value = $value',
        { $key: key, $value: String(value) },
      );
    }
  });
  return next;
}
