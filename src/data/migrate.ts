import type { SQLiteDatabase } from 'expo-sqlite';

/** Bump this and add a step below when the schema changes. */
const LATEST_VERSION = 3;

export async function migrate(db: SQLiteDatabase): Promise<void> {
  // Deleted rows are overwritten with zeros, not left behind in the database file.
  // (Per connection, so it is set every time the database opens.)
  await db.execAsync('PRAGMA secure_delete = ON');

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
    if (current < 2) {
      // What the user chose when they visited the worry ("let it go" or "plan one small step"),
      // and the small step they typed. The date of the visit is the existing reviewedAt.
      await db.execAsync(`
        ALTER TABLE worries ADD COLUMN reviewChoice TEXT CHECK (reviewChoice IN ('let_go', 'small_step'));
        ALTER TABLE worries ADD COLUMN smallStep TEXT;
        UPDATE worries SET reviewChoice = 'let_go' WHERE reviewedAt IS NOT NULL;
      `);
    }
    if (current < 3) {
      // Which car the worry is parked as. Existing worries get one in rotation, by id.
      await db.execAsync(`
        ALTER TABLE worries ADD COLUMN car TEXT CHECK (car IN ('hatchback', 'sedan', 'suv', 'pickup', 'beetle', 'van'));
        UPDATE worries SET car = CASE id % 6
          WHEN 0 THEN 'hatchback' WHEN 1 THEN 'sedan' WHEN 2 THEN 'suv'
          WHEN 3 THEN 'pickup' WHEN 4 THEN 'beetle' ELSE 'van' END;
      `);
    }
    await db.execAsync(`PRAGMA user_version = ${LATEST_VERSION}`);
  });
}
