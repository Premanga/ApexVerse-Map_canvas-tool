'use client';

import Konva from 'konva';
import { useEffect, useRef } from 'react';
import { Arrow, Circle, Group, Line, Path } from 'react-konva';

import type { Coord, ObjectStyle, PathObject } from '../../types';
import { ObjectLabel } from './ObjectLabel';
import { OBJECT_NODE_NAME } from './hit';

/**
 * A path is a couple of pixels wide; this is the width it is hit-tested at,
 * so selecting one does not take pixel precision or a steady fingertip.
 */
const HIT_WIDTH_PX = 20;

const SELECTION_EXTRA_PX = 8;

/** An end marker's radius beyond the line's own width. */
const END_MARKER_EXTRA_PX = 3;
const END_MARKER_OUTLINE = '#0a0a0a';

/** The casing's total extra width: half of it shows on each side. */
const CASING_EXTRA_PX = 3;
const CASING_COLOR = 'rgba(10,10,10,0.75)';

/** The edge of the box an end glyph's path data is drawn on. */
const GLYPH_BOX = 16;

const flatten = (points: Coord[]) => points.flatMap(([x, y]) => [x, y]);

interface PathStrokeProps {
  points: Coord[];
  style: ObjectStyle;
  /** `screenUnit(viewport)` — one screen pixel in map space. */
  unit: number;
  listening?: boolean;
}

/**
 * The line itself, drawn entirely from `style` — colour, width, dash and
 * arrowhead are data, so no subtype is looked up or branched on here. Shared
 * with the in-progress draft, which is why it is separate from the object.
 */
export function PathStroke({ points, style, unit, listening = true }: PathStrokeProps) {
  const lineRef = useRef<Konva.Arrow>(null);
  // One whole repeat of the dash pattern: shifting by it changes nothing,
  // which is what lets the flow loop without a seam.
  const period = style.dash?.reduce((sum, n) => sum + n, 0) ?? 0;
  const flow = period > 0 ? (style.flow ?? 0) : 0;

  useEffect(() => {
    const line = lineRef.current;
    if (!line || flow <= 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Set on the node, not through props: this runs every frame, and a
    // render per frame would re-run every object on the map.
    const animation = new Konva.Animation((frame) => {
      // A falling offset is what carries the dashes towards the last vertex.
      line.dashOffset(period - (((frame?.time ?? 0) / 1000) * flow) % period);
    }, line.getLayer());
    animation.start();
    return () => {
      animation.stop();
      line.dashOffset(0);
    };
  }, [flow, period]);

  // The head is geometry, not stroke, so unlike the line's width it is in
  // map units and has to be counter-scaled by hand.
  const head = (style.arrowSize ?? 6 + style.strokeWidth * 2) * unit;
  // An arrow with neither end pointed is a plain line.
  const shape = {
    points: flatten(points),
    strokeScaleEnabled: false,
    pointerAtEnding: style.arrowEnd ?? false,
    pointerLength: head,
    pointerWidth: head,
    lineCap: 'round',
    lineJoin: 'round',
  } as const;

  const [endX, endY] = points[points.length - 1];
  const [fromX, fromY] = points[points.length - 2] ?? [endX, endY];
  const glyphScale = ((style.endGlyphSize ?? 24) / GLYPH_BOX) * unit;

  return (
    <>
      {/* The same shape, wider and dark, showing as an edge round the line. */}
      {style.casing && (
        <Arrow
          {...shape}
          stroke={CASING_COLOR}
          fill={CASING_COLOR}
          strokeWidth={style.strokeWidth + CASING_EXTRA_PX}
          listening={false}
        />
      )}
      <Arrow
        {...shape}
        ref={lineRef}
        dash={style.dash}
        stroke={style.color}
        fill={style.color}
        strokeWidth={style.strokeWidth}
        // Never narrower than the line: a broad brush stroke is all target.
        hitStrokeWidth={Math.max(HIT_WIDTH_PX, style.strokeWidth)}
        listening={listening}
      />
      {/* Centred on the last vertex and turned to face the way it arrived. */}
      {style.endGlyph && (
        <Path
          data={style.endGlyph}
          x={endX}
          y={endY}
          offsetX={GLYPH_BOX / 2}
          offsetY={GLYPH_BOX / 2}
          scaleX={glyphScale}
          scaleY={glyphScale}
          rotation={(Math.atan2(endY - fromY, endX - fromX) * 180) / Math.PI}
          fill={style.color}
          stroke={END_MARKER_OUTLINE}
          strokeWidth={1}
          strokeScaleEnabled={false}
          lineJoin="round"
          listening={listening}
        />
      )}
    </>
  );
}

interface PathRendererProps {
  object: PathObject;
  unit: number;
  selected: boolean;
  /** Which side the label tag opens on, or null to keep it hidden. */
  labelPlacement: 'above' | 'below' | null;
}

/**
 * Every `path` object, whatever its subtype. The vertices are drawn at their
 * stored positions — nothing is baked into a transform — so a later
 * per-vertex editor can put a handle on each one as it stands.
 */
export function PathRenderer({ object, unit, selected, labelPlacement }: PathRendererProps) {
  // A lone vertex has no line to draw; it cannot be created here but may
  // arrive in a document.
  if (object.points.length < 2) return null;

  return (
    <Group id={object.id} name={OBJECT_NODE_NAME}>
      {selected && (
        <Line
          points={flatten(object.points)}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={object.style.strokeWidth + SELECTION_EXTRA_PX}
          strokeScaleEnabled={false}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      )}
      <PathStroke points={object.points} style={object.style} unit={unit} />
      {/* Inside the group, so a press on a marker selects and drags the path. */}
      {object.style.endMarkers &&
        // An end glyph is the last vertex's marker, and its handle.
        (object.style.endGlyph
          ? [object.points[0]]
          : [object.points[0], object.points[object.points.length - 1]]
        ).map(([x, y], i) => (
          <Circle
            key={i}
            x={x}
            y={y}
            radius={(object.style.strokeWidth + END_MARKER_EXTRA_PX) * unit}
            fill={object.style.color}
            stroke={END_MARKER_OUTLINE}
            strokeWidth={1}
            strokeScaleEnabled={false}
          />
        ))}
      {/* At the first vertex — where the path sets off, and its anchor. */}
      {labelPlacement !== null && object.label !== '' && (
        <Group x={object.points[0][0]} y={object.points[0][1]} scaleX={unit} scaleY={unit}>
          <ObjectLabel
            text={object.label}
            placement={labelPlacement}
            clearPx={object.style.strokeWidth / 2}
          />
        </Group>
      )}
    </Group>
  );
}
