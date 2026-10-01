'use client';

import { Line, Text } from 'react-konva';

import { gridLabel, screenUnit } from '../lib/coords';
import type { MapDefinition, Viewport } from '../types';

/** Below this on-screen cell size the labels are noise, not a reference. */
const LABEL_MIN_CELL_PX = 48;
const LABEL_INSET_PX = 5;
const LABEL_FONT_PX = 10;
const LABEL_OPACITY = 0.65;

const LINE_COLOR = 'rgba(255,255,255,0.28)';

interface GridOverlayProps {
  map: MapDefinition;
  viewport: Viewport;
}

/**
 * Grid lines plus a label in every cell, so a cell can still be named when
 * zoomed into a fight with the map edges off-screen.
 */
export function GridOverlay({ map, viewport }: GridOverlayProps) {
  const divisions = map.gridDivisions;
  const unit = screenUnit(viewport);
  const showLabels = viewport.scale / divisions >= LABEL_MIN_CELL_PX;

  const lines = [];
  for (let i = 0; i <= divisions; i++) {
    const pos = i / divisions;
    lines.push(
      <Line
        key={`v${i}`}
        points={[pos, 0, pos, 1]}
        stroke={LINE_COLOR}
        strokeWidth={1}
        strokeScaleEnabled={false}
      />,
      <Line
        key={`h${i}`}
        points={[0, pos, 1, pos]}
        stroke={LINE_COLOR}
        strokeWidth={1}
        strokeScaleEnabled={false}
      />,
    );
  }

  const labels = [];
  if (showLabels) {
    for (let row = 0; row < divisions; row++) {
      for (let col = 0; col < divisions; col++) {
        labels.push(
          // Counter-scaling the node, rather than shrinking fontSize to a
          // fraction of a pixel, lets the browser lay the text out at a real
          // pixel size. Offsets apply before the scale, so they are in
          // pixels too.
          <Text
            key={`${col}-${row}`}
            x={col / divisions}
            y={row / divisions}
            scaleX={unit}
            scaleY={unit}
            offsetX={-LABEL_INSET_PX}
            offsetY={-LABEL_INSET_PX}
            text={gridLabel(col, row)}
            fontSize={LABEL_FONT_PX}
            fontStyle="bold"
            opacity={LABEL_OPACITY}
            // A translucent shape with both fill and stroke otherwise goes
            // through Konva's stage-sized buffer canvas — once per label,
            // every frame of a pan.
            perfectDrawEnabled={false}
            fill="#ffffff"
            stroke="rgba(0,0,0,0.7)"
            strokeWidth={3}
            lineJoin="round"
            fillAfterStrokeEnabled
          />,
        );
      }
    }
  }

  return (
    <>
      {lines}
      {labels}
    </>
  );
}
