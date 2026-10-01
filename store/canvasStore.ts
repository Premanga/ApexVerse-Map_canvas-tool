import { create } from 'zustand';

import type { Point, Size, Viewport } from '../types';
import { DEFAULT_MAP_KEY, getMap } from '../constants/maps';
import { clampViewport, fitViewport, zoomAt } from '../lib/coords';

/**
 * Canvas store — map selection, viewport, and the view-only aids (grid,
 * measure). Objects, selection and history land here in later steps.
 *
 * The viewport lives in the store rather than in Konva's own stage state so
 * that non-canvas UI (zoom buttons, a minimap, the grid overlay) reads one
 * value instead of reaching into the stage ref.
 */

interface CanvasState {
  mapKey: string;
  viewport: Viewport;
  /** Null until the container has been measured. */
  container: Size | null;
  gridVisible: boolean;
  measureMode: boolean;
  /**
   * The measured route, A onwards, at most MAX_MEASURE_POINTS normalized
   * points. A measurement is a transient reading, not a strategy object —
   * it is never persisted. Distances are derived from these on render.
   */
  measurePoints: Point[];
  /** A finished route takes no more points until it is cleared or undone. */
  measureDone: boolean;

  setMap: (mapKey: string) => void;
  /** Called by the ResizeObserver. Re-fits on first measure, clamps after. */
  setContainer: (container: Size) => void;
  zoom: (anchor: Point, factor: number) => void;
  panBy: (dx: number, dy: number) => void;
  fit: () => void;
  setGridVisible: (visible: boolean) => void;
  /** Entering and leaving both discard the current measurement. */
  setMeasureMode: (active: boolean) => void;
  /** Ignored once the route is finished; the last allowed point finishes it. */
  addMeasurePoint: (point: Point) => void;
  moveMeasurePoint: (index: number, point: Point) => void;
  /** Also reopens a finished route, so the removed point can be re-placed. */
  removeLastMeasurePoint: () => void;
  /** Needs at least two points — one point is not a measurement. */
  finishMeasure: () => void;
  clearMeasure: () => void;
}

export const MAX_MEASURE_POINTS = 4;

const NO_VIEWPORT: Viewport = { scale: 1, x: 0, y: 0 };

const isFinitePoint = (p: Point) => Number.isFinite(p.x) && Number.isFinite(p.y);

export const useCanvasStore = create<CanvasState>((set, get) => ({
  mapKey: DEFAULT_MAP_KEY,
  viewport: NO_VIEWPORT,
  container: null,
  gridVisible: false,
  measureMode: false,
  measurePoints: [],
  measureDone: false,

  setMap: (mapKey) => {
    const { container } = get();
    set({
      mapKey,
      viewport: container ? fitViewport(container) : NO_VIEWPORT,
      measurePoints: [],
      measureDone: false,
    });
  },

  setContainer: (container) => {
    const { container: previous, viewport } = get();
    set({
      container,
      viewport: previous
        ? clampViewport(viewport, container)
        : fitViewport(container),
    });
  },

  zoom: (anchor, factor) => {
    const { container, viewport, mapKey } = get();
    if (!container) return;
    set({ viewport: zoomAt(viewport, anchor, factor, container, getMap(mapKey)) });
  },

  panBy: (dx, dy) => {
    const { container, viewport } = get();
    if (!container) return;
    set({
      viewport: clampViewport(
        { ...viewport, x: viewport.x + dx, y: viewport.y + dy },
        container,
      ),
    });
  },

  fit: () => {
    const { container } = get();
    if (!container) return;
    set({ viewport: fitViewport(container) });
  },

  setGridVisible: (gridVisible) => set({ gridVisible }),

  setMeasureMode: (measureMode) =>
    set({ measureMode, measurePoints: [], measureDone: false }),

  addMeasurePoint: (point) => {
    const { measurePoints, measureDone } = get();
    if (measureDone || measurePoints.length >= MAX_MEASURE_POINTS) return;
    if (!isFinitePoint(point)) return;
    const next = [...measurePoints, point];
    set({ measurePoints: next, measureDone: next.length >= MAX_MEASURE_POINTS });
  },

  moveMeasurePoint: (index, point) => {
    const { measurePoints } = get();
    if (index < 0 || index >= measurePoints.length || !isFinitePoint(point)) return;
    set({ measurePoints: measurePoints.map((p, i) => (i === index ? point : p)) });
  },

  removeLastMeasurePoint: () =>
    set({ measurePoints: get().measurePoints.slice(0, -1), measureDone: false }),

  finishMeasure: () => {
    if (get().measurePoints.length >= 2) set({ measureDone: true });
  },

  clearMeasure: () => set({ measurePoints: [], measureDone: false }),
}));
