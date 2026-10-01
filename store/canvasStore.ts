import { create } from 'zustand';

import type { Point, Size, Viewport } from '../types';
import { DEFAULT_MAP_KEY, getMap } from '../constants/maps';
import { clampViewport, fitViewport, zoomAt } from '../lib/coords';

/**
 * Canvas store — step 1 holds only the map selection and the viewport.
 * Objects, selection and history land here in later steps.
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

  setMap: (mapKey: string) => void;
  /** Called by the ResizeObserver. Re-fits on first measure, clamps after. */
  setContainer: (container: Size) => void;
  zoom: (anchor: Point, factor: number) => void;
  panBy: (dx: number, dy: number) => void;
  fit: () => void;
}

const NO_VIEWPORT: Viewport = { scale: 1, x: 0, y: 0 };

export const useCanvasStore = create<CanvasState>((set, get) => ({
  mapKey: DEFAULT_MAP_KEY,
  viewport: NO_VIEWPORT,
  container: null,

  setMap: (mapKey) => {
    const { container } = get();
    set({
      mapKey,
      viewport: container ? fitViewport(container) : NO_VIEWPORT,
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
}));
