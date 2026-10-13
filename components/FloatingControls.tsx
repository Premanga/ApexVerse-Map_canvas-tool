'use client';

import { LayersPanel } from './LayersPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { SettingsPanel } from './SettingsPanel';
import { ToolRail } from './ToolRail';

/**
 * Where the floating controls sit: the tool rail half-way down the left
 * edge, and on the right a column for the two contextual panels — the
 * settings of the tool in hand, and the properties of the selected object.
 *
 * Everything here is laid OVER the map, never beside it: the map keeps the
 * whole area at every width, and a panel only ever covers a strip of its
 * edge. The right column is only as tall as what is in it, and with no tool
 * and no selection it holds nothing, so that edge is clear.
 *
 * The rail and the column are flex siblings pushed to opposite edges, so
 * they cannot overlap each other and neither needs the other's dimensions.
 * The column may shrink on a narrow view; the rail does not, and is
 * collapsible instead.
 *
 * The row spans the map but takes no pointer events itself — only the
 * controls in it do — so the map stays draggable in the space between them.
 */
export function FloatingControls() {
  return (
    <div
      className="pointer-events-none absolute inset-4 flex justify-between gap-2 max-md:top-16"
      // A mouse click must not leave focus on a control: the space bar that
      // follows is meant for panning, and a focused button would take it as
      // a press. Keyboard focus is unaffected.
      onMouseDown={(event) => event.preventDefault()}
    >
      <ToolRail />
      {/*
        `empty:hidden` matters: an empty scroll container would still take
        pointer events over its 13rem of map.
      */}
      <div className="pointer-events-auto flex max-h-full w-52 min-w-0 shrink flex-col gap-2 self-start overflow-y-auto overflow-x-hidden empty:hidden">
        <LayersPanel />
        <SettingsPanel />
        <PropertiesPanel />
      </div>
    </div>
  );
}
