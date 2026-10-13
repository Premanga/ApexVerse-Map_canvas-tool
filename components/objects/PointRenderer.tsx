'use client';

import { Circle, Group, Path } from 'react-konva';

import { getSubtype } from '../../constants/subtypes';
import type { PointObject } from '../../types';
import { ObjectLabel } from './ObjectLabel';
import { OBJECT_NODE_NAME } from './hit';

/** Used when a point's style carries no size of its own. */
export const DEFAULT_BADGE_RADIUS_PX = 11;
/** Extra grab area around the badge, so a fingertip does not have to be exact. */
const HIT_SLOP_PX = 6;
const OUTLINE = '#0a0a0a';

/** Registry icons are authored on a 16×16 box. */
const ICON_BOX_PX = 16;
const ICON_SCALE = 0.8;

const SELECTION_GAP_PX = 4;

interface PointRendererProps {
  object: PointObject;
  /** `screenUnit(viewport)` — one screen pixel in map space. */
  unit: number;
  selected: boolean;
  /** Which side the label tag opens on, or null to keep it hidden. */
  labelPlacement: 'above' | 'below' | null;
}

/**
 * Every `point` object, whatever its subtype: a badge in the object's colour
 * carrying the subtype's glyph. The group is counter-scaled, so everything
 * inside it is laid out in screen pixels and stays one size at any zoom.
 */
export function PointRenderer({
  object,
  unit,
  selected,
  labelPlacement,
}: PointRendererProps) {
  const icon = getSubtype(object.subtype)?.icon;
  const radius = object.style.size ?? DEFAULT_BADGE_RADIUS_PX;
  // The glyph keeps its share of the badge, whatever size the badge is.
  const iconScale = ICON_SCALE * (radius / DEFAULT_BADGE_RADIUS_PX);

  return (
    <Group
      id={object.id}
      name={OBJECT_NODE_NAME}
      x={object.at[0]}
      y={object.at[1]}
      scaleX={unit}
      scaleY={unit}
    >
      {selected && (
        <Circle
          radius={radius + SELECTION_GAP_PX}
          fill="rgba(255,255,255,0.18)"
          stroke="#ffffff"
          strokeWidth={2}
          strokeScaleEnabled={false}
          listening={false}
        />
      )}
      {/* The badge is the only shape that takes hits. */}
      <Circle
        radius={radius}
        fill={object.style.color}
        stroke={OUTLINE}
        strokeWidth={object.style.strokeWidth}
        strokeScaleEnabled={false}
        hitStrokeWidth={HIT_SLOP_PX * 2}
      />
      {icon && (
        <Path
          data={icon}
          x={(-ICON_BOX_PX / 2) * iconScale}
          y={(-ICON_BOX_PX / 2) * iconScale}
          scaleX={iconScale}
          scaleY={iconScale}
          stroke={OUTLINE}
          strokeWidth={1.5}
          strokeScaleEnabled={false}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      )}
      {labelPlacement !== null && object.label !== '' && (
        <ObjectLabel
          text={object.label}
          placement={labelPlacement}
          clearPx={radius}
        />
      )}
    </Group>
  );
}
