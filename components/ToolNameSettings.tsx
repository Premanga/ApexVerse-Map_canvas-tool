'use client';

import { useId } from 'react';

import { getSubtype, type SubtypeKey } from '../constants/subtypes';
import { MAX_LABEL_LENGTH } from '../lib/objects';
import { useCanvasStore } from '../store/canvasStore';
import { CAPTION } from './styles';

interface ToolNameSettingsProps {
  tool: SubtypeKey;
}

/**
 * The optional name for a tool whose subtype offers one. Mounted only while
 * that tool is active. It edits what the tool draws next, in the store —
 * never an object — so nothing already drawn changes.
 */
export function ToolNameSettings({ tool }: ToolNameSettingsProps) {
  const toolLabel = useCanvasStore((s) => s.toolLabel);
  const setToolLabel = useCanvasStore((s) => s.setToolLabel);
  const nameId = useId();

  const definition = getSubtype(tool);

  return (
    <div className="space-y-2 rounded-md bg-white/5 p-2">
      <h4 className={CAPTION}>
        {definition?.displayName ?? 'Tool'} settings
      </h4>

      <div>
        <label htmlFor={nameId} className="block text-xs text-neutral-400">
          {definition?.labelField}
        </label>
        <input
          id={nameId}
          value={toolLabel}
          maxLength={MAX_LABEL_LENGTH}
          onChange={(event) => setToolLabel(event.target.value)}
          // `FloatingControls` cancels every mouse-down so a clicked button
          // does not keep focus; for a text field that default is what
          // puts the caret in it.
          onMouseDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            // Enter is done typing, not a submit: hand the keys back to
            // the canvas, where Enter and Escape act on the path.
            if (event.key === 'Enter' || event.key === 'Escape') {
              event.currentTarget.blur();
            }
          }}
          className="mt-1 h-9 w-full min-w-0 rounded-md border border-white/10 bg-black/40 px-2 text-sm text-white outline-none focus:border-amber-300/60"
        />
        {/* The rule, said where it applies: there is no naming afterwards. */}
        <p className="mt-1 text-[10px] leading-snug text-neutral-500">
          Name it before or while drawing. Once finished, it stays as it is.
        </p>
      </div>
    </div>
  );
}
