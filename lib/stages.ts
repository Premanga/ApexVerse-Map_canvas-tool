import type { Coord, MapDefinition, RegionObject, StrategyObject } from '../types';
import { clampCoord } from './objects';

/**
 * Staged regions: a subtype whose objects are the steps of one fixed series
 * — the play zone's eight circles. Each step has a set radius and at most
 * one object, and the steps on the map are always an unbroken run from the
 * first. Every rule about them lives in this file.
 *
 * Nothing here says where a zone WILL be. It only refuses centres the game
 * itself could not produce.
 */

/**
 * How far a stage's centre may lie from the centre of the stage before it,
 * as a share of that earlier stage's radius.
 */
const STAGE_CENTRE_REACH = 0.5;

/**
 * The furthest the centre of a stage of `radius` may be from the centre of
 * the stage before it, of `parentRadius`. Two rules, and the stricter wins:
 *
 *  - the centre moves at most half the parent's radius:   d ≤ R / 2
 *  - the whole circle stays inside the parent:            d + r ≤ R
 *
 * so d ≤ min(R / 2, R − r). A stage may touch its parent's edge and may not
 * cross it. The second rule is not implied by the first: a stage more than
 * half its parent's size would poke out of it before its centre had moved
 * half a radius, and several of the game's stages are.
 */
export function stageReach(parentRadius: number, radius: number): number {
  return Math.max(0, Math.min(parentRadius * STAGE_CENTRE_REACH, parentRadius - radius));
}

const EPSILON = 1e-9;

interface Disc {
  centre: Coord;
  radius: number;
}

/**
 * A stage's normalized radius, from its diameter in metres. The registry
 * holds diameters because that is how the game's zone sizes are published;
 * the halving happens here and nowhere else. The map is square and one
 * normalized unit is its whole edge, so the division by that edge is the
 * entire conversion — and it holds at every zoom, because zooming scales
 * the stage and never the geometry.
 */
export function stageRadius(diameterM: number, map: MapDefinition): number {
  return diameterM / 2 / map.worldSizeM;
}

/** The object that is `stage` of `subtype`, or null when it is not placed. */
export function stageOf(
  objects: StrategyObject[],
  subtype: string,
  stage: number,
): RegionObject | null {
  for (const object of objects) {
    if (object.kind === 'region' && object.subtype === subtype && object.stage === stage) {
      return object;
    }
  }
  return null;
}

/** The first of `count` stages not yet placed, or the last when all are. */
export function nextStage(objects: StrategyObject[], subtype: string, count: number): number {
  for (let stage = 1; stage <= count; stage++) {
    if (!stageOf(objects, subtype, stage)) return stage;
  }
  return count;
}

const distance = (a: Coord, b: Coord) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const inside = (disc: Disc, point: Coord) =>
  distance(disc.centre, point) <= disc.radius + EPSILON;

/** The point of `disc` nearest `point`. */
function project(disc: Disc, point: Coord): Coord {
  const reach = distance(disc.centre, point);
  if (reach <= disc.radius) return point;
  const k = disc.radius / reach;
  return [
    disc.centre[0] + (point[0] - disc.centre[0]) * k,
    disc.centre[1] + (point[1] - disc.centre[1]) * k,
  ];
}

/** Where the edges of two discs cross: two points, or none. */
function crossings(a: Disc, b: Disc): Coord[] {
  const d = distance(a.centre, b.centre);
  if (d < EPSILON || d > a.radius + b.radius || d < Math.abs(a.radius - b.radius)) {
    return [];
  }
  const along = (a.radius ** 2 - b.radius ** 2 + d ** 2) / (2 * d);
  const off = Math.sqrt(Math.max(0, a.radius ** 2 - along ** 2));
  const ux = (b.centre[0] - a.centre[0]) / d;
  const uy = (b.centre[1] - a.centre[1]) / d;
  const mx = a.centre[0] + ux * along;
  const my = a.centre[1] + uy * along;
  return [
    [mx - uy * off, my + ux * off],
    [mx + uy * off, my - ux * off],
  ];
}

/**
 * The centre nearest `at` that the rules allow `region`, a stage, to have.
 *
 * Two limits, each a disc, either of which may be absent:
 *  - the stage before it: within `stageReach` of that stage's centre, which
 *    keeps this one's whole circle inside it;
 *  - the stage after it, already placed: the same rule read from the other
 *    side, so moving a stage can never leave the one inside it sticking out.
 *
 * Distances are compared in normalized units. That is the ground distance
 * in metres divided by the map's edge — on both sides of the comparison —
 * so it is the same test, and it never involves the screen.
 *
 * A centre outside what is allowed is not refused but brought to the nearest
 * point that is: for one disc its edge, for two the nearest point of their
 * overlap. The result is also kept on the map, which cannot undo the above:
 * both discs are centred on the map, and clamping only ever moves a point
 * towards them.
 */
export function stageCentre(
  objects: StrategyObject[],
  region: Pick<RegionObject, 'subtype' | 'stage' | 'radius'>,
  at: Coord,
): Coord {
  if (region.stage === undefined) return at;
  const before = stageOf(objects, region.subtype, region.stage - 1);
  const after = stageOf(objects, region.subtype, region.stage + 1);
  const limits: Disc[] = [];
  if (before) {
    limits.push({
      centre: before.at,
      radius: stageReach(before.radius, region.radius),
    });
  }
  if (after) {
    limits.push({
      centre: after.at,
      radius: stageReach(region.radius, after.radius),
    });
  }

  if (limits.every((limit) => inside(limit, at))) return clampCoord(at);
  if (limits.length === 1) return clampCoord(project(limits[0], at));

  const [a, b] = limits;
  const candidates = [
    ...[project(a, at)].filter((p) => inside(b, p)),
    ...[project(b, at)].filter((p) => inside(a, p)),
    ...crossings(a, b),
  ];
  // No overlap at all cannot arise from a valid plan; if a document carries
  // one, the rule from the stage before is the one kept.
  if (candidates.length === 0) return clampCoord(project(a, at));
  return clampCoord(
    candidates.reduce((best, p) => (distance(p, at) < distance(best, at) ? p : best)),
  );
}

/**
 * `objects` without any stage whose predecessors are not all there: remove
 * stage 3 and stages 4 onwards go with it, since each was only ever valid
 * relative to the one before. Returns the same array when nothing goes.
 */
export function pruneStages(objects: StrategyObject[]): StrategyObject[] {
  const placed = new Map<string, Set<number>>();
  for (const object of objects) {
    if (object.kind !== 'region' || object.stage === undefined) continue;
    const stages = placed.get(object.subtype) ?? new Set<number>();
    stages.add(object.stage);
    placed.set(object.subtype, stages);
  }
  if (placed.size === 0) return objects;
  const kept = objects.filter((object) => {
    if (object.kind !== 'region' || object.stage === undefined) return true;
    const stages = placed.get(object.subtype);
    for (let stage = 1; stage < object.stage; stage++) {
      if (!stages?.has(stage)) return false;
    }
    return true;
  });
  return kept.length === objects.length ? objects : kept;
}
