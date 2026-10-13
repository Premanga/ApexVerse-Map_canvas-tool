import { SUBTYPES, type SubtypeKey } from '../constants/subtypes';
import type {
  Coord,
  ObjectPatch,
  ObjectStyle,
  PathObject,
  PointObject,
  RegionObject,
  StrategyObject,
  TextObject,
  ToolStyle,
} from '../types';
import { newId } from './id';

/**
 * Pure operations on strategy objects. Each switches on `kind` — the one
 * axis geometry varies along — and never on `subtype`.
 */

const DEFAULT_LAYER = 'default';

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const inRange = ([x, y]: Coord) => x >= 0 && x <= 1 && y >= 0 && y <= 1;

export function clampCoord([x, y]: Coord): Coord {
  return [clamp01(x), clamp01(y)];
}

/** The widest a circle can be and still lie wholly on the map. */
const MAX_REGION_RADIUS = 0.5;

/** The centre nearest `at` that keeps a circle of `radius` on the map. */
function clampCentre([x, y]: Coord, radius: number): Coord {
  const keep = (n: number) => Math.min(1 - radius, Math.max(radius, n));
  return [keep(x), keep(y)];
}

/**
 * The radius nearest `radius` that a circle centred on `at` can have without
 * leaving the map: growing stops at the first edge it meets.
 */
export function fitRadius([x, y]: Coord, radius: number): number {
  return Math.max(0, Math.min(radius, x, 1 - x, y, 1 - y));
}

/**
 * Forces an object's geometry into the map. Returns the same reference when
 * it is already inside, so committing does not churn every object's identity.
 */
export function clampObject(object: StrategyObject): StrategyObject {
  switch (object.kind) {
    case 'point':
    case 'text':
      return inRange(object.at) ? object : { ...object, at: clampCoord(object.at) };
    case 'region': {
      // The whole circle stays on the map, not just its centre — unless it
      // is a stage, whose size is fixed and may not fit.
      const staged = object.stage !== undefined;
      const radius = staged
        ? Math.max(0, object.radius)
        : Math.min(MAX_REGION_RADIUS, Math.max(0, object.radius));
      const at = staged ? clampCoord(object.at) : clampCentre(object.at, radius);
      return radius === object.radius && at[0] === object.at[0] && at[1] === object.at[1]
        ? object
        : { ...object, at, radius };
    }
    case 'path':
      return object.points.every(inRange)
        ? object
        : { ...object, points: object.points.map(clampCoord) };
  }
}

/** The position a move is expressed against: where the object "is". */
export function anchorOf(object: StrategyObject): Coord {
  return object.kind === 'path' ? (object.points[0] ?? [0, 0]) : object.at;
}

/** The object with its anchor at `to`, kept inside the map. */
export function moveTo(object: StrategyObject, to: Coord): StrategyObject {
  switch (object.kind) {
    case 'point':
    case 'text':
      return { ...object, at: clampCoord(to) };
    case 'region':
      return {
        ...object,
        at: object.stage === undefined ? clampCentre(to, object.radius) : clampCoord(to),
      };
    case 'path': {
      // A path moves rigidly. Clamping each point would crush it against the
      // edge, so the travel itself is limited to what keeps every point in.
      const [ax, ay] = anchorOf(object);
      const xs = object.points.map((p) => p[0]);
      const ys = object.points.map((p) => p[1]);
      const dx = Math.min(1 - Math.max(...xs), Math.max(-Math.min(...xs), to[0] - ax));
      const dy = Math.min(1 - Math.max(...ys), Math.max(-Math.min(...ys), to[1] - ay));
      return { ...object, points: object.points.map(([x, y]) => [x + dx, y + dy]) };
    }
  }
}

/**
 * The path with one vertex at `to` and the rest where they were. Any other
 * kind, or an index the path does not have, comes back unchanged.
 */
export function moveVertex(
  object: StrategyObject,
  index: number,
  to: Coord,
): StrategyObject {
  if (object.kind !== 'path' || index < 0 || index >= object.points.length) {
    return object;
  }
  return {
    ...object,
    points: object.points.map((p, i) => (i === index ? clampCoord(to) : p)),
  };
}

/**
 * Which region a press at `point` is for, or null when it is for none.
 *
 * A region answers for its ring, to within `ringReach` either side. While
 * the selected region lies under the point, any region does for its whole
 * disc — the selected one so its body can be dragged, the others so that one
 * nested inside it can still be reached. Of those that answer, the smallest
 * wins: a circle inside another is never hidden by it, whichever was drawn
 * first and whichever is selected.
 */
export function regionAt(
  objects: StrategyObject[],
  selectedId: string | null,
  point: { x: number; y: number },
  ringReach: number,
): RegionObject | null {
  const reach = (region: RegionObject) =>
    Math.hypot(point.x - region.at[0], point.y - region.at[1]);
  const regions = objects.filter((o): o is RegionObject => o.kind === 'region');
  const underSelected = regions.some(
    (r) => r.id === selectedId && reach(r) <= r.radius,
  );
  let found: RegionObject | null = null;
  for (const region of regions) {
    const distance = reach(region);
    const answers =
      Math.abs(distance - region.radius) <= ringReach ||
      (underSelected && distance <= region.radius);
    if (answers && (found === null || region.radius < found.radius)) found = region;
  }
  return found;
}

/**
 * The region with its edge `radius` from its centre, as far as the map
 * allows. Any other kind comes back unchanged.
 */
export function resizeTo(object: StrategyObject, radius: number): StrategyObject {
  // A stage's radius is not anyone's to set.
  if (object.kind !== 'region' || object.stage !== undefined) return object;
  return { ...object, radius: fitRadius(object.at, radius) };
}

export function patchObject(object: StrategyObject, patch: ObjectPatch): StrategyObject {
  return { ...object, ...patch };
}

/** How far a copy is set off from its original, on both axes. */
const DUPLICATE_OFFSET = 0.02;

/**
 * A copy of `object` with its own id, a little down and to the right so it
 * does not hide under the original. It shares nothing with it: the style is
 * copied, and moving rebuilds the geometry.
 */
export function duplicateOf(object: StrategyObject, z: number): StrategyObject {
  const [x, y] = anchorOf(object);
  return moveTo({ ...object, id: newId(), z, style: { ...object.style } }, [
    x + DUPLICATE_OFFSET,
    y + DUPLICATE_OFFSET,
  ]);
}

/** One above the current top, so a new object lands in front. */
export function nextZ(objects: StrategyObject[]): number {
  return objects.reduce((top, o) => Math.max(top, o.z + 1), 0);
}

/** A new point object carrying its subtype's defaults. */
export function createPoint(
  subtype: SubtypeKey,
  at: Coord,
  z: number,
  label = '',
): PointObject {
  return {
    id: newId(),
    kind: 'point',
    subtype,
    style: { ...SUBTYPES[subtype].defaultStyle },
    label,
    layer: DEFAULT_LAYER,
    z,
    locked: false,
    at: clampCoord(at),
  };
}

/**
 * A new region object of `radius` about `at`, kept on the map. With `stage`
 * it is that step of its subtype's series, and takes `radius` as given.
 */
export function createRegion(
  subtype: SubtypeKey,
  at: Coord,
  radius: number,
  z: number,
  style: ObjectStyle = toolStyleOf(subtype),
  stage?: number,
): RegionObject {
  const centre = clampCoord(at);
  return {
    id: newId(),
    kind: 'region',
    subtype,
    style,
    label: '',
    layer: DEFAULT_LAYER,
    z,
    locked: false,
    at: centre,
    radius: stage === undefined ? fitRadius(centre, radius) : Math.max(0, radius),
    ...(stage !== undefined && { stage }),
  };
}

/** The longest a note's text runs. The strategy document is size-capped. */
export const MAX_NOTE_LENGTH = 300;

/** A new, empty text object at `at`. */
export function createText(
  subtype: SubtypeKey,
  at: Coord,
  z: number,
  style: ObjectStyle = toolStyleOf(subtype),
): TextObject {
  return {
    id: newId(),
    kind: 'text',
    subtype,
    style,
    label: '',
    layer: DEFAULT_LAYER,
    z,
    locked: false,
    at: clampCoord(at),
    content: '',
  };
}

/** The widths a tool's settings can choose between, in screen pixels. */
export const MIN_STROKE_PX = 1;
export const MAX_STROKE_PX = 20;

/**
 * The style `subtype`'s next object is drawn in: its defaults, under
 * whatever the user has chosen for it. Always a fresh object, so the one an
 * object ends up holding is never shared with the registry or the settings.
 */
export function toolStyleOf(subtype: SubtypeKey, chosen?: ToolStyle): ObjectStyle {
  return { ...SUBTYPES[subtype].defaultStyle, ...chosen };
}

/** The longest label an object carries, whichever way it was entered. */
export const MAX_LABEL_LENGTH = 40;

/** A new path object through `points`, in `style` or its subtype's defaults. */
export function createPath(
  subtype: SubtypeKey,
  points: Coord[],
  z: number,
  style: ObjectStyle = toolStyleOf(subtype),
  label = '',
): PathObject {
  return {
    id: newId(),
    kind: 'path',
    subtype,
    style,
    label,
    layer: DEFAULT_LAYER,
    z,
    locked: false,
    points: points.map(clampCoord),
  };
}
