/**
 * Map Canvas — public surface of the module.
 *
 * The host app should import from here only. Everything else is internal
 * and may move between steps.
 */

export { MapCanvasShell } from './components/MapCanvasShell';
export { useCanvasStore } from './store/canvasStore';
export { MAPS, DEFAULT_MAP_KEY, getMap, listMaps } from './constants/maps';
export { SUBTYPES, getSubtype, listSubtypes } from './constants/subtypes';
export type { SubtypeKey } from './constants/subtypes';
export {
  StrategyConflictError,
  StrategyNotFoundError,
  getStrategyRepository,
} from './persistence';
export type {
  StrategyChanges,
  StrategyMeta,
  StrategyRecord,
  StrategyRepository,
} from './persistence';
export type {
  Coord,
  MapDefinition,
  ObjectKind,
  ObjectPatch,
  ObjectStyle,
  PathInput,
  PathObject,
  Point,
  PointObject,
  RegionObject,
  Size,
  StrategyDocument,
  StrategyLayer,
  StrategyObject,
  StrategyView,
  SubtypeDefinition,
  TextObject,
  Viewport,
} from './types';
