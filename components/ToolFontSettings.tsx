'use client';

import { getSubtype, type SubtypeKey } from '../constants/subtypes';
import { toolStyleOf } from '../lib/objects';
import {
  DEFAULT_NOTE_FONT_SIZE,
  MAX_NOTE_FONT_PX,
  MIN_NOTE_FONT_PX,
  noteFontSizeToPx,
  notePxToFontSize,
} from '../lib/text';
import { useCanvasStore } from '../store/canvasStore';
import { FIELD_GUARDS } from './ColorPicker';
import { Slider } from './Slider';
import { CAPTION } from './styles';

interface ToolFontSettingsProps {
  tool: SubtypeKey;
}

/**
 * Lettering size for a tool whose subtype offers the choice. Mounted only
 * while that tool is active, and it edits the tool's settings in the store —
 * never an object — so nothing already written changes.
 */
export function ToolFontSettings({ tool }: ToolFontSettingsProps) {
  const chosen = useCanvasStore((s) => s.toolStyles[tool]);
  const setToolStyle = useCanvasStore((s) => s.setToolStyle);

  const px = noteFontSizeToPx(
    toolStyleOf(tool, chosen).fontSize ?? DEFAULT_NOTE_FONT_SIZE,
  );

  return (
    <div className="space-y-2 rounded-md bg-white/5 p-2" {...FIELD_GUARDS}>
      <h4 className={CAPTION}>{getSubtype(tool)?.displayName ?? 'Tool'} settings</h4>

      <div>
        <Slider
          label="Font size"
          display={`${px} px`}
          value={px}
          min={MIN_NOTE_FONT_PX}
          max={MAX_NOTE_FONT_PX}
          step={1}
          onChange={(next) => setToolStyle(tool, { fontSize: notePxToFontSize(next) })}
        />
        {/* The number is not what a zoomed-in view will show, so say which it is. */}
        <p className="mt-1 text-[10px] leading-snug text-neutral-500">
          Size with the whole map in view. Notes grow as you zoom in.
        </p>
      </div>
    </div>
  );
}
