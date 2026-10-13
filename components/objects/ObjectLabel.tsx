'use client';

import { Label, Tag, Text } from 'react-konva';

const LABEL_FONT_PX = 13;
const LABEL_GAP_PX = 6;

interface ObjectLabelProps {
  text: string;
  /** Which side of the object the tag opens on. */
  placement: 'above' | 'below';
  /** How far the object reaches from its anchor, which the tag must clear. */
  clearPx: number;
}

/**
 * An object's name: the same tag as the measure readout, the canvas's one
 * tooltip look. Laid out in screen pixels, so it belongs inside a group that
 * is counter-scaled and placed on the object's anchor.
 */
export function ObjectLabel({ text, placement, clearPx }: ObjectLabelProps) {
  return (
    <Label y={(clearPx + LABEL_GAP_PX) * (placement === 'below' ? 1 : -1)} listening={false}>
      <Tag
        fill="rgba(0,0,0,0.8)"
        cornerRadius={4}
        pointerDirection={placement === 'below' ? 'up' : 'down'}
        pointerWidth={8}
        pointerHeight={5}
      />
      <Text text={text} fontSize={LABEL_FONT_PX} fontStyle="bold" padding={5} fill="#ffffff" />
    </Label>
  );
}
