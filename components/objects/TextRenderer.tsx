'use client';

import { Group, Label, Tag, Text } from 'react-konva';

import {
  DEFAULT_NOTE_FONT_SIZE,
  NOTE_FONT_FAMILY,
  NOTE_FONT_WEIGHT,
  NOTE_LINE_HEIGHT,
  NOTE_PADDING_EM,
} from '../../lib/text';
import type { TextObject } from '../../types';
import { OBJECT_NODE_NAME } from './hit';

/**
 * The size the lettering is laid out at, before the group scales it down to
 * its real, normalized size. A canvas cannot set type at a fraction of a
 * pixel — the font size would be rounded away — so the type is set large and
 * the transform does the shrinking.
 */
const LAYOUT_PX = 64;

/** The dark edge round each letter, as a fraction of its height. */
const EDGE_EM = 0.14;
const EDGE_COLOR = '#0a0a0a';

interface TextRendererProps {
  object: TextObject;
  selected: boolean;
}

/**
 * Every `text` object, whatever its subtype. `at` is the top-left corner of
 * the note's box.
 *
 * Unlike every other renderer, nothing here is counter-scaled: the lettering
 * is a fixed size on the MAP, so it grows and shrinks with the zoom. See
 * `ObjectStyle.fontSize` for why.
 */
export function TextRenderer({ object, selected }: TextRendererProps) {
  const scale = (object.style.fontSize ?? DEFAULT_NOTE_FONT_SIZE) / LAYOUT_PX;

  return (
    <Group
      id={object.id}
      name={OBJECT_NODE_NAME}
      x={object.at[0]}
      y={object.at[1]}
      scaleX={scale}
      scaleY={scale}
    >
      {/* The tag sizes itself to the text, so it is the selection box. */}
      <Label>
        <Tag
          fill={selected ? 'rgba(255,255,255,0.18)' : undefined}
          stroke={selected ? '#ffffff' : undefined}
          strokeWidth={1.5}
          strokeScaleEnabled={false}
          cornerRadius={LAYOUT_PX * 0.12}
          listening={false}
        />
        {/* Hit over its whole box, not letter by letter. */}
        <Text
          text={object.content}
          fontSize={LAYOUT_PX}
          fontFamily={NOTE_FONT_FAMILY}
          fontStyle={NOTE_FONT_WEIGHT}
          lineHeight={NOTE_LINE_HEIGHT}
          padding={LAYOUT_PX * NOTE_PADDING_EM}
          fill={object.style.color}
          stroke={EDGE_COLOR}
          strokeWidth={LAYOUT_PX * EDGE_EM}
          fillAfterStrokeEnabled
          lineJoin="round"
        />
      </Label>
    </Group>
  );
}
