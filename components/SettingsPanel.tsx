'use client';

import { useId, useState } from 'react';

import { getSubtype } from '../constants/subtypes';
import { useCanvasStore } from '../store/canvasStore';
import { ControlIcon } from './ControlIcon';
import { SharedColorSettings } from './SharedColorSettings';
import { ToolFontSettings } from './ToolFontSettings';
import { ToolNameSettings } from './ToolNameSettings';
import { ToolStageSettings } from './ToolStageSettings';
import { ToolStyleSettings } from './ToolStyleSettings';
import { TRASH_ICON } from './icons';
import { ENTER_FROM_RIGHT, panelMotion } from './styles';

const SURFACE =
  'border border-white/10 bg-neutral-900/85 max-md:bg-neutral-900/40 shadow-lg backdrop-blur';

/**
 * The settings of the tool in hand: the shared colour if the tool draws in
 * it, then whatever else it offers — its size, stage or name — and the
 * delete-all for that tool's objects. Picking the tool itself is the rail's
 * job; nothing here does.
 *
 * Contextual, like the properties panel under it: with no tool in hand it
 * renders nothing and takes no room. These settings are for what is drawn
 * NEXT; an object already on the map is changed in the properties panel.
 *
 * Which settings a tool has is read from its registry entry, so a new tool
 * gets them by setting the same fields.
 *
 * Placed by `FloatingControls`, which owns where it sits and how far it may
 * grow. The toggle and the settings are one surface: the toggle is its fixed
 * header and the settings drop down out of it, so the toggle never moves
 * when the panel opens or closes.
 */
export function SettingsPanel() {
  const activeTool = useCanvasStore((s) => s.activeTool);
  const objects = useCanvasStore((s) => s.objects);
  const deleteSubtype = useCanvasStore((s) => s.deleteSubtype);

  // Whether the panel is open is a matter for this view alone, not the plan.
  const [open, setOpen] = useState(true);
  /** The tool whose delete-all is waiting on a second, confirming tap. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const bodyId = useId();

  const subtype = activeTool === null ? undefined : getSubtype(activeTool);
  if (activeTool === null || !subtype) return null;

  const name = subtype.displayName.toLowerCase();
  const count = objects.filter((o) => o.subtype === activeTool).length;

  return (
    // Never squeezed by the properties panel below: the column they share
    // scrolls instead.
    <div className={`flex min-w-0 shrink-0 flex-col rounded-xl p-2 ${SURFACE} ${ENTER_FROM_RIGHT}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(!open)}
        className="flex h-10 w-full shrink-0 items-center gap-2 rounded-md bg-white/10 px-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/15"
      >
        {/* Down while open, turned to point up while closed. */}
        <ControlIcon className={`transition-transform ${panelMotion(open)} ${open ? '' : 'rotate-180'}`}>
          <path d="M4 6l4 4 4-4" />
        </ControlIcon>
        <span className="truncate">{subtype.displayName} settings</span>
      </button>

      {/*
        Height is animated as a grid row going between 0fr and 1fr, which
        transitions to the content's real height — a max-height would need a
        guessed number and ease against that instead. The panel never
        scrolls itself: the column it sits in does.
      */}
      <div
        className={`grid min-h-0 transition-[grid-template-rows] ${panelMotion(open)} ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div
          id={bodyId}
          // Closed, the settings are still mounted; keep them out of the tab
          // order and away from assistive tech.
          inert={!open}
          className="min-h-0 overflow-hidden"
        >
          <div
            className={`space-y-2 pt-2 transition-[opacity,translate] ${panelMotion(open)} ${
              open ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
            }`}
          >
            {/* Only for a tool the colour reaches; for the rest it would be noise. */}
            {(subtype.styleControls || subtype.sharedColor) && <SharedColorSettings />}
            {subtype.styleControls && <ToolStyleSettings tool={activeTool} />}
            {subtype.fontSizeControl && <ToolFontSettings tool={activeTool} />}
            {subtype.stageDiametersM && <ToolStageSettings tool={activeTool} />}
            {subtype.labelField !== undefined && <ToolNameSettings tool={activeTool} />}

            {/*
              Clears this tool's objects only; the tool stays usable.
              Checked against the live count, so a confirm left open
              while the last one is removed some other way goes away.
            */}
            {confirming === activeTool && count > 0 ? (
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  // Focus lands on the safe choice, so a stray Enter cancels.
                  autoFocus
                  onClick={() => setConfirming(null)}
                  className="h-9 rounded-md bg-white/5 px-2.5 text-xs font-semibold text-neutral-100 transition-colors hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  title={`Delete every ${name} on the map`}
                  onClick={() => {
                    deleteSubtype(activeTool);
                    setConfirming(null);
                  }}
                  className="h-9 truncate rounded-md bg-red-500/15 px-2.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/25 hover:text-red-200"
                >
                  Delete {count}
                </button>
              </div>
            ) : (
              <button
                type="button"
                title={`Delete every ${name} on the map`}
                disabled={count === 0}
                onClick={() => setConfirming(activeTool)}
                className="flex h-9 w-full items-center gap-2 rounded-md bg-red-500/15 px-2.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/25 hover:text-red-200 disabled:pointer-events-none disabled:opacity-40"
              >
                <ControlIcon>
                  <path d={TRASH_ICON} />
                </ControlIcon>
                <span className="truncate">
                  Delete every {name} ({count})
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
