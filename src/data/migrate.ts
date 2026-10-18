import type { SQLiteDatabase } from 'expo-sqlite';

/** Bump this and add a step below when the schema changes. */
const LATEST_VERSION = 1;

export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= LATEST_VERSION) return;

  await db.withTransactionAsync(async () => {
    if (current < 1) {
      await db.execAsync(`
        CREATE TABLE worries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          text TEXT NOT NULL,
          parkedAt TEXT NOT NULL,
          unlocksAt TEXT NOT NULL,
          followUpDueAt TEXT NOT NULL,
          reviewedAt TEXT,
          outcome TEXT CHECK (outcome IN ('happened', 'partly', 'did_not_happen')),
          outcomeAt TEXT
        );
        CREATE TABLE settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `);
    }
    await db.execAsync(`PRAGMA user_version = ${LATEST_VERSION}`);
  });
}
