import { newId } from '../lib/id';
import type { StrategyDocument } from '../types';
import {
  StrategyConflictError,
  StrategyNotFoundError,
  type StrategyMeta,
  type StrategyRecord,
  type StrategyRepository,
} from './repository';

/**
 * The repository against localStorage. A THROWAWAY: it exists so the editor
 * and the conflict path can be built before there is an API, and is meant to
 * be deleted when there is one. Kept naive on purpose — one key holds the
 * list, one key per strategy holds its document, nothing is cached.
 *
 * What it does do properly is the versioning: every write bumps the version,
 * and a write quoting a stale one is refused. Two tabs on one strategy
 * therefore conflict for real, which is how that path gets exercised now.
 */

const INDEX_KEY = 'map-canvas.strategies';
const documentKey = (id: string) => `map-canvas.strategy.${id}`;

function readIndex(): StrategyMeta[] {
  const raw = window.localStorage.getItem(INDEX_KEY);
  return raw === null ? [] : (JSON.parse(raw) as StrategyMeta[]);
}

function writeIndex(index: StrategyMeta[]): void {
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

function readRecord(id: string): StrategyRecord {
  const meta = readIndex().find((entry) => entry.id === id);
  const raw = window.localStorage.getItem(documentKey(id));
  if (!meta || raw === null) throw new StrategyNotFoundError(id);
  return { ...meta, document: JSON.parse(raw) as StrategyDocument };
}

/** Writes the document first: an index entry must never point at nothing. */
function writeRecord({ document, ...meta }: StrategyRecord): void {
  window.localStorage.setItem(documentKey(meta.id), JSON.stringify(document));
  writeIndex([...readIndex().filter((entry) => entry.id !== meta.id), meta]);
}

function add(title: string, document: StrategyDocument): StrategyRecord {
  const now = new Date().toISOString();
  const record: StrategyRecord = {
    id: newId(),
    title,
    map: document.map,
    version: 1,
    createdAt: now,
    updatedAt: now,
    document,
  };
  writeRecord(record);
  return record;
}

export function createLocalRepository(): StrategyRepository {
  // Async only in shape, to match the HTTP repository that replaces this:
  // each body runs at once, and a throw becomes the rejection.
  return {
    async list() {
      return readIndex().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    async get(id) {
      return readRecord(id);
    },

    async create(title, document) {
      return add(title, document);
    },

    async update(id, version, changes) {
      const stored = readRecord(id);
      if (stored.version !== version) throw new StrategyConflictError(stored);
      const document = changes.document ?? stored.document;
      const next: StrategyRecord = {
        ...stored,
        title: changes.title ?? stored.title,
        map: document.map,
        document,
        version: stored.version + 1,
        updatedAt: new Date().toISOString(),
      };
      writeRecord(next);
      return { version: next.version, updatedAt: next.updatedAt };
    },

    async duplicate(id, title) {
      const original = readRecord(id);
      return add(title ?? `${original.title} copy`, original.document);
    },

    async remove(id) {
      writeIndex(readIndex().filter((entry) => entry.id !== id));
      window.localStorage.removeItem(documentKey(id));
    },
  };
}
