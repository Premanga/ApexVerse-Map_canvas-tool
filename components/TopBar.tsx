'use client';

import { useState, type ReactNode } from 'react';

import { getMap } from '../constants/maps';
import { MAX_LABEL_LENGTH } from '../lib/objects';
import { newStrategy, saveNow } from '../lib/strategySession';
import { useCanvasStore } from '../store/canvasStore';
import { useStrategyStore, type SaveState } from '../store/strategyStore';
import { ControlIcon } from './ControlIcon';
import { StrategyBrowser } from './StrategyBrowser';
import { ENTER_FROM_TOP, ENTER_POP } from './styles';

interface BarButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}

function BarButton({ label, onClick, disabled, children }: BarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-neutral-300 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-300/70 disabled:pointer-events-none disabled:text-neutral-600"
    >
      <ControlIcon>{children}</ControlIcon>
    </button>
  );
}

/** How each save state reads in the bar: its words, and the colour of its dot. */
const SAVE_STATES: Record<SaveState, { label: string; dot: string; text: string }> = {
  saved: { label: 'Saved', dot: 'bg-emerald-400', text: 'text-neutral-400' },
  unsaved: { label: 'Unsaved changes', dot: 'bg-amber-400', text: 'text-amber-300' },
  saving: { label: 'Saving…', dot: 'bg-sky-400 animate-pulse', text: 'text-neutral-300' },
  conflict: { label: 'Conflict', dot: 'bg-red-400', text: 'text-red-300' },
  error: { label: 'Save failed', dot: 'bg-red-400', text: 'text-red-300' },
};

/** Where the strategy stands with what is stored. Announced when it changes. */
function SaveStatus() {
  const id = useStrategyStore((s) => s.id);
  const saveState = useStrategyStore((s) => s.saveState);
  const error = useStrategyStore((s) => s.error);
  const state = SAVE_STATES[saveState];
  // Nothing has been stored yet, and nothing needs to be: an empty canvas.
  const fresh = id === null && saveState === 'saved';

  return (
    <span
      role="status"
      title={saveState === 'error' && error ? error : undefined}
      className={`flex shrink-0 items-center gap-1.5 text-xs ${fresh ? 'text-neutral-500' : state.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${fresh ? 'bg-neutral-600' : state.dot}`} />
      {/* The dot alone on a phone; the words are still read out. */}
      <span className="max-sm:sr-only">{fresh ? 'Not saved yet' : state.label}</span>
    </span>
  );
}

/**
 * The bar across the top of the editor: what is being edited, on which map,
 * the history, and the switch that puts the interface away.
 *
 * Docked on a desktop — it is one thin row, and the map loses nothing it
 * needs to it. On a phone every row counts, so there it is laid over the
 * top of the map and seen through, like the panels; the floating controls
 * and prompts start below it to match.
 *
 * Renaming is the name field itself: a changed name is saved like any other
 * change. Sharing is not built yet; the stretch before the hide button is
 * left open for it.
 */
export function TopBar() {
  const strategyName = useCanvasStore((s) => s.strategyName);
  const setStrategyName = useCanvasStore((s) => s.setStrategyName);
  const mapName = useCanvasStore((s) => getMap(s.mapKey).displayName);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const canUndo = useCanvasStore((s) => s.history.past.length > 0);
  const canRedo = useCanvasStore((s) => s.history.future.length > 0);
  const setInterfaceHidden = useCanvasStore((s) => s.setInterfaceHidden);
  const layersPanelOpen = useCanvasStore((s) => s.layersPanelOpen);
  const setLayersPanelOpen = useCanvasStore((s) => s.setLayersPanelOpen);
  const saveState = useStrategyStore((s) => s.saveState);
  // Whether the list is up is a matter for this view alone.
  const [browsing, setBrowsing] = useState(false);

  return (
    <header className={`flex h-12 shrink-0 items-center gap-2 border-b border-white/10 bg-neutral-900 px-3 max-md:absolute max-md:inset-x-0 max-md:top-0 max-md:z-10 max-md:bg-neutral-900/40 max-md:backdrop-blur ${ENTER_FROM_TOP}`}>
      {/*
        Reads as a title and edits as a field: no border until it is hovered
        or focused. It gives way first when the bar is narrow.
      */}
      <input
        aria-label="Strategy name"
        value={strategyName}
        maxLength={MAX_LABEL_LENGTH}
        placeholder="Untitled strategy"
        spellCheck={false}
        onChange={(event) => setStrategyName(event.target.value)}
        onKeyDown={(event) => {
          // Done typing: hand the keys back to the canvas.
          if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur();
        }}
        className="h-8 w-56 min-w-0 shrink rounded-md border border-transparent bg-transparent px-2 text-sm font-semibold text-white outline-none transition-colors placeholder:text-neutral-500 hover:border-white/10 focus:border-amber-300/60 focus:bg-black/40"
      />
      <span className="hidden shrink-0 rounded bg-white/5 px-2 py-1 text-xs text-neutral-400 sm:block">
        {mapName}
      </span>

      <div className="ml-1 flex shrink-0 items-center gap-0.5 border-l border-white/10 pl-2">
        <BarButton label="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
          <path d="M6 3 3 6l3 3M3 6h6a4 4 0 0 1 0 8H7" />
        </BarButton>
        <BarButton label="Redo (Ctrl+Y)" onClick={redo} disabled={!canRedo}>
          <path d="M10 3l3 3-3 3M13 6H7a4 4 0 0 0 0 8h2" />
        </BarButton>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 border-l border-white/10 pl-2">
        <BarButton label="New strategy" onClick={() => void newStrategy()}>
          <path d="M4 2h5l3 3v9H4zM9 2v3h3M8 8v4M6 10h4" />
        </BarButton>
        <BarButton label="Open a saved strategy" onClick={() => setBrowsing(true)}>
          <path d="M2 4.5h4l1.5 1.5H14v7H2z" />
        </BarButton>
        {/* Saving is automatic; this is for not wanting to wait for it. */}
        <BarButton
          label="Save now"
          onClick={() => void saveNow()}
          disabled={saveState === 'saving' || saveState === 'conflict'}
        >
          <path d="M3 3h8l2 2v8H3zM5.5 3v3.5h4V3M5.5 13V9.5h5V13" />
        </BarButton>
      </div>
      <SaveStatus />

      {/* Open on purpose: Share goes here when there is something to share with. */}
      <div className="min-w-0 flex-1" />
      {browsing && <StrategyBrowser onClose={() => setBrowsing(false)} />}

      {/* Layers organise what the rail's tools make, so the switch is here, not there. */}
      <button
        type="button"
        title={layersPanelOpen ? 'Hide the layers panel' : 'Show the layers panel'}
        aria-pressed={layersPanelOpen}
        onClick={() => setLayersPanelOpen(!layersPanelOpen)}
        className={`flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-300/70 ${
          layersPanelOpen
            ? 'bg-amber-400/20 text-amber-300'
            : 'text-neutral-300 hover:bg-white/10 hover:text-white'
        }`}
      >
        <ControlIcon>
          <path d="M8 2 2 5l6 3 6-3zM2 8l6 3 6-3M2 11l6 3 6-3" />
        </ControlIcon>
        <span className="hidden sm:inline">Layers</span>
      </button>

      <button
        type="button"
        title="Hide every panel and bar, leaving only the map"
        onClick={() => setInterfaceHidden(true)}
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-neutral-300 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-300/70"
      >
        <ControlIcon>
          <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
        </ControlIcon>
        <span className="hidden sm:inline">Hide interface</span>
      </button>
    </header>
  );
}

/**
 * The way back from a hidden interface. The only thing left on the map, in
 * the corner the hide button was in, and worded rather than an icon alone:
 * with everything else gone there is nothing to explain it.
 */
export function ShowInterfaceButton() {
  const setInterfaceHidden = useCanvasStore((s) => s.setInterfaceHidden);
  return (
    <button
      type="button"
      onClick={() => setInterfaceHidden(false)}
      className={`absolute right-3 top-3 flex h-9 items-center gap-1.5 rounded-lg border border-amber-300/40 bg-neutral-900/90 px-3 text-xs font-semibold text-amber-300 shadow-lg outline-none backdrop-blur hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-amber-300/70 ${ENTER_POP}`}
    >
      <ControlIcon>
        <path d="M6 2v4H2M14 6h-4V2M10 14v-4h4M2 10h4v4" />
      </ControlIcon>
      Show interface
    </button>
  );
}
