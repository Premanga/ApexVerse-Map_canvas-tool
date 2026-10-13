import { atSubtypeLimit } from '../constants/subtypes';
import type { ToolDefinition } from '../constants/tools';
import { useCanvasStore } from '../store/canvasStore';
import type { StrategyObject } from '../types';

/**
 * What picking a tool does, and how its button should look. One place, so
 * the rail's buttons and the keyboard shortcuts cannot drift apart: both
 * call `activateTool`.
 */

/** The slice of the store a tool's button is drawn from. */
export interface ToolState {
  activeTool: string | null;
  measureMode: boolean;
  gridVisible: boolean;
  objects: StrategyObject[];
}

/** Whether the tool's button shows as on. */
export function toolPressed(tool: ToolDefinition, state: ToolState): boolean {
  switch (tool.action) {
    case 'subtype':
      return state.activeTool === tool.subtype;
    // Selecting and panning is what the map does with nothing else picked.
    case 'select':
      return state.activeTool === null && !state.measureMode;
    case 'grid':
      return state.gridVisible;
    case 'measure':
      return state.measureMode;
  }
}

/** A subtype at its `maxCount` cannot be picked until one is deleted. */
export function toolDisabled(tool: ToolDefinition, state: ToolState): boolean {
  return (
    tool.action === 'subtype' &&
    tool.subtype !== undefined &&
    state.activeTool !== tool.subtype &&
    atSubtypeLimit(tool.subtype, state.objects)
  );
}

/**
 * Picks `tool`, exactly as a click on its button does. Picking the tool
 * already in hand puts it down; the grid is a switch and simply flips.
 */
export function activateTool(tool: ToolDefinition): void {
  const state = useCanvasStore.getState();
  switch (tool.action) {
    case 'subtype':
      if (tool.subtype === undefined) return;
      if (state.activeTool === tool.subtype) state.setTool(null);
      else state.requestTool(tool.subtype);
      return;
    case 'select':
      // Also leaves measure mode: one mode owns the click.
      state.setTool(null);
      return;
    case 'grid':
      state.setGridVisible(!state.gridVisible);
      return;
    case 'measure':
      state.setMeasureMode(!state.measureMode);
      return;
  }
}
