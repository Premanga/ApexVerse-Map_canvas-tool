/**
 * Map Canvas — shared types.
 *
 * Coordinate convention (load-bearing, read this before touching geometry):
 * every position in this module is NORMALIZED to [0, 1] on both axes,
 * measured from the map image's top-left corner. Nothing is ever stored or
 * passed around in screen pixels. The Konva stage's own coordinate space is
 * this same normalized space, so a persisted point renders as-is.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/**
 * Stage transform.
 *
 * `scale` is screen pixels per normalized unit — i.e. the on-screen edge
 * length of the whole map. `x` / `y` are the screen position of the map's
 * top-left corner.
 */
export interface Viewport {
  scale: number;
  x: number;
  y: number;
}

export interface MapDefinition {
  /** Stable key persisted in the strategy document. */
  key: string;
  displayName: string;
  /** Map raster. Served from static assets or object storage. */
  imageUrl: string;
  /** Source raster size. Used for aspect ratio only. */
  imagePx: Size;
  /**
   * Real-world edge length in metres — the sole input to distance
   * measurement. An error here is silently wrong everywhere rather than
   * visibly broken, so it must be verified against the in-game map.
   */
  worldSizeM: number;
  /** Cells per edge drawn by the grid overlay. A display choice. */
  gridDivisions: number;
}
