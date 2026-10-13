'use client';

import { useState } from 'react';

import { getSubtype } from '../constants/subtypes';
import { listToolGroups, type ToolDefinition } from '../constants/tools';
import { activateTool, toolDisabled, toolPressed } from '../lib/toolActions';
import { useCanvasStore } from '../store/canvasStore';
import { CanvasControls } from './CanvasControls';
import { RailButton } from './RailButton';
import { CAPTION, ENTER_FADE } from './styles';

const STORAGE_KEY = 'map-canvas.rail.collapsed';

/**
 * Read once, as the rail mounts. That is safe without a hydration step: the
 * whole canvas sits behind `MapCanvasShell`'s `ssr: false`, so this never
 * runs on the server and there is no server markup to disagree with.
 * Storage can be refused outright (private windows), hence the guard.
 */
function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(collapsed));
  } catch {
    // The preference simply does not outlive the page.
  }
}

/** Why a tool cannot be picked, for its tooltip. */
function limitNote(tool: ToolDefinition): string | undefined {
  const max = tool.subtype === undefined ? undefined : getSubtype(tool.subtype)?.maxCount;
  return max === undefined
    ? undefined
    : `${tool.label} — limit of ${max} reached. Delete one to add another.`;
}

/**
 * The tool rail: every tool, view aid and map control in one column on the
 * left edge. Its groups and buttons come from `listToolGroups`, which reads
 * the subtype registry — nothing here names a tool, so registering a subtype
 * is all it takes for it to appear.
 *
 * Open, it writes each tool's name and key beside its icon under group
 * headings. Closed, it is icons only, two to a row: a single column of every
 * button would be taller than a laptop screen. On a phone it is that single
 * column all the same — width is what is scarce there — with a rule between
 * groups, and it scrolls. Tooltips and shortcuts are the same either way.
 *
 * Placed by `FloatingControls`; this component only sizes itself within
 * that, and scrolls if the viewport is too short for it.
 */
export function ToolRail() {
  const activeTool = useCanvasStore((s) => s.activeTool);
  const measureMode = useCanvasStore((s) => s.measureMode);
  const gridVisible = useCanvasStore((s) => s.gridVisible);
  const objects = useCanvasStore((s) => s.objects);
  const state = { activeTool, measureMode, gridVisible, objects };

  // Whether the rail is open is a matter for this view alone, not the plan.
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const expanded = !collapsed;

  return (
    <nav
      aria-label="Map tools"
      className={`pointer-events-auto flex max-h-full shrink-0 flex-col gap-1.5 self-center overflow-y-auto overflow-x-hidden rounded-xl border border-white/10 bg-neutral-900/85 p-1.5 shadow-lg backdrop-blur transition-[width] duration-[220ms] ease-out motion-reduce:transition-none ${
        // Closed on a phone it is a strip of icons over the map, and is let
        // through further still: about three quarters of the map shows.
        expanded
          ? 'w-48 max-md:bg-neutral-900/40'
          : 'w-[4.75rem] max-md:w-[2.875rem] max-md:bg-neutral-900/25'
      }`}
    >
      <RailButton
        label={expanded ? 'Collapse tools' : 'Expand tools'}
        showLabel={expanded}
        onClick={() => {
          setCollapsed(expanded);
          writeCollapsed(expanded);
        }}
      >
        {/* Points the way the rail will go: in while open, out while closed. */}
        <path d={expanded ? 'M9.5 4l-4 4 4 4' : 'M6.5 4l4 4-4 4'} />
      </RailButton>

      {listToolGroups().map((group) => (
        <section key={group.key} aria-label={group.title}>
          {/* A heading is text, never a control: it cannot pick a tool. */}
          {expanded ? (
            <h3 className={`border-t border-white/10 px-2 pb-0.5 pt-1.5 ${CAPTION} ${ENTER_FADE}`}>
              {group.title}
            </h3>
          ) : (
            <div className="mb-1.5 border-t border-white/10" />
          )}
          <div className={expanded ? 'space-y-0.5' : 'grid grid-cols-2 gap-1 max-md:grid-cols-1'}>
            {group.tools.map((tool) => {
              const disabled = toolDisabled(tool, state);
              return (
                <RailButton
                  key={tool.id}
                  label={tool.label}
                  shortcut={tool.shortcut}
                  title={disabled ? limitNote(tool) : undefined}
                  pressed={toolPressed(tool, state)}
                  disabled={disabled}
                  showLabel={expanded}
                  onClick={() => activateTool(tool)}
                >
                  <path d={tool.icon} />
                </RailButton>
              );
            })}
          </div>
        </section>
      ))}

      <section aria-label="Map controls">
        {expanded ? (
          <h3 className={`border-t border-white/10 px-2 pb-0.5 pt-1.5 ${CAPTION} ${ENTER_FADE}`}>
            Map controls
          </h3>
        ) : (
          <div className="mb-1.5 border-t border-white/10" />
        )}
        <CanvasControls expanded={expanded} />
      </section>
    </nav>
  );
}
