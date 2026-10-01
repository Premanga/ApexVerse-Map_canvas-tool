'use client';

import { Circle, Group, Label, Line, Tag, Text } from 'react-konva';

import {
  distanceM,
  formatDistance,
  mapToScreen,
  routeLabel,
  routeSegmentsM,
  screenUnit,
} from '../lib/coords';
import type { MapDefinition, Point, Viewport } from '../types';

const COLOR = '#facc15';
const MARKER_RADIUS_PX = 9;
const TAG_FILL = 'rgba(0,0,0,0.8)';
const TAG_FONT_PX = 12;
const TAG_PADDING_PX = 4;
const TAG_HEIGHT_PX = TAG_FONT_PX + TAG_PADDING_PX * 2;
/**
 * A leg shorter than this on screen has no room for its distance between
 * the two markers, so the label is dropped. The panel still lists it.
 */
const SEGMENT_LABEL_MIN_PX = 96;
const CURSOR_GAP_PX = 8;
/** Closer than this to the top edge, the cursor readout flips below it. */
const CURSOR_FLIP_PX = 44;

interface MeasureOverlayProps {
  map: MapDefinition;
  viewport: Viewport;
  /** The route so far, A onwards. */
  points: Point[];
  /** Cursor position while the route is still open; null once finished. */
  hover: Point | null;
}

export function MeasureOverlay({ map, viewport, points, hover }: MeasureOverlayProps) {
  if (points.length === 0) return null;

  const unit = screenUnit(viewport);
  const last = points[points.length - 1];
  const segments = routeSegmentsM(points, map);
  const below = hover !== null && mapToScreen(viewport, hover).y < CURSOR_FLIP_PX;

  return (
    <>
      {points.length > 1 && (
        <Line
          points={points.flatMap((p) => [p.x, p.y])}
          stroke={COLOR}
          strokeWidth={2}
          strokeScaleEnabled={false}
          lineCap="round"
          lineJoin="round"
        />
      )}

      {hover && (
        <Line
          points={[last.x, last.y, hover.x, hover.y]}
          stroke={COLOR}
          strokeWidth={2}
          // With stroke scaling off, Konva strokes in screen space, so the
          // dash pattern is already in pixels.
          dash={[8, 6]}
          strokeScaleEnabled={false}
          lineCap="round"
        />
      )}

      {segments.map((metres, i) => {
        const a = points[i];
        const b = points[i + 1];
        const screenLength = Math.hypot(b.x - a.x, b.y - a.y) * viewport.scale;
        if (screenLength < SEGMENT_LABEL_MIN_PX) return null;
        return (
          // A zero-size "down" pointer makes Konva anchor the label at its
          // bottom-centre; the offset then drops it to sit centred on the leg.
          <Label
            key={i}
            x={(a.x + b.x) / 2}
            y={(a.y + b.y) / 2}
            scaleX={unit}
            scaleY={unit}
            offsetY={-TAG_HEIGHT_PX / 2}
          >
            <Tag
              fill={TAG_FILL}
              cornerRadius={4}
              pointerDirection="down"
              pointerWidth={0}
              pointerHeight={0}
            />
            <Text
              text={formatDistance(metres)}
              fontSize={TAG_FONT_PX}
              fontStyle="bold"
              padding={TAG_PADDING_PX}
              fill="#ffffff"
            />
          </Label>
        );
      })}

      {points.map((p, i) => (
        <Group key={i} x={p.x} y={p.y} scaleX={unit} scaleY={unit}>
          <Circle
            radius={MARKER_RADIUS_PX}
            fill={COLOR}
            stroke="#000000"
            strokeWidth={1}
            strokeScaleEnabled={false}
          />
          <Text
            text={routeLabel(i)}
            width={MARKER_RADIUS_PX * 2}
            height={MARKER_RADIUS_PX * 2}
            offsetX={MARKER_RADIUS_PX}
            offsetY={MARKER_RADIUS_PX}
            align="center"
            verticalAlign="middle"
            fontSize={11}
            fontStyle="bold"
            fill="#000000"
          />
        </Group>
      ))}

      {hover && (
        // The provisional leg reads at the cursor: that is where the user is
        // looking while choosing the next point.
        <Label
          x={hover.x}
          y={hover.y + (below ? CURSOR_GAP_PX : -CURSOR_GAP_PX) * unit}
          scaleX={unit}
          scaleY={unit}
        >
          <Tag
            fill={TAG_FILL}
            cornerRadius={4}
            pointerDirection={below ? 'up' : 'down'}
            pointerWidth={8}
            pointerHeight={5}
          />
          <Text
            text={formatDistance(distanceM(last, hover, map))}
            fontSize={13}
            fontStyle="bold"
            padding={5}
            fill="#ffffff"
          />
        </Label>
      )}
    </>
  );
}
