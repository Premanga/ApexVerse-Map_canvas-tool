import type { StrategyLayer, StrategyObject } from '../types';

/**
 * Layers: the document's own grouping of its objects. An object names its
 * layer by id; the layer says whether those objects are shown and whether
 * they can be touched. The ORDER of the layers is draw order — the first is
 * at the bottom — so nothing here stores a z of its own.
 *
 * Pure reads of that model. The store is the only thing that changes it.
 */

/** Whether objects on `layer` can be selected, moved and edited. */
const open = (layer: StrategyLayer) => layer.visible && !layer.locked;

/**
 * The ids of the layers whose objects can be interacted with. A hidden
 * layer is out as surely as a locked one: an object that cannot be seen
 * must never be the thing a click lands on.
 */
export function interactiveLayerIds(layers: StrategyLayer[]): Set<string> {
  return new Set(layers.filter(open).map((layer) => layer.id));
}

/** Whether `object` is on a layer that is shown and unlocked. */
export function isInteractive(layers: StrategyLayer[], object: StrategyObject): boolean {
  return layers.some((layer) => layer.id === object.layer && open(layer));
}

/** Whether new objects can be put on layer `id`: it exists, shows, and is unlocked. */
export function isDrawable(layers: StrategyLayer[], id: string): boolean {
  return layers.some((layer) => layer.id === id && open(layer));
}

/** How many objects each layer holds, by layer id. */
export function countByLayer(objects: StrategyObject[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const object of objects) {
    counts.set(object.layer, (counts.get(object.layer) ?? 0) + 1);
  }
  return counts;
}

/** `layers` with the one called `id` moved to position `to`, the rest in order. */
export function reorder(layers: StrategyLayer[], id: string, to: number): StrategyLayer[] {
  const from = layers.findIndex((layer) => layer.id === id);
  if (from < 0) return layers;
  const target = Math.min(layers.length - 1, Math.max(0, to));
  if (target === from) return layers;
  const next = layers.filter((layer) => layer.id !== id);
  next.splice(target, 0, layers[from]);
  return next;
}

/** The number in a name the app gave — "Layer 3" — or null for any other name. */
function autoNumber(layer: StrategyLayer): number | null {
  const match = /^Layer (\d+)$/.exec(layer.name);
  return match ? Number(match[1]) : null;
}

/**
 * A name not yet taken: "Layer 2", "Layer 3", … Counted from the layers
 * that still carry such a name, so the numbers run on from them and a layer
 * the user has named is not counted.
 */
export function nextLayerName(layers: StrategyLayer[]): string {
  const taken = new Set(layers.map((layer) => layer.name));
  let n = layers.filter((layer) => autoNumber(layer) !== null).length + 1;
  while (taken.has(`Layer ${n}`)) n++;
  return `Layer ${n}`;
}

/**
 * `layers` with the app-given names closed up to 1, 2, 3, … after one has
 * gone: delete "Layer 2" of three and "Layer 3" becomes "Layer 2". They
 * keep the order their numbers had, not their place in the stack, so a
 * reordered pair never swaps names. A name the user chose is never touched,
 * and a layer whose name does not change is the same object as before.
 */
export function renumber(layers: StrategyLayer[]): StrategyLayer[] {
  const numbered = layers
    .filter((layer) => autoNumber(layer) !== null)
    .sort((a, b) => (autoNumber(a) ?? 0) - (autoNumber(b) ?? 0));
  const names = new Map(numbered.map((layer, i) => [layer.id, `Layer ${i + 1}`]));
  return layers.map((layer) => {
    const name = names.get(layer.id);
    return name === undefined || name === layer.name ? layer : { ...layer, name };
  });
}
