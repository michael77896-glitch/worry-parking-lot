import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  FollowUp,
  HistoryItem,
  Outcome,
  ParkedWorry,
  PendingFollowUp,
  Stats,
  Worry,
} from './types';
import { isWindowOpen, nextWindowOpen, type WindowSettings } from './window';

export const MAX_WORRY_LENGTH = 2000;
export const FOLLOW_UP_DAYS = 7;

/**
 * THE LOCK RULE. A worry's text is readable only when:
 *   - the user already reviewed it (so it can appear in their history), or
 *   - the worry window is open right now AND the worry's unlock time has passed.
 *
 * It is enforced here in SQL, so a locked worry's text never leaves the database.
 * Parked during an open window? It still waits for the NEXT opening (see `unlocksAt`).
 * Missed a window? The worry relocks when the window closes and carries over to the next.
 * Changing the window or time zone is safe: only "window open now" uses current settings.
 */
const READABLE = `(reviewedAt IS NOT NULL OR ($open = 1 AND unlocksAt <= $now))`;

type Row = {
  id: number;
  parkedAt: string;
  unlocksAt: string;
  followUpDueAt: string;
  reviewedAt: string | null;
  outcome: Outcome | null;
  outcomeAt: string | null;
  text: string | null;
};

export async function parkWorry(
  db: SQLiteDatabase,
  text: string,
  settings: WindowSettings,
  now: Date = new Date(),
): Promise<number> {
  const trimmed = text.trim();
  if (trimmed.length === 0) throw new RangeError('A worry cannot be empty');
  if (trimmed.length > MAX_WORRY_LENGTH) {
    throw new RangeError(`A worry can be at most ${MAX_WORRY_LENGTH} characters`);
  }
  const followUpDueAt = new Date(now.getTime() + FOLLOW_UP_DAYS * 24 * 60 * 60 * 1000);
  const result = await db.runAsync(
    `INSERT INTO worries (text, parkedAt, unlocksAt, followUpDueAt)
     VALUES ($text, $parkedAt, $unlocksAt, $followUpDueAt)`,
    {
      $text: trimmed,
      $parkedAt: now.toISOString(),
      $unlocksAt: nextWindowOpen(now, settings).toISOString(),
      $followUpDueAt: followUpDueAt.toISOString(),
    },
  );
  return result.lastInsertRowId;
}

/** All worries, newest first. Text is null for any worry that is still locked. */
export async function listWorries(
  db: SQLiteDatabase,
  settings: WindowSettings,
  now: Date = new Date(),
): Promise<Worry[]> {
  const rows = await db.getAllAsync<Row>(
    `SELECT id, parkedAt, unlocksAt, followUpDueAt, reviewedAt, outcome, outcomeAt,
            CASE WHEN ${READABLE} THEN text ELSE NULL END AS text
     FROM worries
     ORDER BY parkedAt DESC`,
    { $open: isWindowOpen(now, settings) ? 1 : 0, $now: now.toISOString() },
  );
  return rows.map((r) =>
    r.text === null ? { ...r, locked: true, text: null } : { ...r, locked: false, text: r.text },
  );
}

/** Worries still waiting for review, newest first. Never selects the text column. */
export async function listParked(db: SQLiteDatabase): Promise<ParkedWorry[]> {
  return db.getAllAsync<ParkedWorry>(
    `SELECT id, parkedAt, unlocksAt FROM worries WHERE reviewedAt IS NULL ORDER BY parkedAt DESC`,
  );
}

/**
 * Check-ins that are due: reviewed, unanswered, and at least FOLLOW_UP_DAYS after parking.
 * A worry that was never reviewed is not asked about, because the user hasn't read it yet.
 */
export async function listDueFollowUps(db: SQLiteDatabase, now: Date = new Date()): Promise<FollowUp[]> {
  return db.getAllAsync<FollowUp>(
    `SELECT id, text, parkedAt FROM worries
     WHERE reviewedAt IS NOT NULL AND outcome IS NULL AND followUpDueAt <= $now
     ORDER BY followUpDueAt ASC`,
    { $now: now.toISOString() },
  );
}

export async function countDueFollowUps(db: SQLiteDatabase, now: Date = new Date()): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM worries
     WHERE reviewedAt IS NOT NULL AND outcome IS NULL AND followUpDueAt <= $now`,
    { $now: now.toISOString() },
  );
  return row?.n ?? 0;
}

/** Reviewed worries whose check-in is still in the future, soonest first. No text. */
export async function listUpcomingFollowUps(
  db: SQLiteDatabase,
  now: Date = new Date(),
): Promise<PendingFollowUp[]> {
  return db.getAllAsync<PendingFollowUp>(
    `SELECT id, followUpDueAt FROM worries
     WHERE reviewedAt IS NOT NULL AND outcome IS NULL AND followUpDueAt > $now
     ORDER BY followUpDueAt ASC`,
    { $now: now.toISOString() },
  );
}

export async function getStats(db: SQLiteDatabase): Promise<Stats> {
  const row = await db.getFirstAsync<Stats>(
    `SELECT COUNT(*) AS parked,
            COALESCE(SUM(outcome IS NOT NULL), 0) AS lookedBack,
            COALESCE(SUM(outcome = 'happened'), 0) AS happened,
            COALESCE(SUM(outcome = 'partly'), 0) AS partly,
            COALESCE(SUM(outcome = 'did_not_happen'), 0) AS didNotHappen
     FROM worries`,
  );
  return row ?? { parked: 0, lookedBack: 0, happened: 0, partly: 0, didNotHappen: 0 };
}

/** Worries the user has already reviewed, newest first. Unreviewed worries are never included. */
export async function listReviewed(db: SQLiteDatabase): Promise<HistoryItem[]> {
  return db.getAllAsync<HistoryItem>(
    `SELECT id, text, parkedAt, followUpDueAt, outcome FROM worries
     WHERE reviewedAt IS NOT NULL
     ORDER BY parkedAt DESC`,
  );
}

/** Marks a worry reviewed. Returns false if it is still locked or already reviewed. */
export async function markReviewed(
  db: SQLiteDatabase,
  id: number,
  settings: WindowSettings,
  now: Date = new Date(),
): Promise<boolean> {
  const result = await db.runAsync(
    `UPDATE worries SET reviewedAt = $now
     WHERE id = $id AND reviewedAt IS NULL AND $open = 1 AND unlocksAt <= $now`,
    { $id: id, $now: now.toISOString(), $open: isWindowOpen(now, settings) ? 1 : 0 },
  );
  return result.changes > 0;
}

/** Records "did this happen?". Only for reviewed worries whose follow-up is due and unanswered. */
export async function recordOutcome(
  db: SQLiteDatabase,
  id: number,
  outcome: Outcome,
  now: Date = new Date(),
): Promise<boolean> {
  const result = await db.runAsync(
    `UPDATE worries SET outcome = $outcome, outcomeAt = $now
     WHERE id = $id AND reviewedAt IS NOT NULL AND outcome IS NULL AND followUpDueAt <= $now`,
    { $id: id, $outcome: outcome, $now: now.toISOString() },
  );
  return result.changes > 0;
}

export async function deleteWorry(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM worries WHERE id = $id', { $id: id });
}

/** Wipes everything the app has stored: worries and settings. */
export async function deleteAllData(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM worries; DELETE FROM settings;');
  });
}
