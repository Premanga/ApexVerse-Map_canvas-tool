'use client';

import { useEffect, useState } from 'react';

import { useCanvasStore } from '../store/canvasStore';
import { RailButton } from './RailButton';
import { TRASH_ICON } from './icons';

const ZOOM_STEP = 1.5;

/** How long the delete-all waits for its confirming tap. */
const CONFIRM_MS = 3000;

interface CanvasControlsProps {
  /** Whether the rail is open. Closed, the buttons stack two to a row, or one on a phone. */
  expanded: boolean;
}

/**
 * Delete-all and the viewport controls: the last section of the tool rail.
 * They act on the map as a whole rather than picking a tool, so none of
 * them is ever shown as "on". Icons only in both states, to keep the rail
 * short. Undo and redo are in the top bar.
 */
export function CanvasControls({ expanded }: CanvasControlsProps) {
  const zoom = useCanvasStore((s) => s.zoom);
  const fit = useCanvasStore((s) => s.fit);
  const deleteAll = useCanvasStore((s) => s.deleteAll);
  // Locked objects are spared, so they alone leave nothing to delete.
  const canDelete = useCanvasStore((s) => s.objects.some((o) => !o.locked));

  /**
   * The delete-all is waiting on a second, confirming tap. There is no room
   * here for a Cancel beside it, so leaving it alone is the cancel: it
   * stands down by itself.
   */
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), CONFIRM_MS);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  // Buttons have no cursor to anchor on, so they zoom about the view centre.
  const zoomBy = (factor: number) => {
    const { container } = useCanvasStore.getState();
    if (!container) return;
    zoom({ x: container.width / 2, y: container.height / 2 }, factor);
  };

  return (
    <div className={`grid gap-1 ${expanded ? 'grid-cols-4' : 'grid-cols-2 max-md:grid-cols-1'}`}>
      <RailButton
        label={confirming ? 'Tap again to delete everything on the map' : 'Delete everything on the map'}
        danger
        armed={confirming}
        disabled={!canDelete}
        showLabel={false}
        onClick={() => {
          if (!confirming) {
            setConfirming(true);
            return;
          }
          deleteAll();
          setConfirming(false);
        }}
      >
        {confirming ? (
          <path d="M3 8.5l3.5 3.5L13 4.5" />
        ) : (
          <path d={TRASH_ICON} />
        )}
      </RailButton>
      <RailButton label="Zoom in" showLabel={false} onClick={() => zoomBy(ZOOM_STEP)}>
        <path d="M8 3v10M3 8h10" />
      </RailButton>
      <RailButton label="Zoom out" showLabel={false} onClick={() => zoomBy(1 / ZOOM_STEP)}>
        <path d="M3 8h10" />
      </RailButton>
      <RailButton label="Fit to view" showLabel={false} onClick={fit}>
        <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
      </RailButton>
    </div>
  );
}
