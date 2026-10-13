import { useEffect } from 'react';

import { toolForKey } from '../constants/tools';
import { isTyping } from '../lib/keyboard';
import { activateTool, toolDisabled } from '../lib/toolActions';
import { useCanvasStore } from '../store/canvasStore';

/**
 * Single-key tool shortcuts, read from the tools themselves: V for select,
 * D for a team drop, and so on. A key does what a click on that tool's
 * button does, through the same function.
 */
export function useToolShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // A letter typed into a field is text, not a tool.
      if (isTyping(event.target)) return;
      // With a modifier the key belongs to someone else: Ctrl+Z is undo,
      // Ctrl+R reloads the page. A held key must not flick a tool on and off.
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      const tool = toolForKey(event.key);
      if (!tool || toolDisabled(tool, useCanvasStore.getState())) return;
      event.preventDefault();
      activateTool(tool);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
