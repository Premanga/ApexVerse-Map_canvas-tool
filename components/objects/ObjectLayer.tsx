'use client';

import { useMemo } from 'react';
import { Group } from 'react-konva';

import { anchorOf, moveTo, moveVertex, resizeTo } from '../../lib/objects';
import { mapToScreen, screenUnit } from '../../lib/coords';
import type { Coord, StrategyLayer, StrategyObject, Viewport } from '../../types';
import { PathRenderer } from './PathRenderer';
import { PointRenderer } from './PointRenderer';
import { RegionRenderer } from './RegionRenderer';
import { TextRenderer } from './TextRenderer';

/** Closer than this to the top edge, an object's label opens below it. */
const LABEL_FLIP_PX = 56;

/** An object mid-drag: shown at `at`, not yet written to the store. */
export interface MovePreview {
  id: string;
  at: Coord;
  /** The one path vertex in hand, or null when the whole object is moving. */
  vertex: number | null;
  /** Set when a region's handle is in hand: it is being resized, not moved. */
  radius?: number;
}

function previewed(object: StrategyObject, preview: MovePreview): StrategyObject {
  if (preview.radius !== undefined) return resizeTo(object, preview.radius);
  return preview.vertex === null
    ? moveTo(object, preview.at)
    : moveVertex(object, preview.vertex, preview.at);
}

interface ObjectLayerProps {
  objects: StrategyObject[];
  /** The document's layers, bottom first. */
  layers: StrategyLayer[];
  viewport: Viewport;
  selectedId: string | null;
  /** Object under the cursor, whose label is shown. */
  hoveredId: string | null;
  preview: MovePreview | null;
  /** The note open in the HTML editor, which stands in for it meanwhile. */
  hiddenId: string | null;
}

interface RenderProps {
  unit: number;
  selected: boolean;
  labelPlacement: 'above' | 'below' | null;
  /** For a stage of a staged region: "Stage 3". Null for anything else. */
  title: string | null;
}

/**
 * The one dispatch from object to renderer, and it is on `kind`. A subtype
 * never appears here: what differs between tools of a kind is data in the
 * registry, read by that kind's renderer.
 */
function renderObject(
  object: StrategyObject,
  { unit, selected, labelPlacement, title }: RenderProps,
) {
  switch (object.kind) {
    case 'point':
      return (
        <PointRenderer
          key={object.id}
          object={object}
          unit={unit}
          selected={selected}
          labelPlacement={labelPlacement}
        />
      );
    case 'path':
      return (
        <PathRenderer
          key={object.id}
          object={object}
          unit={unit}
          selected={selected}
          labelPlacement={labelPlacement}
        />
      );
    case 'region':
      return (
        <RegionRenderer
          key={object.id}
          object={object}
          unit={unit}
          selected={selected}
          title={title}
        />
      );
    case 'text':
      return <TextRenderer key={object.id} object={object} selected={selected} />;
  }
}

/** Regions are areas of ground: they lie under everything that stands on it. */
const tier = (object: StrategyObject) => (object.kind === 'region' ? 0 : 1);

/**
 * Every object, layer by layer. The document's layer order is the draw
 * order — the first layer is underneath — and within a layer the regions go
 * under the rest, then `z` decides.
 *
 * A hidden layer is not drawn at all, which is also what keeps it out of
 * Konva's hit graph: what cannot be seen cannot be clicked. A locked layer
 * is drawn inside a group that does not listen, so it shows, but a press
 * goes straight through it to whatever is underneath.
 */
export function ObjectLayer({
  objects,
  layers,
  viewport,
  selectedId,
  hoveredId,
  preview,
  hiddenId,
}: ObjectLayerProps) {
  // `z` orders objects within a tier, never across the two, and never
  // across layers.
  const byLayer = useMemo(() => {
    const groups = new Map<string, StrategyObject[]>();
    for (const object of objects) {
      const group = groups.get(object.layer);
      if (group) group.push(object);
      else groups.set(object.layer, [object]);
    }
    for (const group of groups.values()) {
      group.sort((a, b) => tier(a) - tier(b) || a.z - b.z);
    }
    return groups;
  }, [objects]);
  const unit = screenUnit(viewport);

  return (
    <>
      {layers.map((layer) =>
        layer.visible ? (
          <Group key={layer.id} listening={!layer.locked}>
            {(byLayer.get(layer.id) ?? []).map((original) => {
              if (original.id === hiddenId) return null;
              // The same functions the store commits with, so the preview shows
              // exactly where the drop will land.
              const object =
                preview?.id === original.id ? previewed(original, preview) : original;
              const selected = object.id === selectedId;
              // Touch has no hover, so a selected object shows its label too:
              // tapping a marker is how its name is read on a phone.
              const labelled = selected || object.id === hoveredId;
              const [x, y] = anchorOf(object);
              const nearTop = mapToScreen(viewport, { x, y }).y < LABEL_FLIP_PX;
              return renderObject(object, {
                unit,
                selected,
                labelPlacement: labelled ? (nearTop ? 'below' : 'above') : null,
                title:
                  object.kind === 'region' && object.stage !== undefined
                    ? `Stage ${object.stage}`
                    : null,
              });
            })}
          </Group>
        ) : null,
      )}
    </>
  );
}
