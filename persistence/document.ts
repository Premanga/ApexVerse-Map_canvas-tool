import { MAPS } from '../constants/maps';
import { viewOf } from '../lib/coords';
import {
  SCHEMA_VERSION,
  type Size,
  type StrategyDocument,
  type StrategyLayer,
  type StrategyObject,
  type Viewport,
} from '../types';

/**
 * The canvas as a document, and the checks a document must pass to become
 * the canvas again. The document is deliberately a plain reading of the
 * store — `objects` and `layers` go in as they are — so there is no mapping
 * to get subtly wrong in one direction and not the other.
 */

/** The slice of the store a document is made from. */
export interface DocumentSource {
  mapKey: string;
  viewport: Viewport;
  /** Null before the canvas has been measured; the view is then the fit. */
  container: Size | null;
  layers: StrategyLayer[];
  objects: StrategyObject[];
}

export const DEFAULT_STRATEGY_NAME = 'Untitled strategy';

/** The whole map, centred: the view of a canvas not yet measured. */
const FIT_VIEW = { x: 0.5, y: 0.5, zoom: 1 };

/** The one layer every new strategy has, and every object starts on. */
export const DEFAULT_LAYERS: StrategyLayer[] = [
  { id: 'default', name: 'Layer 1', visible: true, locked: false },
];

/**
 * A document's layers and objects, made whole: at least one layer, every
 * layer with every field, and every object on a layer that exists. An
 * object naming no layer, or one that is gone, belongs to the first.
 *
 * On a document this build saved, all of that already holds and the very
 * same arrays come back — so loading and saving again changes nothing.
 */
export function normalizePlan(
  document: StrategyDocument,
): Pick<StrategyDocument, 'layers' | 'objects'> {
  const complete = (layer: StrategyLayer) =>
    typeof layer.visible === 'boolean' && typeof layer.locked === 'boolean';
  const layers =
    document.layers.length === 0
      ? DEFAULT_LAYERS
      : document.layers.every(complete)
        ? document.layers
        : document.layers.map((layer) => ({
            ...layer,
            // Saved before a layer could be hidden or locked: it was neither.
            visible: layer.visible ?? true,
            locked: layer.locked ?? false,
          }));
  const known = new Set(layers.map((layer) => layer.id));
  const objects = document.objects.every((object) => known.has(object.layer))
    ? document.objects
    : document.objects.map((object) =>
        known.has(object.layer) ? object : { ...object, layer: layers[0].id },
      );
  return { layers, objects };
}

export function serializeDocument(source: DocumentSource): StrategyDocument {
  return {
    schemaVersion: SCHEMA_VERSION,
    map: source.mapKey,
    view: source.container ? viewOf(source.viewport, source.container) : FIT_VIEW,
    layers: source.layers,
    objects: source.objects,
  };
}

/**
 * Throws, with a message fit to show, for a document this build cannot
 * open. Guessing at a newer schema would show a plan that is not the one
 * that was saved, and the next autosave would then write the guess back.
 */
export function assertReadable(document: StrategyDocument): void {
  if (document.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `This strategy was saved in a newer format (schema ${String(document.schemaVersion)}) and cannot be opened here.`,
    );
  }
  if (!MAPS[document.map]) {
    throw new Error(`This strategy is drawn on a map this build does not have ("${document.map}").`);
  }
  if (!Array.isArray(document.objects) || !Array.isArray(document.layers)) {
    throw new Error('This strategy is damaged and cannot be opened.');
  }
}
