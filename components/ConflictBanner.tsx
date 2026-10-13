'use client';

import { keepConflictAsCopy, reloadConflict } from '../lib/strategySession';
import { useStrategyStore } from '../store/strategyStore';
import { ENTER_FROM_TOP } from './styles';

/**
 * Shown when a save was refused because the strategy had changed elsewhere.
 * Saving has already stopped. Nothing is merged, here or anywhere: two
 * people's overlapping tactical drawings have no sensible automatic merge,
 * and a guess would be worse than the question. So the choice is put
 * plainly — take theirs, or keep yours beside it.
 *
 * Over the map rather than in the top bar, so it is there even with the
 * interface hidden: unsaved work must not go unnoticed.
 */
export function ConflictBanner() {
  const conflict = useStrategyStore((s) => s.conflict);
  const error = useStrategyStore((s) => s.error);
  if (!conflict) return null;

  return (
    <div
      role="alert"
      className={`absolute left-1/2 top-4 z-20 w-[min(26rem,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-red-400/40 bg-neutral-900/95 p-3 text-xs text-neutral-200 shadow-xl backdrop-blur max-md:top-16 ${ENTER_FROM_TOP}`}
    >
      <p className="font-semibold text-red-300">This strategy was changed somewhere else.</p>
      <p className="mt-1 leading-snug text-neutral-400">
        Autosave has stopped, and your changes here are not saved. Reloading
        replaces what is on screen with the saved version.
      </p>
      {error && <p className="mt-1 text-red-300">{error}</p>}
      <div className="mt-2 flex gap-1.5">
        <button
          type="button"
          onClick={reloadConflict}
          className="h-8 flex-1 rounded-md bg-white/10 px-2 font-semibold text-white transition-colors hover:bg-white/15"
        >
          Reload saved version
        </button>
        <button
          type="button"
          title="Saves what is on screen as a separate strategy and leaves the other one as it is"
          onClick={() => void keepConflictAsCopy()}
          className="h-8 flex-1 rounded-md bg-amber-400/20 px-2 font-semibold text-amber-300 transition-colors hover:bg-amber-400/30"
        >
          Keep mine as a copy
        </button>
      </div>
    </div>
  );
}
