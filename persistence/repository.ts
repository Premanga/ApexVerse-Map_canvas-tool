import type { StrategyDocument } from '../types';

/**
 * Where strategies are kept, as the canvas sees it. The contract a backend
 * will implement; nothing in here knows how, or where.
 *
 * Every write is versioned. A strategy carries a `version` that goes up by
 * one each time it is written, and `update` must be told the version the
 * caller last saw. If that is not the version stored, someone else has
 * written in between, and the write is REFUSED with `StrategyConflictError`
 * — never applied over the top. There is no last-write-wins anywhere in
 * this interface.
 */

/** Everything about a strategy but its contents. */
export interface StrategyMeta {
  id: string;
  title: string;
  /** The map it is drawn on, so a list can say so without the document. */
  map: string;
  version: number;
  /** ISO 8601. */
  createdAt: string;
  /** ISO 8601. */
  updatedAt: string;
}

export interface StrategyRecord extends StrategyMeta {
  document: StrategyDocument;
}

/** What a write may change. At least one of the two. */
export interface StrategyChanges {
  document?: StrategyDocument;
  title?: string;
}

export interface StrategyRepository {
  /**
   * Every strategy, newest first — metadata ONLY. A list of titles must not
   * cost a download of every plan behind them.
   */
  list(): Promise<StrategyMeta[]>;
  /** Throws `StrategyNotFoundError`. */
  get(id: string): Promise<StrategyRecord>;
  create(title: string, document: StrategyDocument): Promise<StrategyRecord>;
  /**
   * Writes `changes` if `version` is still the stored one, and returns the
   * new version. Otherwise throws `StrategyConflictError` and writes
   * nothing. Throws `StrategyNotFoundError` for a strategy that is gone.
   */
  update(
    id: string,
    version: number,
    changes: StrategyChanges,
  ): Promise<Pick<StrategyMeta, 'version' | 'updatedAt'>>;
  /** A new strategy with the same contents. Titled "… copy" without `title`. */
  duplicate(id: string, title?: string): Promise<StrategyRecord>;
  remove(id: string): Promise<void>;
}

/**
 * A write was refused because the strategy has moved on since the caller
 * last saw it — the 409 of the HTTP contract. Carries what is stored now, so
 * the caller can show it without asking again.
 */
export class StrategyConflictError extends Error {
  readonly currentVersion: number;
  readonly currentDocument: StrategyDocument;
  readonly currentTitle: string;

  constructor(current: StrategyRecord) {
    super(`Strategy ${current.id} was changed elsewhere (now at version ${current.version}).`);
    this.name = 'StrategyConflictError';
    this.currentVersion = current.version;
    this.currentDocument = current.document;
    this.currentTitle = current.title;
  }
}

export class StrategyNotFoundError extends Error {
  constructor(id: string) {
    super(`Strategy ${id} does not exist.`);
    this.name = 'StrategyNotFoundError';
  }
}
