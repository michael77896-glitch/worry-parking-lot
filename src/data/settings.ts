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
