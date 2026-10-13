'use client';

import { Circle, Group, Label, Tag, Text } from 'react-konva';

import { withAlpha } from '../../lib/color';
import type { Coord, ObjectStyle, RegionObject } from '../../types';
import { OBJECT_NODE_NAME } from './hit';

/**
 * The ring is a couple of pixels wide; this is the width it is hit at. The
 * canvas uses it too, to tell nested regions apart.
 */
export const REGION_HIT_WIDTH_PX = 20;

const SELECTION_EXTRA_PX = 8;

const HANDLE_RADIUS_PX = 6;
const HANDLE_OUTLINE = '#0a0a0a';

/** The casing's total extra width: half of it shows on each side. */
const CASING_EXTRA_PX = 3;
const CASING_COLOR = 'rgba(10,10,10,0.75)';

const TITLE_FONT_PX = 12;
const TITLE_GAP_PX = 6;

/**
 * A titled region drawn smaller than this on screen also gets a dot on its
 * centre. The last stages of a zone are tens of metres across — a few pixels
 * with the whole map in view — and the ring is never enlarged to make up for
 * it: its size is the ground truth. The dot only says where to look.
 */
const LOCATOR_BELOW_PX = 14;
const LOCATOR_RADIUS_PX = 3;

/** Takes hits, shows nothing. */
const UNSEEN = 'rgba(0,0,0,0)';

/**
 * Where a region's one resize handle sits: due east on its edge. A circle
 * has no aspect ratio to keep, so one handle sizes it. The same point is
 * hit-tested by the canvas, which is why it is worked out here once.
 */
export function regionHandle(at: Coord, radius: number): Coord {
  return [at[0] + radius, at[1]];
}

interface RegionShapeProps {
  at: Coord;
  radius: number;
  style: ObjectStyle;
}

/**
 * The circle itself, drawn entirely from `style` — colour, width, dash, tint
 * and casing are data, so no subtype is looked up or branched on here. Shared
 * with the region still being dragged out, which is why it is separate from
 * the object. Never takes hits: the object decides what of it can be pressed.
 *
 * The radius is the stored, normalized one, and the stage transform does the
 * rest, so the circle is the same piece of ground at every zoom and pan.
 */
export function RegionShape({ at, radius, style }: RegionShapeProps) {
  return (
    <>
      {style.casing && (
        <Circle
          x={at[0]}
          y={at[1]}
          radius={radius}
          stroke={CASING_COLOR}
          strokeWidth={style.strokeWidth + CASING_EXTRA_PX}
          strokeScaleEnabled={false}
          listening={false}
        />
      )}
      <Circle
        x={at[0]}
        y={at[1]}
        radius={radius}
        stroke={style.color}
        strokeWidth={style.strokeWidth}
        strokeScaleEnabled={false}
        dash={style.dash}
        fill={style.fillOpacity ? withAlpha(style.color, style.fillOpacity) : undefined}
        listening={false}
      />
    </>
  );
}

interface RegionRendererProps {
  object: RegionObject;
  /** `screenUnit(viewport)` — one screen pixel in map space. */
  unit: number;
  selected: boolean;
  /** Shown inside the top of the ring, or null for a region with no title. */
  title: string | null;
}

/**
 * Every `region` object, whatever its subtype. Geometry is the stored centre
 * and radius — nothing is baked into a transform.
 *
 * What takes a press depends on selection. Unselected, only the ring does: a
 * zone covers a large part of the map, and its inside must stay open ground
 * for panning and for whatever stands in it. Selected, the whole disc does,
 * so the body can be dragged to move it. Where regions overlap, the canvas
 * settles which is meant — `regionAt` — rather than the draw order here.
 */
export function RegionRenderer({ object, unit, selected, title }: RegionRendererProps) {
  const { at, radius, style } = object;
  const [handleX, handleY] = regionHandle(at, radius);
  // A stage's size is fixed, so it has nothing to drag.
  const resizable = !object.locked && object.stage === undefined;

  return (
    <Group id={object.id} name={OBJECT_NODE_NAME}>
      {selected && (
        <Circle
          x={at[0]}
          y={at[1]}
          radius={radius}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={style.strokeWidth + SELECTION_EXTRA_PX}
          strokeScaleEnabled={false}
          listening={false}
        />
      )}
      <RegionShape at={at} radius={radius} style={style} />
      <Circle
        x={at[0]}
        y={at[1]}
        radius={radius}
        stroke={UNSEEN}
        strokeWidth={style.strokeWidth}
        strokeScaleEnabled={false}
        hitStrokeWidth={Math.max(REGION_HIT_WIDTH_PX, style.strokeWidth)}
        fill={selected ? UNSEEN : undefined}
      />
      {title !== null && radius < LOCATOR_BELOW_PX * unit && (
        <Circle
          x={at[0]}
          y={at[1]}
          radius={LOCATOR_RADIUS_PX * unit}
          fill={style.color}
          stroke={HANDLE_OUTLINE}
          strokeWidth={1}
          strokeScaleEnabled={false}
          listening={false}
        />
      )}
      {/* Screen-sized, like a marker's badge: a name must stay readable. */}
      {title !== null && (
        <Group
          x={at[0]}
          // The top of a large stage can lie beyond the map; its title stays on it.
          y={Math.max(0, at[1] - radius)}
          scaleX={unit}
          scaleY={unit}
          listening={false}
        >
          {/* A tag with no pointer still centres itself on the point it hangs from. */}
          <Label y={TITLE_GAP_PX}>
            <Tag
              fill="rgba(0,0,0,0.75)"
              cornerRadius={4}
              pointerDirection="up"
              pointerWidth={0}
              pointerHeight={0}
            />
            <Text
              text={title}
              fontSize={TITLE_FONT_PX}
              fontStyle="bold"
              padding={4}
              fill={style.color}
            />
          </Label>
        </Group>
      )}
      {/* Drawn only; the canvas hit-tests it in screen space, like a path's ends. */}
      {selected && resizable && (
        <Circle
          x={handleX}
          y={handleY}
          radius={HANDLE_RADIUS_PX * unit}
          fill="#ffffff"
          stroke={HANDLE_OUTLINE}
          strokeWidth={1.5}
          strokeScaleEnabled={false}
          listening={false}
        />
      )}
    </Group>
  );
}
