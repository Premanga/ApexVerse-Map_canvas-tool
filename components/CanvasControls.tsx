'use client';

import type { ReactNode } from 'react';

import { useCanvasStore } from '../store/canvasStore';

const ZOOM_STEP = 1.5;

interface ControlButtonProps {
  label: string;
  onClick: () => void;
  /** Set for toggles only; leaves plain actions without a pressed state. */
  pressed?: boolean;
  children: ReactNode;
}

function ControlButton({ label, onClick, pressed, children }: ControlButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`grid h-9 w-9 place-items-center transition-colors ${
        pressed
          ? 'bg-amber-400/20 text-amber-300'
          : 'text-neutral-300 hover:bg-white/10 hover:text-white'
      }`}
    >
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {children}
      </svg>
    </button>
  );
}

/**
 * View controls floating over the map. Deliberately not the tool palette —
 * that arrives with the drawing tools.
 */
export function CanvasControls() {
  const gridVisible = useCanvasStore((s) => s.gridVisible);
  const measureMode = useCanvasStore((s) => s.measureMode);
  const setGridVisible = useCanvasStore((s) => s.setGridVisible);
  const setMeasureMode = useCanvasStore((s) => s.setMeasureMode);
  const zoom = useCanvasStore((s) => s.zoom);
  const fit = useCanvasStore((s) => s.fit);

  // Buttons have no cursor to anchor on, so they zoom about the view centre.
  const zoomBy = (factor: number) => {
    const { container } = useCanvasStore.getState();
    if (!container) return;
    zoom({ x: container.width / 2, y: container.height / 2 }, factor);
  };

  return (
    <div className="absolute bottom-4 right-4 flex flex-col divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10 bg-neutral-900/85 shadow-lg backdrop-blur">
      <div className="flex flex-col">
        <ControlButton
          label="Toggle grid"
          pressed={gridVisible}
          onClick={() => setGridVisible(!gridVisible)}
        >
          <path d="M2 2h12v12H2zM6 2v12M10 2v12M2 6h12M2 10h12" />
        </ControlButton>
        <ControlButton
          label="Measure distance (Esc to exit)"
          pressed={measureMode}
          onClick={() => setMeasureMode(!measureMode)}
        >
          <path d="M10.5 1.5l4 4-9 9-4-4zM8.5 3.5l1.5 1.5M6.5 5.5l1.5 1.5M4.5 7.5l1.5 1.5" />
        </ControlButton>
      </div>
      <div className="flex flex-col">
        <ControlButton label="Zoom in" onClick={() => zoomBy(ZOOM_STEP)}>
          <path d="M8 3v10M3 8h10" />
        </ControlButton>
        <ControlButton label="Zoom out" onClick={() => zoomBy(1 / ZOOM_STEP)}>
          <path d="M3 8h10" />
        </ControlButton>
        <ControlButton label="Fit to view" onClick={fit}>
          <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" />
        </ControlButton>
      </div>
    </div>
  );
}
