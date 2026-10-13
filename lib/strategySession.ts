import { StrategyConflictError, getStrategyRepository } from '../persistence';
import { DEFAULT_STRATEGY_NAME, serializeDocument } from '../persistence/document';
import { useCanvasStore } from '../store/canvasStore';
import { useStrategyStore } from '../store/strategyStore';
import type { StrategyDocument, StrategyLayer, StrategyObject } from '../types';

/**
 * Saving, opening and the rest, as the editor does them: the one place the
 * canvas store, the session store and the repository meet. Nothing here
 * knows whether the repository is localStorage or an API.
 */

/** How long the canvas must sit still before it is saved. */
const AUTOSAVE_DELAY_MS = 1200;

/** Remembers which strategy was open, to come back to it after a reload. */
const LAST_OPEN_KEY = 'map-canvas.strategy.last-open';

/**
 * What of the canvas is saved, by reference. The store never mutates: every
 * change makes a new `objects`, so comparing references says whether there
 * is anything to save without serializing to find out.
 *
 * The view is NOT here. It is written into the document whenever something
 * else is saved, but looking around a plan is not editing it — a pan that
 * bumped the version would raise a conflict for someone who had only looked.
 */
interface Saved {
  objects: StrategyObject[];
  layers: StrategyLayer[];
  mapKey: string;
  title: string;
}

function snapshot(): Saved {
  const { objects, layers, mapKey, strategyName } = useCanvasStore.getState();
  return { objects, layers, mapKey, title: strategyName };
}

const documentDiffers = (a: Saved, b: Saved) =>
  a.objects !== b.objects || a.layers !== b.layers || a.mapKey !== b.mapKey;

/** The canvas as it last agreed with the repository. */
let saved = snapshot();
let timer: number | null = null;
let inFlight: Promise<void> | null = null;

const session = useStrategyStore;

function isDirty(): boolean {
  const now = snapshot();
  return documentDiffers(now, saved) || now.title !== saved.title;
}

const titleOf = (name: string) => name.trim() || DEFAULT_STRATEGY_NAME;

/** An error as words fit to show. */
export const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong.';

function cancelTimer(): void {
  if (timer !== null) window.clearTimeout(timer);
  timer = null;
}

function rememberOpen(id: string | null): void {
  try {
    if (id === null) window.localStorage.removeItem(LAST_OPEN_KEY);
    else window.localStorage.setItem(LAST_OPEN_KEY, id);
  } catch {
    // Only a convenience.
  }
}

/** Marks the canvas as being exactly what the repository holds. */
function settle(id: string | null, version: number | null): void {
  cancelTimer();
  saved = snapshot();
  session.setState({ id, version, saveState: 'saved', conflict: null, error: null });
  rememberOpen(id);
}

async function write(): Promise<void> {
  const { id, version, saveState } = session.getState();
  // After a conflict nothing is written until the user has chosen: the
  // stored version is someone else's work, and must not be written over.
  if (saveState === 'conflict') return;
  const now = snapshot();
  const documentChanged = documentDiffers(now, saved);
  const titleChanged = now.title !== saved.title;
  if (id !== null && !documentChanged && !titleChanged) {
    session.setState({ saveState: 'saved', error: null });
    return;
  }

  session.setState({ saveState: 'saving', error: null });
  const repository = getStrategyRepository();
  const document = serializeDocument(useCanvasStore.getState());
  try {
    if (id === null || version === null) {
      const record = await repository.create(titleOf(now.title), document);
      session.setState({ id: record.id, version: record.version });
      rememberOpen(record.id);
    } else {
      // Only what changed, and always with the version last seen.
      const result = await repository.update(id, version, {
        ...(documentChanged && { document }),
        ...(titleChanged && { title: titleOf(now.title) }),
      });
      session.setState({ version: result.version });
    }
    saved = now;
    // The canvas may have moved on while the write was out.
    session.setState({ saveState: isDirty() ? 'unsaved' : 'saved' });
    if (isDirty()) schedule();
  } catch (error) {
    if (error instanceof StrategyConflictError) {
      cancelTimer();
      session.setState({
        saveState: 'conflict',
        conflict: {
          version: error.currentVersion,
          title: error.currentTitle,
          document: error.currentDocument,
        },
      });
    } else {
      session.setState({ saveState: 'error', error: messageOf(error) });
    }
  }
}

/** Saves now. One write at a time: a second call waits for the first. */
export function saveNow(): Promise<void> {
  cancelTimer();
  if (inFlight) return inFlight.then(() => (isDirty() ? saveNow() : undefined));
  inFlight = write().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

function schedule(): void {
  cancelTimer();
  timer = window.setTimeout(() => {
    timer = null;
    void saveNow();
  }, AUTOSAVE_DELAY_MS);
}

/**
 * Called on every change to the canvas store. Starts the wait for an
 * autosave when there is something to save — and does nothing at all once a
 * conflict has stopped saving.
 */
export function noteCanvasChange(): void {
  const { saveState } = session.getState();
  if (saveState === 'conflict' || !isDirty()) return;
  if (saveState !== 'saving') session.setState({ saveState: 'unsaved' });
  schedule();
}

/** Saves what is unsaved before the canvas is replaced by something else. */
async function flush(): Promise<void> {
  if (session.getState().saveState !== 'conflict' && isDirty()) await saveNow();
}

function show(id: string, version: number, title: string, document: StrategyDocument): void {
  // Throws for a document this build cannot read, before anything changes.
  useCanvasStore.getState().loadDocument(document, title);
  settle(id, version);
}

/**
 * Replaces the canvas with a saved strategy. Its undo history starts empty.
 * Rejects, leaving the canvas as it was, if the strategy is gone or cannot
 * be read; the caller says so.
 */
export async function openStrategy(id: string): Promise<void> {
  await flush();
  const record = await getStrategyRepository().get(id);
  show(record.id, record.version, record.title, record.document);
}

/** An empty canvas that is not saved anywhere until something is drawn. */
export async function newStrategy(): Promise<void> {
  await flush();
  useCanvasStore.getState().resetDocument();
  settle(null, null);
}

/** A copy in the repository. The canvas stays on what it was showing. */
export async function duplicateStrategy(id: string): Promise<void> {
  // The copy is taken from what is stored, so store the open one first.
  if (id === session.getState().id) await flush();
  await getStrategyRepository().duplicate(id);
}

/** Deleting the strategy on the canvas leaves an empty, unsaved one. */
export async function deleteStrategy(id: string): Promise<void> {
  await getStrategyRepository().remove(id);
  if (id !== session.getState().id) return;
  useCanvasStore.getState().resetDocument();
  settle(null, null);
}

/**
 * After a conflict: take what is stored and drop what is here. The refused
 * write already brought the stored version back with it.
 */
export function reloadConflict(): void {
  const { id, conflict } = session.getState();
  if (id === null || !conflict) return;
  show(id, conflict.version, conflict.title, conflict.document);
}

/**
 * After a conflict: keep what is here, as a strategy of its own, and leave
 * the stored one as the other person made it. Nothing is merged.
 */
export async function keepConflictAsCopy(): Promise<void> {
  const { strategyName } = useCanvasStore.getState();
  try {
    const record = await getStrategyRepository().create(
      `${titleOf(strategyName)} (my copy)`,
      serializeDocument(useCanvasStore.getState()),
    );
    useCanvasStore.getState().setStrategyName(record.title);
    settle(record.id, record.version);
  } catch (error) {
    session.setState({ error: messageOf(error) });
  }
}

/** Reopens the strategy that was open when the page was last closed. */
export async function restoreLastOpen(): Promise<void> {
  let id: string | null = null;
  try {
    id = window.localStorage.getItem(LAST_OPEN_KEY);
  } catch {
    return;
  }
  if (id === null || session.getState().id !== null) return;
  try {
    await openStrategy(id);
  } catch {
    // Deleted since, or unreadable: start empty rather than on an error.
    rememberOpen(null);
  }
}
