/**
 * Tokens, boxes, and everything the user owns: cars, paints, and parts. All of it lives in the
 * phone's own database. Boxes are only ever earned here, never bought, and nothing here resets or
 * takes anything away.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { STARTER_CAR_IDS } from '../constants/car-data';
import { FINISHES, finishUnlocked, getPaint, STOCK_PAINT } from '../constants/paints';
import { getPart, partPrice, partsInSlot } from '../constants/parts';
import {
  DUPLICATE_PAINT_TOKENS,
  GOLDEN_MILESTONES,
  TOKENS,
  TOOLBOX_WINDOWS_PER_WEEK,
  type BoxType,
} from '../constants/rewards';
import { nextSinceEpic, rollBox, type Reward } from './loot';

// --- Dates ---------------------------------------------------------------------------------

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** The local calendar day, e.g. "2026-10-19". */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The Monday of the local calendar week, e.g. "2026-10-19". A week runs Monday to Sunday. */
export function weekKey(date: Date): string {
  const sinceMonday = (date.getDay() + 6) % 7;
  return dayKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() - sinceMonday));
}

// --- Small counters -------------------------------------------------------------------------

async function getState(db: SQLiteDatabase, key: string): Promise<number> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM reward_state WHERE key = $key', {
    $key: key,
  });
  return row ? Number(row.value) : 0;
}

async function setState(db: SQLiteDatabase, key: string, value: number): Promise<void> {
  await db.runAsync(
    'INSERT INTO reward_state (key, value) VALUES ($key, $value) ON CONFLICT(key) DO UPDATE SET value = $value',
    { $key: key, $value: String(value) },
  );
}

// --- Tokens ---------------------------------------------------------------------------------

export async function getTokenBalance(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ total: number }>('SELECT COALESCE(SUM(amount), 0) AS total FROM token_ledger');
  return row?.total ?? 0;
}

/** Adds (or, with a negative amount, spends) tokens. The ledger is append-only. */
export async function addTokens(
  db: SQLiteDatabase,
  amount: number,
  kind: string,
  refId: string | null,
  now: Date = new Date(),
): Promise<void> {
  await db.runAsync(
    'INSERT INTO token_ledger (kind, amount, day, refId, createdAt) VALUES ($kind, $amount, $day, $refId, $createdAt)',
    { $kind: kind, $amount: amount, $day: dayKey(now), $refId: refId, $createdAt: now.toISOString() },
  );
}

/** +5 for parking a worry, but only for the first 3 each day. Returns the tokens given (0 or 5). */
export async function awardParkTokens(db: SQLiteDatabase, worryId: number, now: Date = new Date()): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM token_ledger WHERE kind = 'park' AND day = $day`,
    { $day: dayKey(now) },
  );
  if ((row?.n ?? 0) >= TOKENS.parkPerDay) return 0;
  await addTokens(db, TOKENS.park, 'park', String(worryId), now);
  return TOKENS.park;
}

/** +10 for each "Did this actually happen?" answer, whichever answer it is. */
export async function awardOutcomeTokens(db: SQLiteDatabase, worryId: number, now: Date = new Date()): Promise<number> {
  await addTokens(db, TOKENS.outcome, 'outcome', String(worryId), now);
  return TOKENS.outcome;
}

/** Spends tokens if there are enough. Returns false, changing nothing, if there are not. */
async function spendTokens(db: SQLiteDatabase, amount: number, refId: string, now: Date): Promise<boolean> {
  if ((await getTokenBalance(db)) < amount) return false;
  await addTokens(db, -amount, 'spend', refId, now);
  return true;
}

// --- Boxes ----------------------------------------------------------------------------------

export type BoxResult = {
  reward: Reward;
  byPity: boolean;
  /** For a car already owned: waiting for "keep" or "trade". Set once decided. */
  duplicate?: boolean;
  choice?: 'keep' | 'trade';
  ownedCarId?: number;
  /** Tokens given when a color-shift paint was already owned. */
  refund?: number;
};

export type Box = {
  id: number;
  type: BoxType;
  source: string;
  earnedAt: string;
  openedAt: string | null;
  resolvedAt: string | null;
  result: BoxResult | null;
};

type BoxRow = Omit<Box, 'result'> & { result: string | null };

function toBox(row: BoxRow): Box {
  return { ...row, result: row.result ? (JSON.parse(row.result) as BoxResult) : null };
}

/** Adds a box. `source` is unique (e.g. "window:2026-10-19"), so a reward can never be given twice. */
export async function addBox(
  db: SQLiteDatabase,
  type: BoxType,
  source: string,
  now: Date = new Date(),
): Promise<number | null> {
  const result = await db.runAsync(
    'INSERT OR IGNORE INTO boxes (type, source, earnedAt) VALUES ($type, $source, $earnedAt)',
    { $type: type, $source: source, $earnedAt: now.toISOString() },
  );
  return result.changes > 0 ? result.lastInsertRowId : null;
}

/** Boxes still to open, plus opened ones waiting on a keep-or-trade choice. Oldest first. */
export async function listBoxes(db: SQLiteDatabase): Promise<Box[]> {
  const rows = await db.getAllAsync<BoxRow>(
    'SELECT id, type, source, earnedAt, openedAt, resolvedAt, result FROM boxes WHERE resolvedAt IS NULL ORDER BY id',
  );
  return rows.map(toBox);
}

export async function getBox(db: SQLiteDatabase, id: number): Promise<Box | null> {
  const row = await db.getFirstAsync<BoxRow>(
    'SELECT id, type, source, earnedAt, openedAt, resolvedAt, result FROM boxes WHERE id = $id',
    { $id: id },
  );
  return row ? toBox(row) : null;
}

export async function countBoxesOpened(db: SQLiteDatabase): Promise<number> {
  return getState(db, 'boxesOpened');
}

async function insertOwnedCar(db: SQLiteDatabase, carId: string, source: string, now: Date): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO owned_cars (carId, acquiredAt, source) VALUES ($carId, $at, $source)',
    { $carId: carId, $at: now.toISOString(), $source: source },
  );
  return result.lastInsertRowId;
}

/**
 * Opens a box and saves what it held. A car the user already owns waits for a choice (see
 * `resolveDuplicate`); everything else is added straight away. `random` can be passed for tests.
 */
export async function openBox(
  db: SQLiteDatabase,
  boxId: number,
  now: Date = new Date(),
  random: () => number = Math.random,
): Promise<{ box: Box; newBoxId: number | null }> {
  const box = await getBox(db, boxId);
  if (!box) throw new Error('There is no such box');
  if (box.openedAt) throw new Error('This box is already open');

  const sinceEpic = await getState(db, 'sinceEpic');
  const { reward, byPity } = rollBox(box.type, sinceEpic, random);
  const result: BoxResult = { reward, byPity };
  let resolved = true;
  let newBoxId: number | null = null;

  await db.withTransactionAsync(async () => {
    await setState(db, 'sinceEpic', nextSinceEpic(sinceEpic, reward));
    await setState(db, 'boxesOpened', (await getState(db, 'boxesOpened')) + 1);

    if (reward.kind === 'car') {
      const owned = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM owned_cars WHERE carId = $carId', {
        $carId: reward.carId,
      });
      if ((owned?.n ?? 0) > 0) {
        result.duplicate = true;
        resolved = false;
      } else {
        result.ownedCarId = await insertOwnedCar(db, reward.carId, `box:${boxId}`, now);
      }
    } else if (reward.kind === 'part') {
      await db.runAsync('INSERT INTO owned_parts (partId, acquiredAt, source) VALUES ($partId, $at, $source)', {
        $partId: reward.partId,
        $at: now.toISOString(),
        $source: `box:${boxId}`,
      });
    } else if (reward.kind === 'paint') {
      const have = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM unlocked_paints WHERE paintId = $id', {
        $id: reward.paintId,
      });
      if ((have?.n ?? 0) > 0) {
        result.refund = DUPLICATE_PAINT_TOKENS;
        await addTokens(db, DUPLICATE_PAINT_TOKENS, 'duplicate-paint', reward.paintId, now);
      } else {
        await db.runAsync('INSERT INTO unlocked_paints (paintId, source, unlockedAt) VALUES ($id, $source, $at)', {
          $id: reward.paintId,
          $source: `box:${boxId}`,
          $at: now.toISOString(),
        });
      }
    } else {
      newBoxId = await addBox(db, 'golden', `drop:${boxId}`, now);
    }

    await db.runAsync('UPDATE boxes SET openedAt = $at, resolvedAt = $resolved, result = $result WHERE id = $id', {
      $id: boxId,
      $at: now.toISOString(),
      $resolved: resolved ? now.toISOString() : null,
      $result: JSON.stringify(result),
    });
  });

  return { box: (await getBox(db, boxId))!, newBoxId };
}

/**
 * Settles a car the user already owned. "keep" adds a separate copy (with its own paint and
 * parts); "trade" turns it into a Glovebox.
 */
export async function resolveDuplicate(
  db: SQLiteDatabase,
  boxId: number,
  choice: 'keep' | 'trade',
  now: Date = new Date(),
): Promise<{ ownedCarId: number | null; tradedBoxId: number | null }> {
  const box = await getBox(db, boxId);
  if (!box || !box.openedAt || box.resolvedAt || !box.result?.duplicate || box.result.reward.kind !== 'car') {
    throw new Error('This box has no duplicate waiting');
  }
  const carId = box.result.reward.carId;
  let ownedCarId: number | null = null;
  let tradedBoxId: number | null = null;

  await db.withTransactionAsync(async () => {
    if (choice === 'keep') ownedCarId = await insertOwnedCar(db, carId, `box:${boxId}:copy`, now);
    else tradedBoxId = await addBox(db, 'glovebox', `trade:${boxId}`, now);
    const result: BoxResult = { ...box.result!, choice, ...(ownedCarId ? { ownedCarId } : {}) };
    await db.runAsync('UPDATE boxes SET resolvedAt = $at, result = $result WHERE id = $id', {
      $id: boxId,
      $at: now.toISOString(),
      $result: JSON.stringify(result),
    });
  });
  return { ownedCarId, tradedBoxId };
}

// --- Earning boxes --------------------------------------------------------------------------

export type WindowFinish = {
  /** False if this window had already been counted. */
  firstTime: boolean;
  tokens: number;
  boxes: { id: number; type: BoxType }[];
};

/**
 * Counts a finished worry window: +20 tokens and a Glovebox, and a Toolbox on the 5th finished
 * window of a calendar week. Each window counts once, however many times this is called.
 * `windowOpensAt` is when that window opened; `isTest` is true for a hand-opened test window.
 */
export async function finishWindow(
  db: SQLiteDatabase,
  windowOpensAt: Date,
  now: Date = new Date(),
  isTest = false,
): Promise<WindowFinish> {
  const key = isTest ? `test-${windowOpensAt.toISOString()}` : dayKey(windowOpensAt);
  const week = isTest ? 'test' : weekKey(windowOpensAt);
  const finish: WindowFinish = { firstTime: false, tokens: 0, boxes: [] };

  await db.withTransactionAsync(async () => {
    const inserted = await db.runAsync(
      'INSERT OR IGNORE INTO finished_windows (dayKey, weekKey, finishedAt) VALUES ($key, $week, $at)',
      { $key: key, $week: week, $at: now.toISOString() },
    );
    if (inserted.changes === 0) return;
    finish.firstTime = true;

    await addTokens(db, TOKENS.window, 'window', key, now);
    finish.tokens = TOKENS.window;

    const glove = await addBox(db, 'glovebox', `window:${key}`, now);
    if (glove) finish.boxes.push({ id: glove, type: 'glovebox' });

    if (!isTest) {
      const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM finished_windows WHERE weekKey = $week', {
        $week: week,
      });
      if ((row?.n ?? 0) >= TOOLBOX_WINDOWS_PER_WEEK) {
        const tool = await addBox(db, 'toolbox', `week:${week}`, now);
        if (tool) finish.boxes.push({ id: tool, type: 'toolbox' });
      }
    }
  });
  return finish;
}

export async function getFinishedWindowCount(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM finished_windows');
  return row?.n ?? 0;
}

/**
 * Notes that a worry was let go. The 10th, 25th, and 50th each earn a Golden Crate. Returns the
 * crate's id when one was earned. The count only ever goes up.
 */
export async function noteLetGo(db: SQLiteDatabase, now: Date = new Date()): Promise<number | null> {
  const count = (await getState(db, 'letGoCount')) + 1;
  await setState(db, 'letGoCount', count);
  return GOLDEN_MILESTONES.includes(count) ? addBox(db, 'golden', `milestone:${count}`, now) : null;
}

export async function getLetGoCount(db: SQLiteDatabase): Promise<number> {
  return getState(db, 'letGoCount');
}

// --- What the user owns ---------------------------------------------------------------------

export type OwnedCar = { id: number; carId: string; paint: string; acquiredAt: string };
export type OwnedPart = { id: number; partId: string; installedOn: number | null };

export async function listOwnedCars(db: SQLiteDatabase): Promise<OwnedCar[]> {
  return db.getAllAsync<OwnedCar>('SELECT id, carId, paint, acquiredAt FROM owned_cars ORDER BY id');
}

export async function listOwnedParts(db: SQLiteDatabase): Promise<OwnedPart[]> {
  return db.getAllAsync<OwnedPart>('SELECT id, partId, installedOn FROM owned_parts ORDER BY id');
}

/** Color-shift paints won from Golden Crates. */
export async function listUnlockedPaints(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ paintId: string }>('SELECT paintId FROM unlocked_paints ORDER BY unlockedAt');
  return rows.map((r) => r.paintId);
}

/** Paints already bought for one car copy. Stock paint is always available and isn't listed. */
export async function listCarPaints(db: SQLiteDatabase, ownedCarId: number): Promise<string[]> {
  const rows = await db.getAllAsync<{ paintId: string }>('SELECT paintId FROM car_paints WHERE ownedCarId = $id', {
    $id: ownedCarId,
  });
  return rows.map((r) => r.paintId);
}

/** Puts the starter cars in an empty garage. Safe to call any time. */
export async function ensureStarterCars(db: SQLiteDatabase, now: Date = new Date()): Promise<void> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM owned_cars');
  if ((row?.n ?? 0) > 0) return;
  for (const carId of STARTER_CAR_IDS) await insertOwnedCar(db, carId, 'starter', now);
}

// --- Mod shop -------------------------------------------------------------------------------

export type ShopResult =
  | { ok: true; ownedPartId?: number }
  | { ok: false; reason: 'unknown' | 'locked' | 'not-owned' | 'not-for-sale' | 'not-enough-tokens' };

/**
 * Buys a paint for one car and puts it on. A paint already bought for that car is just put on,
 * free. Finishes need enough finished worry windows. Color-shift paints can't be bought: once won
 * from a Golden Crate they go on any car for free.
 */
export async function buyPaint(
  db: SQLiteDatabase,
  ownedCarId: number,
  paintId: string,
  now: Date = new Date(),
): Promise<ShopResult> {
  const paint = getPaint(paintId);
  const car = await db.getFirstAsync<{ id: number }>('SELECT id FROM owned_cars WHERE id = $id', { $id: ownedCarId });
  if (!paint || !car) return { ok: false, reason: 'unknown' };

  const already = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM car_paints WHERE ownedCarId = $car AND paintId = $paint',
    { $car: ownedCarId, $paint: paintId },
  );
  let price = 0;
  if ((already?.n ?? 0) === 0) {
    if (paint.finish === 'colorshift') {
      const won = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM unlocked_paints WHERE paintId = $id', {
        $id: paintId,
      });
      if ((won?.n ?? 0) === 0) return { ok: false, reason: 'not-owned' };
    } else {
      if (!finishUnlocked(paint.finish, await getFinishedWindowCount(db))) return { ok: false, reason: 'locked' };
      price = FINISHES[paint.finish].price ?? 0;
    }
  }

  let enough = true;
  await db.withTransactionAsync(async () => {
    if (price > 0 && !(await spendTokens(db, price, `paint:${ownedCarId}:${paintId}`, now))) {
      enough = false;
      return;
    }
    await db.runAsync('INSERT OR IGNORE INTO car_paints (ownedCarId, paintId) VALUES ($car, $paint)', {
      $car: ownedCarId,
      $paint: paintId,
    });
    await db.runAsync('UPDATE owned_cars SET paint = $paint WHERE id = $car', { $car: ownedCarId, $paint: paintId });
  });
  return enough ? { ok: true } : { ok: false, reason: 'not-enough-tokens' };
}

/** Puts the car's original paint back. Always free. */
export async function setStockPaint(db: SQLiteDatabase, ownedCarId: number): Promise<void> {
  await db.runAsync('UPDATE owned_cars SET paint = $paint WHERE id = $car', { $car: ownedCarId, $paint: STOCK_PAINT });
}

/** Buys a part from the shop (Common and Rare only). It goes in the user's parts, not onto a car. */
export async function buyPart(db: SQLiteDatabase, partId: string, now: Date = new Date()): Promise<ShopResult> {
  const part = getPart(partId);
  if (!part) return { ok: false, reason: 'unknown' };
  const price = partPrice(part);
  if (price === null) return { ok: false, reason: 'not-for-sale' };

  let result: ShopResult = { ok: false, reason: 'not-enough-tokens' };
  await db.withTransactionAsync(async () => {
    if (!(await spendTokens(db, price, `part:${partId}`, now))) return;
    const inserted = await db.runAsync(
      'INSERT INTO owned_parts (partId, acquiredAt, source) VALUES ($partId, $at, $source)',
      { $partId: partId, $at: now.toISOString(), $source: 'shop' },
    );
    result = { ok: true, ownedPartId: inserted.lastInsertRowId };
  });
  return result;
}

/** Puts an owned part on a car, replacing whatever was in that slot. */
export async function installPart(db: SQLiteDatabase, ownedPartId: number, ownedCarId: number): Promise<ShopResult> {
  const row = await db.getFirstAsync<{ partId: string }>('SELECT partId FROM owned_parts WHERE id = $id', {
    $id: ownedPartId,
  });
  const part = row ? getPart(row.partId) : undefined;
  const car = await db.getFirstAsync<{ id: number }>('SELECT id FROM owned_cars WHERE id = $id', { $id: ownedCarId });
  if (!part || !car) return { ok: false, reason: 'unknown' };

  const sameSlot = partsInSlot(part.slot)
    .map((p) => `'${p.id}'`)
    .join(', ');
  await db.withTransactionAsync(async () => {
    await db.runAsync(`UPDATE owned_parts SET installedOn = NULL WHERE installedOn = $car AND partId IN (${sameSlot})`, {
      $car: ownedCarId,
    });
    await db.runAsync('UPDATE owned_parts SET installedOn = $car WHERE id = $id', { $car: ownedCarId, $id: ownedPartId });
  });
  return { ok: true };
}

export async function uninstallPart(db: SQLiteDatabase, ownedPartId: number): Promise<void> {
  await db.runAsync('UPDATE owned_parts SET installedOn = NULL WHERE id = $id', { $id: ownedPartId });
}

/** Wipes every reward table. Part of "Delete all data". */
export async function clearRewards(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    DELETE FROM token_ledger; DELETE FROM finished_windows; DELETE FROM boxes; DELETE FROM owned_cars;
    DELETE FROM car_paints; DELETE FROM unlocked_paints; DELETE FROM owned_parts; DELETE FROM reward_state;
  `);
}
