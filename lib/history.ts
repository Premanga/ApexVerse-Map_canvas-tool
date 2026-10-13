/**
 * Snapshot history: a stack of earlier values and a stack of undone ones.
 * Pure, and generic over the snapshot, so it knows nothing about strategy
 * objects — whatever is recorded comes back out unchanged.
 *
 * Snapshots are stored by reference, never copied. That is only sound
 * because the caller treats each snapshot as immutable and builds a new
 * value for every change.
 */

export interface History<T> {
  /** Oldest first; the last entry is the next undo. */
  past: T[];
  /** Most recently undone last; the last entry is the next redo. */
  future: T[];
}

/** Undo steps kept. Older ones are dropped so a long session stays bounded. */
export const HISTORY_LIMIT = 50;

export function emptyHistory<T>(): History<T> {
  return { past: [], future: [] };
}

/**
 * Records `previous` as the value a new change replaced. Anything undone is
 * no longer reachable from the new present, so the redo stack goes.
 */
export function record<T>(history: History<T>, previous: T): History<T> {
  return { past: [...history.past, previous].slice(-HISTORY_LIMIT), future: [] };
}

interface Step<T> {
  history: History<T>;
  present: T;
}

/** Null when there is nothing to undo. */
export function undo<T>(history: History<T>, present: T): Step<T> | null {
  if (history.past.length === 0) return null;
  return {
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, present],
    },
    present: history.past[history.past.length - 1],
  };
}

/** Null when there is nothing to redo. */
export function redo<T>(history: History<T>, present: T): Step<T> | null {
  if (history.future.length === 0) return null;
  return {
    history: {
      past: [...history.past, present],
      future: history.future.slice(0, -1),
    },
    present: history.future[history.future.length - 1],
  };
}
