export type Outcome = 'happened' | 'partly' | 'did_not_happen';

type WorryBase = {
  id: number;
  /** UTC ISO timestamps. */
  parkedAt: string;
  unlocksAt: string;
  followUpDueAt: string;
  reviewedAt: string | null;
  outcome: Outcome | null;
  outcomeAt: string | null;
};

/** A worry the user may not read yet. The database never returns its text. */
export type LockedWorry = WorryBase & { locked: true; text: null };

export type OpenWorry = WorryBase & { locked: false; text: string };

export type Worry = LockedWorry | OpenWorry;
