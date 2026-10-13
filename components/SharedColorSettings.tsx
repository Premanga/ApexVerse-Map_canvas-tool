'use client';

import { useCanvasStore } from '../store/canvasStore';
import { ColorStrip } from './ColorStrip';

/**
 * One colour for every tool that has a colour to choose. Like the per-tool
 * settings it changes what is drawn next, never an object already on the
 * map — that is the properties panel's job.
 */
export function SharedColorSettings() {
  const sharedColor = useCanvasStore((s) => s.sharedColor);
  const setSharedColor = useCanvasStore((s) => s.setSharedColor);

  return (
    <ColorStrip
      color={sharedColor}
      onPick={setSharedColor}
      label="Choose a colour for every tool that has one"
    >
      <p className="text-[10px] leading-snug text-neutral-500">
        Sets the colour of every tool that has one, for what is drawn next.
      </p>
    </ColorStrip>
  );
}
