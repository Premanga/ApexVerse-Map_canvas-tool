/**
 * Map Canvas — public surface of the module.
 *
 * The host app should import from here only. Everything else is internal
 * and may move between steps.
 */

export { MapCanvasShell } from './components/MapCanvasShell';
export { useCanvasStore } from './store/canvasStore';
export { MAPS, DEFAULT_MAP_KEY, getMap, listMaps } from './constants/maps';
export type { MapDefinition, Point, Size, Viewport } from './types';
