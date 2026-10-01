'use client';

import { getMap } from '../constants/maps';
import {
  formatDistance,
  routeLabel,
  routeSegmentsM,
  routeTotalM,
} from '../lib/coords';
import { MAX_MEASURE_POINTS, useCanvasStore } from '../store/canvasStore';

function hint(count: number, done: boolean): string {
  if (count >= MAX_MEASURE_POINTS) {
    return `${MAX_MEASURE_POINTS}-point limit reached. Clear to start a new route.`;
  }
  if (done) return 'Route finished. Drag a point to adjust it.';
  if (count < 2) return `Click the map to place point ${routeLabel(count)}.`;
  return `Click to add point ${routeLabel(count)}, or finish.`;
}

interface PanelButtonProps {
  label: string;
  title: string;
  disabled: boolean;
  onClick: () => void;
}

function PanelButton({ label, title, disabled, onClick }: PanelButtonProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="flex-1 rounded px-2 py-1 text-neutral-200 transition-colors hover:bg-white/10 disabled:text-neutral-600 disabled:hover:bg-transparent"
    >
      {label}
    </button>
  );
}

/**
 * Readout for the measured route: each leg, the total along the route, and
 * the actions that end or reset it. Shown only while measure mode is on.
 */
export function MeasurePanel() {
  const mapKey = useCanvasStore((s) => s.mapKey);
  const points = useCanvasStore((s) => s.measurePoints);
  const done = useCanvasStore((s) => s.measureDone);
  const removeLast = useCanvasStore((s) => s.removeLastMeasurePoint);
  const finish = useCanvasStore((s) => s.finishMeasure);
  const clear = useCanvasStore((s) => s.clearMeasure);

  const map = getMap(mapKey);
  const segments = routeSegmentsM(points, map);

  return (
    <div className="absolute left-4 top-4 w-52 rounded-lg border border-white/10 bg-neutral-900/85 p-3 text-xs text-neutral-200 shadow-lg backdrop-blur">
      {segments.length > 0 && (
        <dl className="mb-2 space-y-1 tabular-nums">
          {segments.map((metres, i) => (
            <div key={i} className="flex justify-between">
              <dt className="text-neutral-400">
                {routeLabel(i)}–{routeLabel(i + 1)}
              </dt>
              <dd>{formatDistance(metres)}</dd>
            </div>
          ))}
          <div className="flex justify-between border-t border-white/10 pt-1 text-sm font-semibold text-amber-300">
            <dt>Total</dt>
            <dd>{formatDistance(routeTotalM(points, map))}</dd>
          </div>
        </dl>
      )}

      <p className="text-neutral-400" aria-live="polite">
        {hint(points.length, done)}
      </p>

      <div className="mt-2 flex gap-1 border-t border-white/10 pt-2">
        <PanelButton
          label="Undo"
          title="Remove the last point (Backspace)"
          disabled={points.length === 0}
          onClick={removeLast}
        />
        <PanelButton
          label="Finish"
          title="Finish the route (Enter)"
          disabled={done || points.length < 2}
          onClick={finish}
        />
        <PanelButton
          label="Clear"
          title="Clear the route and start again at A"
          disabled={points.length === 0}
          onClick={clear}
        />
      </div>
    </div>
  );
}
