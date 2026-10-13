'use client';

import { Circle, Line } from 'react-konva';

import { pathInputOf } from '../../constants/subtypes';
import type { PathDraft } from '../../store/canvasStore';
import type { ObjectStyle, Point } from '../../types';
import { PathStroke } from './PathRenderer';

const VERTEX_RADIUS_PX = 2.5;
/**
 * The last vertex is the finish target, so it is drawn to be aimed at. Only
 * drawn that way: the click that finishes is caught well outside the dot.
 */
const END_RADIUS_PX = 4;
const OUTLINE = '#0a0a0a';

interface DraftOverlayProps {
  draft: PathDraft;
  /** What the finished path will be drawn in, as the tool stands now. */
  style: ObjectStyle;
  /** Cursor in map space, or null when there is none to follow. */
  hover: Point | null;
  /** `screenUnit(viewport)` — one screen pixel in map space. */
  unit: number;
}

/**
 * The path being drawn: what is placed so far in its subtype's own style,
 * then — for a click-placed path — its vertices and a dashed segment out to
 * the cursor. A stroke has neither; the line under the pointer is the whole
 * of it.
 */
export function DraftOverlay({ draft, style, hover, unit }: DraftOverlayProps) {
  const byVertex = pathInputOf(draft.subtype) === 'vertices';
  const last = draft.points[draft.points.length - 1];

  return (
    <>
      {draft.points.length > 1 && (
        <PathStroke points={draft.points} style={style} unit={unit} listening={false} />
      )}

      {byVertex && hover && (
        <Line
          points={[last[0], last[1], hover.x, hover.y]}
          stroke={style.color}
          strokeWidth={style.strokeWidth}
          dash={[6, 6]}
          opacity={0.7}
          strokeScaleEnabled={false}
          lineCap="round"
        />
      )}

      {byVertex &&
        draft.points.map(([x, y], i) => {
          const end = i === draft.points.length - 1;
          return (
            <Circle
              key={i}
              x={x}
              y={y}
              radius={(end ? END_RADIUS_PX : VERTEX_RADIUS_PX) * unit}
              fill={end ? '#ffffff' : style.color}
              stroke={end ? style.color : OUTLINE}
              strokeWidth={end ? 2 : 1}
              strokeScaleEnabled={false}
            />
          );
        })}
    </>
  );
}
