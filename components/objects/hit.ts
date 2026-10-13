import type Konva from 'konva';

import type { Point } from '../../types';

/**
 * Every kind renderer puts this name, and the object's id, on its root node.
 * That is the whole contract between a renderer and hit detection.
 */
export const OBJECT_NODE_NAME = 'strategy-object';

/**
 * Id of the topmost strategy object under a position given in the stage
 * container's pixels, or null over open map. Uses Konva's hit graph, so the
 * hit area is whatever the kind's renderer actually drew.
 */
export function objectIdAt(stage: Konva.Stage, position: Point): string | null {
  const shape = stage.getIntersection(position);
  const root = shape?.findAncestor(`.${OBJECT_NODE_NAME}`, true);
  return root ? root.id() : null;
}
