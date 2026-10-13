import { useEffect } from 'react';

import { noteCanvasChange, restoreLastOpen } from '../lib/strategySession';
import { useCanvasStore } from '../store/canvasStore';
import { useStrategyStore } from '../store/strategyStore';

/**
 * Keeps the open strategy saved: reopens the one last worked on, saves a
 * moment after the canvas stops changing, and warns before the page is left
 * with anything unsaved. Mounted once, by the canvas.
 */
export function useAutosave(): void {
  useEffect(() => {
    void restoreLastOpen();
    // Fires for every store change, pans included; telling whether the
    // change is one to save is a few reference comparisons.
    const unsubscribe = useCanvasStore.subscribe(noteCanvasChange);

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      // `saved` is the only state with nothing to lose: a conflict or a
      // failed save is unsaved work too.
      if (useStrategyStore.getState().saveState === 'saved') return;
      event.preventDefault();
      // Chrome shows its prompt only when this is set.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      unsubscribe();
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);
}
