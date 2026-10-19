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

/**
 * A reviewed worry whose "did this happen?" check-in is due. Includes the text, which is
 * safe because the user has already read it during a review.
 */
export type FollowUp = {
  id: number;
  text: string;
  parkedAt: string;
};

/** A reviewed worry for the record screen. Safe to include text: the user already read it. */
export type HistoryItem = {
  id: number;
  text: string;
  parkedAt: string;
  followUpDueAt: string;
  outcome: Outcome | null;
};

/** Plain counts across every worry. No percentages or scores. */
export type Stats = {
  parked: number;
  lookedBack: number;
  happened: number;
  partly: number;
  didNotHappen: number;
};

/** A reviewed worry still waiting for its check-in, described without its text. */
export type PendingFollowUp = {
  id: number;
  followUpDueAt: string;
};

/** A worry that has not been reviewed yet, described without its text. */
export type ParkedWorry = {
  id: number;
  parkedAt: string;
  unlocksAt: string;
};
