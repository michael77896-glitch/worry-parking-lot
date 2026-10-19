import type { SQLiteDatabase } from 'expo-sqlite';

/** Bump this and add a step below when the schema changes. */
const LATEST_VERSION = 5;

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
    if (current < 4) {
      // The first six cars were replaced by the starter catalog, and the car column no longer
      // has a fixed list of allowed values (new cars come from the catalog). SQLite can't drop a
      // CHECK in place, so rebuild the table, mapping each old car to its closest new one.
      await db.execAsync(`
        CREATE TABLE worries_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          text TEXT NOT NULL,
          parkedAt TEXT NOT NULL,
          unlocksAt TEXT NOT NULL,
          followUpDueAt TEXT NOT NULL,
          reviewedAt TEXT,
          outcome TEXT CHECK (outcome IN ('happened', 'partly', 'did_not_happen')),
          outcomeAt TEXT,
          reviewChoice TEXT CHECK (reviewChoice IN ('let_go', 'small_step')),
          smallStep TEXT,
          car TEXT NOT NULL DEFAULT 'coupe'
        );
        INSERT INTO worries_new
          (id, text, parkedAt, unlocksAt, followUpDueAt, reviewedAt, outcome, outcomeAt, reviewChoice, smallStep, car)
        SELECT id, text, parkedAt, unlocksAt, followUpDueAt, reviewedAt, outcome, outcomeAt, reviewChoice, smallStep,
          CASE car
            WHEN 'hatchback' THEN 'city-car'
            WHEN 'sedan' THEN 'coupe'
            WHEN 'suv' THEN '4x4'
            WHEN 'pickup' THEN 'kei-truck'
            WHEN 'beetle' THEN 'rear-engine'
            WHEN 'van' THEN 'wagon'
            ELSE 'coupe'
          END
        FROM worries;
        DROP TABLE worries;
        ALTER TABLE worries_new RENAME TO worries;
      `);
    }
    if (current < 5) {
      // The reward system. Everything is stored on the phone. The ledger only ever grows (a spend
      // is a negative row), boxes have a unique `source` so a reward can't be given twice, and the
      // seven starter cars are put in the garage (their ids are fixed here, as this step is history).
      await db.execAsync(`
        CREATE TABLE token_ledger (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kind TEXT NOT NULL,
          amount INTEGER NOT NULL,
          day TEXT NOT NULL,
          refId TEXT,
          createdAt TEXT NOT NULL
        );
        CREATE TABLE finished_windows (
          dayKey TEXT PRIMARY KEY NOT NULL,
          weekKey TEXT NOT NULL,
          finishedAt TEXT NOT NULL
        );
        CREATE TABLE boxes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL CHECK (type IN ('glovebox', 'toolbox', 'golden')),
          source TEXT NOT NULL UNIQUE,
          earnedAt TEXT NOT NULL,
          openedAt TEXT,
          resolvedAt TEXT,
          result TEXT
        );
        CREATE TABLE owned_cars (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          carId TEXT NOT NULL,
          paint TEXT NOT NULL DEFAULT 'stock',
          acquiredAt TEXT NOT NULL,
          source TEXT NOT NULL
        );
        CREATE TABLE car_paints (
          ownedCarId INTEGER NOT NULL,
          paintId TEXT NOT NULL,
          PRIMARY KEY (ownedCarId, paintId)
        );
        CREATE TABLE unlocked_paints (
          paintId TEXT PRIMARY KEY NOT NULL,
          source TEXT NOT NULL,
          unlockedAt TEXT NOT NULL
        );
        CREATE TABLE owned_parts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          partId TEXT NOT NULL,
          acquiredAt TEXT NOT NULL,
          source TEXT NOT NULL,
          installedOn INTEGER
        );
        CREATE TABLE reward_state (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
        ALTER TABLE worries ADD COLUMN ownedCarId INTEGER;
        INSERT INTO owned_cars (carId, acquiredAt, source) VALUES
          ('coupe', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'starter'),
          ('kei-truck', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'starter'),
          ('city-car', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'starter'),
          ('rear-engine', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'starter'),
          ('wagon', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'starter'),
          ('muscle', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'starter'),
          ('4x4', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'starter');
        UPDATE worries SET ownedCarId = (SELECT id FROM owned_cars WHERE owned_cars.carId = worries.car ORDER BY id LIMIT 1);
      `);
    }
    await db.execAsync(`PRAGMA user_version = ${LATEST_VERSION}`);
  });
}
