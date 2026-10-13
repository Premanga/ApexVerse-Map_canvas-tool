import { useEffect } from 'react';

import { isTyping } from '../lib/keyboard';
import { useCanvasStore } from '../store/canvasStore';

/**
 * Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z and Ctrl+Y redo. Active in every
 * mode — the plan can be undone while measuring over it.
 */
export function useHistoryShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // A field has its own undo stack for its text; leave the keys to it.
      if (isTyping(event.target)) return;
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      // Shift and Caps Lock both report an upper-case key.
      const key = event.key.toLowerCase();
      const state = useCanvasStore.getState();
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
      } else if (key === 'y' && event.ctrlKey && !event.shiftKey) {
        // Ctrl only: Cmd+Y is the browser's history shortcut on macOS.
        event.preventDefault();
        state.redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
