import { create } from 'zustand';

import type { StrategyDocument } from '../types';

/**
 * Which saved strategy the canvas is showing, and how the two stand. Kept
 * apart from the canvas store: that one is the plan, this one is the plan's
 * relation to where it is kept — and none of this is ever saved itself.
 */

/**
 * - `saved`    the canvas is what is stored (or nothing has been done yet)
 * - `unsaved`  changes are waiting on the autosave
 * - `saving`   a write is on its way
 * - `conflict` the strategy changed elsewhere; saving has stopped
 * - `error`    the last write failed for some other reason; it is retried
 */
export type SaveState = 'saved' | 'unsaved' | 'saving' | 'conflict' | 'error';

/** What is stored now, as the refused write reported it. */
export interface StrategyConflict {
  version: number;
  title: string;
  document: StrategyDocument;
}

interface StrategySession {
  /** Null for a strategy that has never been saved. */
  id: string | null;
  /** The version last seen from the repository. Sent back with every write. */
  version: number | null;
  saveState: SaveState;
  conflict: StrategyConflict | null;
  /** Why the last save or open failed, in words fit to show. */
  error: string | null;
}

export const useStrategyStore = create<StrategySession>(() => ({
  id: null,
  version: null,
  saveState: 'saved',
  conflict: null,
  error: null,
}));
