import type { MapDefinition, Point, Size, Viewport } from '../types';

/**
 * Viewport math.
 *
 * The stage transform maps normalized map space -> screen pixels:
 *   screen = map * scale + offset
 *
 * Scale is uniform on both axes, which assumes a square map. Every BGMI
 * battle-royale map is square. `assertSquare` below fails loudly if that
 * ever stops being true, rather than silently distorting geometry.
 */

/** Zoomed all the way in, one normalized unit spans the raster's full width. */
function maxScale(map: MapDefinition): number {
  return map.imagePx.width;
}

export function assertSquare(map: MapDefinition): void {
  if (map.imagePx.width !== map.imagePx.height) {
    throw new Error(
      `Map "${map.key}" is not square. Normalized coordinates and uniform ` +
        `stage scale both assume a square raster — see map-canvas/types.ts.`,
    );
  }
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
 * Keeps the map sensibly placed: centred on an axis where it is smaller than
 * the container, edge-locked where it is larger. Prevents panning the map
 * off into empty space, which is disorienting and has no use.
 */
export function clampViewport(viewport: Viewport, container: Size): Viewport {
  const { scale } = viewport;

  const axis = (offset: number, extent: number): number => {
    if (scale <= extent) return (extent - scale) / 2;
    return Math.min(0, Math.max(extent - scale, offset));
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
 * Inverse of the stage scale. Multiply any dimension that should stay
 * constant on screen — stroke widths, marker radii, font sizes — by this.
 */
export function screenUnit(viewport: Viewport): number {
  return 1 / viewport.scale;
}
