'use client';

import { useMemo, useState } from 'react';

import { countByLayer } from '../lib/layers';
import { MAX_LABEL_LENGTH } from '../lib/objects';
import { useCanvasStore } from '../store/canvasStore';
import type { StrategyLayer } from '../types';
import { ControlIcon } from './ControlIcon';
import { ENTER_FADE, ENTER_FROM_RIGHT } from './styles';

/** A row's height with the gap under it: what one step of a drag is worth. */
const ROW_PX = 40;

const ICON_BUTTON =
  'grid h-7 w-6 shrink-0 place-items-center rounded outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-300/70';

const EYE = 'M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8zM8 6a2 2 0 1 0 0 4a2 2 0 1 0 0-4z';
const LOCK_BODY = 'M4 7.5h8v6H4z';

/** The row a drag has in hand, and where it stands in the list as shown. */
interface Drag {
  id: string;
  startY: number;
  from: number;
  to: number;
}

function countLabel(count: number): string {
  return count === 1 ? '1 object' : `${count} objects`;
}

/**
 * The document's layers: which is active, what each holds, whether it is
 * shown and whether it can be touched — and creating, renaming, deleting
 * and reordering them. Apart from the tool rail on purpose: tools make
 * things, layers organise them.
 *
 * Listed top layer first, the way they are stacked on the map, which is the
 * reverse of the document's bottom-first array. Every change is the store's:
 * this keeps only what is in the middle of being done — a name being typed,
 * a delete waiting on its answer, a row in mid-drag.
 */
export function LayersPanel() {
  const open = useCanvasStore((s) => s.layersPanelOpen);
  const layers = useCanvasStore((s) => s.layers);
  const objects = useCanvasStore((s) => s.objects);
  const activeLayerId = useCanvasStore((s) => s.activeLayerId);
  const setOpen = useCanvasStore((s) => s.setLayersPanelOpen);
  const setActiveLayer = useCanvasStore((s) => s.setActiveLayer);
  const addLayer = useCanvasStore((s) => s.addLayer);
  const renameLayer = useCanvasStore((s) => s.renameLayer);
  const setLayerVisible = useCanvasStore((s) => s.setLayerVisible);
  const setLayerLocked = useCanvasStore((s) => s.setLayerLocked);
  const moveLayer = useCanvasStore((s) => s.moveLayer);
  const deleteLayer = useCanvasStore((s) => s.deleteLayer);

  const counts = useMemo(() => countByLayer(objects), [objects]);
  /** The layer being renamed, and its name as typed so far. */
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  /** The layer whose delete is waiting on a second, confirming press. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  if (!open) return null;

  // Top first. While a row is in hand it is shown where it would land, so
  // the list itself is the preview of the new order.
  let shown = [...layers].reverse();
  if (drag) {
    const moving = shown.find((layer) => layer.id === drag.id);
    if (moving) {
      shown = shown.filter((layer) => layer.id !== drag.id);
      shown.splice(drag.to, 0, moving);
    }
  }

  /** One rename, however many keys it took: the name is only sent when done. */
  const finishRename = () => {
    if (renaming) renameLayer(renaming.id, renaming.name);
    setRenaming(null);
  };

  const row = (layer: StrategyLayer) => {
    const count = counts.get(layer.id) ?? 0;
    const active = layer.id === activeLayerId;

    if (confirming === layer.id) {
      return (
        <li key={layer.id} className={`rounded-md bg-red-500/10 p-2 ${ENTER_FADE}`}>
          {/* The count is the point: the consequence, before it happens. */}
          <p className="text-xs leading-snug text-neutral-200">
            {count === 0
              ? `Delete “${layer.name}”? It is empty.`
              : `Delete “${layer.name}” and its ${countLabel(count)}?`}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button
              type="button"
              // Focus lands on the safe choice, so a stray Enter cancels.
              autoFocus
              onClick={() => setConfirming(null)}
              className="h-8 rounded-md bg-white/5 text-xs font-semibold text-neutral-100 transition-colors hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                deleteLayer(layer.id);
                setConfirming(null);
              }}
              className="h-8 rounded-md bg-red-500/20 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/30 hover:text-red-200"
            >
              Delete
            </button>
          </div>
        </li>
      );
    }

    return (
      <li
        key={layer.id}
        className={`flex h-9 items-center gap-0.5 rounded-md pl-0.5 pr-1 ${ENTER_FADE} ${
          drag?.id === layer.id
            ? 'bg-white/15'
            : active
              ? 'bg-amber-400/15'
              : 'hover:bg-white/5'
        }`}
      >
        {/*
          Dragged by the pointer rather than by HTML drag-and-drop, which
          does not exist on a touch screen. The grip keeps the pointer for
          the length of the drag, so it goes on moving the row wherever the
          finger wanders.
        */}
        <span
          role="button"
          tabIndex={-1}
          title="Drag to reorder"
          aria-label={`Reorder ${layer.name}`}
          className="grid h-7 w-5 shrink-0 cursor-grab touch-none place-items-center text-neutral-500 hover:text-neutral-200 active:cursor-grabbing"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            const from = shown.findIndex((candidate) => candidate.id === layer.id);
            setDrag({ id: layer.id, startY: event.clientY, from, to: from });
          }}
          onPointerMove={(event) => {
            if (!drag) return;
            const steps = Math.round((event.clientY - drag.startY) / ROW_PX);
            const to = Math.min(layers.length - 1, Math.max(0, drag.from + steps));
            if (to !== drag.to) setDrag({ ...drag, to });
          }}
          onPointerUp={() => {
            // The list is top first, the document bottom first.
            if (drag && drag.to !== drag.from) moveLayer(drag.id, layers.length - 1 - drag.to);
            setDrag(null);
          }}
          onPointerCancel={() => setDrag(null)}
        >
          <ControlIcon className="h-3! w-3!">
            <path d="M6 4h.01M10 4h.01M6 8h.01M10 8h.01M6 12h.01M10 12h.01" />
          </ControlIcon>
        </span>

        {renaming?.id === layer.id ? (
          <input
            aria-label="Layer name"
            autoFocus
            value={renaming.name}
            maxLength={MAX_LABEL_LENGTH}
            onChange={(event) => setRenaming({ id: layer.id, name: event.target.value })}
            // `FloatingControls` cancels every mouse-down so a clicked button
            // does not keep focus; for a text field that default is what
            // puts the caret in it.
            onMouseDown={(event) => event.stopPropagation()}
            onFocus={(event) => event.currentTarget.select()}
            onBlur={finishRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
              else if (event.key === 'Escape') setRenaming(null);
            }}
            className="h-7 min-w-0 flex-1 rounded border border-amber-300/60 bg-black/40 px-1.5 text-xs text-white outline-none"
          />
        ) : (
          <button
            type="button"
            title={`${layer.name}${active ? ' — active: new objects go here' : ''}. Click to make active, double-click to rename.`}
            aria-pressed={active}
            onClick={() => setActiveLayer(layer.id)}
            onDoubleClick={() => setRenaming({ id: layer.id, name: layer.name })}
            className={`flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded px-1 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 ${
              active ? 'font-semibold text-amber-300' : 'text-neutral-200'
            } ${layer.visible ? '' : 'opacity-50'}`}
          >
            {/* The dot is what says "active" without relying on colour alone. */}
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-amber-300' : 'bg-transparent'}`}
            />
            <span className="truncate">{layer.name}</span>
          </button>
        )}

        <span
          title={`${countLabel(count)} on this layer`}
          className="shrink-0 rounded bg-white/5 px-1 font-mono text-[10px] text-neutral-400"
        >
          {count}
        </span>
        <button
          type="button"
          title={layer.visible ? 'Hide layer' : 'Show layer'}
          aria-label={`${layer.visible ? 'Hide' : 'Show'} ${layer.name}`}
          aria-pressed={!layer.visible}
          onClick={() => setLayerVisible(layer.id, !layer.visible)}
          className={`${ICON_BUTTON} ${
            layer.visible ? 'text-neutral-300 hover:bg-white/10' : 'text-neutral-600 hover:bg-white/10'
          }`}
        >
          <ControlIcon className="h-3.5! w-3.5!">
            <path d={EYE} />
            {!layer.visible && <path d="M2.5 2.5l11 11" />}
          </ControlIcon>
        </button>
        <button
          type="button"
          title={layer.locked ? 'Unlock layer' : 'Lock layer'}
          aria-label={`${layer.locked ? 'Unlock' : 'Lock'} ${layer.name}`}
          aria-pressed={layer.locked}
          onClick={() => setLayerLocked(layer.id, !layer.locked)}
          className={`${ICON_BUTTON} ${
            layer.locked ? 'bg-amber-400/20 text-amber-300' : 'text-neutral-500 hover:bg-white/10'
          }`}
        >
          <ControlIcon className="h-3.5! w-3.5!">
            <path d={LOCK_BODY} />
            {/* The shackle: closed over both sides, or swung open. */}
            <path d={layer.locked ? 'M5.5 7.5V5a2.5 2.5 0 0 1 5 0v2.5' : 'M5.5 7.5V5a2.5 2.5 0 0 1 4.8-1'} />
          </ControlIcon>
        </button>
        <button
          type="button"
          title={layers.length > 1 ? 'Delete layer' : 'A strategy always has one layer'}
          aria-label={`Delete ${layer.name}`}
          disabled={layers.length <= 1}
          onClick={() => setConfirming(layer.id)}
          className={`${ICON_BUTTON} text-red-300 hover:bg-red-500/20 disabled:pointer-events-none disabled:opacity-30`}
        >
          <ControlIcon className="h-3.5! w-3.5!">
            <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5" />
          </ControlIcon>
        </button>
      </li>
    );
  };

  return (
    <div className={`shrink-0 rounded-xl border border-white/10 bg-neutral-900/85 p-2 shadow-lg backdrop-blur max-md:bg-neutral-900/40 ${ENTER_FROM_RIGHT}`}>
      <div className="flex items-center gap-1 pb-1.5">
        <h3 className="min-w-0 flex-1 truncate px-1 text-sm font-semibold text-white">Layers</h3>
        <button
          type="button"
          title="New layer"
          aria-label="New layer"
          onClick={addLayer}
          className={`${ICON_BUTTON} w-7! text-neutral-200 hover:bg-white/10`}
        >
          <ControlIcon>
            <path d="M8 3v10M3 8h10" />
          </ControlIcon>
        </button>
        <button
          type="button"
          title="Close layers"
          aria-label="Close layers"
          onClick={() => setOpen(false)}
          className={`${ICON_BUTTON} w-7! text-neutral-400 hover:bg-white/10 hover:text-white`}
        >
          <ControlIcon>
            <path d="M4 4l8 8M12 4l-8 8" />
          </ControlIcon>
        </button>
      </div>
      <ul className="space-y-1">{shown.map(row)}</ul>
      <p className="mt-1.5 px-1 text-[10px] leading-snug text-neutral-500">
        Top of the list is drawn on top. New objects go on the active layer.
      </p>
    </div>
  );
}
