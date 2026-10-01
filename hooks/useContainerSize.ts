import { useEffect, useRef } from 'react';

import { useCanvasStore } from '../store/canvasStore';

/**
 * Measures the canvas container and feeds it to the store.
 *
 * Konva needs explicit pixel dimensions on the Stage — it cannot lay itself
 * out with CSS — so the container size has to be observed and passed down.
 */
export function useContainerSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const setContainer = useCanvasStore((s) => s.setContainer);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setContainer({ width, height });
      }
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [setContainer]);

  return ref;
}
