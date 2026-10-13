'use client';

import { useCallback, useEffect, useState } from 'react';

import { getMap } from '../constants/maps';
import {
  deleteStrategy,
  duplicateStrategy,
  messageOf,
  newStrategy,
  openStrategy,
} from '../lib/strategySession';
import { getStrategyRepository, type StrategyMeta } from '../persistence';
import { useStrategyStore } from '../store/strategyStore';
import { ControlIcon } from './ControlIcon';
import { DUPLICATE_ICON, TRASH_ICON } from './icons';
import { ENTER_FADE, ENTER_POP } from './styles';

const ROW_ACTION =
  'grid h-8 w-8 shrink-0 place-items-center rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-300/70';

/** A registry lookup that must not throw for a map this build has dropped. */
function mapNameOf(key: string): string {
  try {
    return getMap(key).displayName;
  } catch {
    return key;
  }
}

interface StrategyBrowserProps {
  onClose: () => void;
}

/**
 * The saved strategies, newest first: open one, copy one, delete one, or
 * start a new one. It asks the repository for the list — titles and dates,
 * never the plans themselves — each time it opens and after each change,
 * rather than keeping a copy that could fall behind.
 */
export function StrategyBrowser({ onClose }: StrategyBrowserProps) {
  const openId = useStrategyStore((s) => s.id);
  const [items, setItems] = useState<StrategyMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The strategy whose delete is waiting on a second, confirming press. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setItems(await getStrategyRepository().list());
    } catch (cause) {
      setError(messageOf(cause));
    }
  }, []);

  useEffect(() => {
    // Closed before the list arrived, there is nothing left to put it in.
    let open = true;
    getStrategyRepository()
      .list()
      .then(
        (list) => {
          if (open) setItems(list);
        },
        (cause: unknown) => {
          if (open) setError(messageOf(cause));
        },
      );
    return () => {
      open = false;
    };
  }, []);

  /** Runs one action at a time and shows what went wrong, if anything did. */
  const run = async (action: () => Promise<void>, closeAfter: boolean) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      if (closeAfter) onClose();
      else await refresh();
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="Strategies"
      className={`fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 ${ENTER_FADE}`}
      // A press on the backdrop, not on the list, closes it.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div className={`flex max-h-full w-full max-w-md flex-col rounded-xl border border-white/10 bg-neutral-900 text-neutral-200 shadow-2xl ${ENTER_POP}`}>
        <div className="flex shrink-0 items-center gap-2 border-b border-white/10 p-3">
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
            Strategies
          </h2>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(newStrategy, true)}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-amber-400/20 px-2.5 text-xs font-semibold text-amber-300 outline-none transition-colors hover:bg-amber-400/30 focus-visible:ring-2 focus-visible:ring-amber-300/70 disabled:opacity-50"
          >
            <ControlIcon>
              <path d="M8 3v10M3 8h10" />
            </ControlIcon>
            New
          </button>
          <button
            type="button"
            title="Close"
            aria-label="Close"
            // Focus starts inside the dialog, on the choice that changes nothing.
            autoFocus
            onClick={onClose}
            className={`${ROW_ACTION} text-neutral-400 hover:bg-white/10 hover:text-white`}
          >
            <ControlIcon>
              <path d="M4 4l8 8M12 4l-8 8" />
            </ControlIcon>
          </button>
        </div>

        {error && (
          <p role="alert" className="shrink-0 border-b border-white/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {items === null ? (
            <p className="p-4 text-center text-xs text-neutral-500">Loading…</p>
          ) : items.length === 0 ? (
            <p className="p-4 text-center text-xs text-neutral-500">
              Nothing saved yet. A strategy is saved as soon as you draw on it.
            </p>
          ) : (
            <ul className="space-y-1">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-center gap-1 rounded-lg p-1 ${
                    item.id === openId ? 'bg-amber-400/10' : 'hover:bg-white/5'
                  }`}
                >
                  {confirming === item.id ? (
                    <>
                      <p className="min-w-0 flex-1 truncate px-2 text-xs text-neutral-200">
                        Delete “{item.title}”? This cannot be undone.
                      </p>
                      <button
                        type="button"
                        // The safe choice takes the focus, so a stray Enter cancels.
                        autoFocus
                        onClick={() => setConfirming(null)}
                        className="h-8 shrink-0 rounded-md bg-white/5 px-2.5 text-xs font-semibold text-neutral-100 transition-colors hover:bg-white/10"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void run(() => deleteStrategy(item.id), false)}
                        className="h-8 shrink-0 rounded-md bg-red-500/20 px-2.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/30 hover:text-red-200 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        title={item.id === openId ? 'Open now' : `Open “${item.title}”`}
                        onClick={() => void run(() => openStrategy(item.id), true)}
                        className="min-w-0 flex-1 rounded-md px-2 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
                      >
                        <span className="block truncate text-sm font-medium text-white">
                          {item.title}
                          {item.id === openId && (
                            <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                              Open
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-[11px] text-neutral-500">
                          {mapNameOf(item.map)} · {new Date(item.updatedAt).toLocaleString()}
                        </span>
                      </button>
                      <button
                        type="button"
                        title="Duplicate"
                        aria-label={`Duplicate ${item.title}`}
                        disabled={busy}
                        onClick={() => void run(() => duplicateStrategy(item.id), false)}
                        className={`${ROW_ACTION} text-neutral-400 hover:bg-white/10 hover:text-white disabled:opacity-50`}
                      >
                        <ControlIcon>
                          <path d={DUPLICATE_ICON} />
                        </ControlIcon>
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        aria-label={`Delete ${item.title}`}
                        disabled={busy}
                        onClick={() => setConfirming(item.id)}
                        className={`${ROW_ACTION} text-red-300 hover:bg-red-500/20 hover:text-red-200 disabled:opacity-50`}
                      >
                        <ControlIcon>
                          <path d={TRASH_ICON} />
                        </ControlIcon>
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="shrink-0 border-t border-white/10 px-3 py-2 text-[10px] leading-snug text-neutral-500">
          Rename a strategy by opening it and editing its name in the top bar.
        </p>
      </div>
    </div>
  );
}
