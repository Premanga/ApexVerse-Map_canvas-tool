import type { MapDefinition } from '../types';

/**
 * Map registry.
 *
 * Deliberately a frontend constant rather than a database table: one map,
 * static reference data, zero writes. `bgmi.map` already exists and is
 * Python-owned, so reading it here would cross a module boundary and
 * copying it would create a second source of truth. If map metadata ever
 * needs to be shared server-side, expose `bgmi.map` through a service
 * interface — do not duplicate it into the Map Canvas schema.
 */

export const MAPS: Record<string, MapDefinition> = {
  erangel: {
    key: 'erangel',
    displayName: 'Erangel',
    imageUrl: '/maps/bgmi/Erangel.png',
    imagePx: { width: 4096, height: 4096 },
    // Every reported distance is this number times a normalized delta.
    worldSizeM: 8000,
    gridDivisions: 8,
  },
};

export const DEFAULT_MAP_KEY = 'erangel';

export function getMap(key: string): MapDefinition {
  const map = MAPS[key];
  if (!map) {
    throw new Error(`Unknown map key: ${key}`);
  }
  return map;
}

export function listMaps(): MapDefinition[] {
  return Object.values(MAPS);
}
