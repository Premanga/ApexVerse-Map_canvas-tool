import type { MapDefinition, Point, Size, StrategyView, Viewport } from '../types';

/**
 * Viewport math.
 *
 * The stage transform maps normalized map space -> screen pixels:
 *   screen = map * scale + offset
 *
 * Scale is uniform on both axes, which assumes a square map. Every BGMI
 * battle-royale map is square.
 */

/** Zoomed all the way in, one normalized unit spans the raster's full width. */
function maxScale(map: MapDefinition): number {
  return map.imagePx.width;
}

/** Smallest scale that still fits the whole map in the container. */
export function fitScale(container: Size): number {
  return Math.min(container.width, container.height);
}

/** Viewport showing the whole map, centred. */
export function fitViewport(container: Size): Viewport {
  const scale = fitScale(container);
  return {
    scale,
    x: (container.width - scale) / 2,
    y: (container.height - scale) / 2,
  };
}

/** The view a viewport shows in this container, in screen-free terms. */
export function viewOf(viewport: Viewport, container: Size): StrategyView {
  return {
    x: (container.width / 2 - viewport.x) / viewport.scale,
    y: (container.height / 2 - viewport.y) / viewport.scale,
    zoom: viewport.scale / fitScale(container),
  };
}

/**
 * The viewport that shows `view` in this container: the same map point in
 * the middle, at the same multiple of the fitting zoom. On a container of a
 * different shape that is the nearest thing to "the same view" there is.
 */
export function viewportOf(
  view: StrategyView,
  container: Size,
  map: MapDefinition,
): Viewport {
  const fit = fitScale(container);
  const scale = Math.min(maxScale(map), Math.max(fit, view.zoom * fit));
  return clampViewport(
    {
      scale,
      x: container.width / 2 - view.x * scale,
      y: container.height / 2 - view.y * scale,
    },
    container,
  );
}

export function screenToMap(viewport: Viewport, screen: Point): Point {
  return {
    x: (screen.x - viewport.x) / viewport.scale,
    y: (screen.y - viewport.y) / viewport.scale,
  };
}

export function mapToScreen(viewport: Viewport, map: Point): Point {
  return {
    x: map.x * viewport.scale + viewport.x,
    y: map.y * viewport.scale + viewport.y,
  };
}

export function clampPoint(p: Point): Point {
  return {
    x: Math.min(1, Math.max(0, p.x)),
    y: Math.min(1, Math.max(0, p.y)),
  };
}

/**
 * Keeps the map sensibly placed. Fully zoomed out it is centred. Zoomed in,
 * the only rule is that the middle of the view stays over the map, so it
 * can never be panned away entirely.
 *
 * Deliberately looser than "centre it when narrower than the view, pin it to
 * the edges when wider": that rule moved the map out from under the cursor
 * or pinch midpoint on nearly every zoom step. This one never fights a
 * zoom-in about a point on the map — scaling an interval up about a point
 * inside it only grows it, so if it covered the view's middle before, it
 * still does — and it lets an edge of the map be brought to mid-screen.
 */
export function clampViewport(viewport: Viewport, container: Size): Viewport {
  const { scale } = viewport;
  const fitted = scale <= fitScale(container);

  const axis = (offset: number, extent: number): number => {
    if (fitted) return (extent - scale) / 2;
    return Math.min(extent / 2, Math.max(extent / 2 - scale, offset));
  };

  return {
    scale,
    x: axis(viewport.x, container.width),
    y: axis(viewport.y, container.height),
  };
}

/**
 * Zooms by `factor` while holding the map point under `anchor` (a screen
 * position — the cursor, or a pinch midpoint) visually fixed.
 */
export function zoomAt(
  viewport: Viewport,
  anchor: Point,
  factor: number,
  container: Size,
  map: MapDefinition,
): Viewport {
  const min = fitScale(container);
  const max = maxScale(map);
  const scale = Math.min(max, Math.max(min, viewport.scale * factor));

  if (scale === viewport.scale) return viewport;

  const mapPoint = screenToMap(viewport, anchor);

  return clampViewport(
    {
      scale,
      x: anchor.x - mapPoint.x * scale,
      y: anchor.y - mapPoint.y * scale,
    },
    container,
  );
}

/** Straight-line distance between two normalized points, in metres. */
export function distanceM(a: Point, b: Point, map: MapDefinition): number {
  const dx = (b.x - a.x) * map.worldSizeM;
  const dy = (b.y - a.y) * map.worldSizeM;
  return Math.hypot(dx, dy);
}

/**
 * Length in metres of each consecutive leg of a route: [A–B, B–C, …].
 * The one place route distances are derived — never store these.
 */
export function routeSegmentsM(points: Point[], map: MapDefinition): number[] {
  return points.slice(1).map((point, i) => distanceM(points[i], point, map));
}

/** Distance along the route, not the straight line between its ends. */
export function routeTotalM(points: Point[], map: MapDefinition): number {
  return routeSegmentsM(points, map).reduce((sum, metres) => sum + metres, 0);
}

/** Route point name from its zero-based index: 0 is "A". */
export function routeLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

/**
 * The only distance formatter. Whole metres with thousands separators at
 * every magnitude — ranges are called out in metres, never kilometres.
 */
export function formatDistance(metres: number): string {
  if (!Number.isFinite(metres)) return '—';
  // Fixed locale so the separator does not vary with the browser's.
  return `${Math.round(metres).toLocaleString('en-US')} m`;
}

/** Grid cell name from zero-based indices: column 0, row 0 is "A1". */
export function gridLabel(col: number, row: number): string {
  return String.fromCharCode(65 + col) + (row + 1);
}

/**
 * Inverse of the stage scale. Multiply any dimension that should stay
 * constant on screen — stroke widths, marker radii, font sizes — by this.
 */
export function screenUnit(viewport: Viewport): number {
  return 1 / viewport.scale;
}
