'use client';

import { getSubtype, type SubtypeKey } from '../constants/subtypes';
import { MAX_STROKE_PX, MIN_STROKE_PX, toolStyleOf } from '../lib/objects';
import { useCanvasStore } from '../store/canvasStore';
import { FIELD_GUARDS } from './ColorPicker';
import { Slider } from './Slider';
import { CAPTION } from './styles';

interface ToolStyleSettingsProps {
  tool: SubtypeKey;
}

/**
 * Width for a tool whose subtype offers the choice; its colour comes from
 * the panel's shared colour. Mounted only while that tool is active, and it
 * edits the tool's settings in the store — never an object — so nothing
 * already drawn changes.
 */
export function ToolStyleSettings({ tool }: ToolStyleSettingsProps) {
  const chosen = useCanvasStore((s) => s.toolStyles[tool]);
  const setToolStyle = useCanvasStore((s) => s.setToolStyle);
  const { color, strokeWidth } = toolStyleOf(tool, chosen);

  const name = getSubtype(tool)?.displayName ?? 'Tool';

  return (
    <div className="space-y-2 rounded-md bg-white/5 p-2" {...FIELD_GUARDS}>
      <h4 className={CAPTION}>{name} settings</h4>

      <div className="flex items-center gap-2">
        {/*
          The brush as it will land on the map: this colour, this many pixels
          across. Strokes hold their width on screen at any zoom, so the dot
          is true to size whatever the view.
        */}
        <div
          title="Brush preview"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-white/10 bg-neutral-700"
        >
          <span
            className="block rounded-full"
            style={{ width: strokeWidth, height: strokeWidth, backgroundColor: color }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <Slider
            label="Brush size"
            display={`${strokeWidth} px`}
            value={strokeWidth}
            min={MIN_STROKE_PX}
            max={MAX_STROKE_PX}
            step={1}
            onChange={(next) => setToolStyle(tool, { strokeWidth: next })}
          />
        </div>
      </div>
    </div>
  );
}
