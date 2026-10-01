import { useEffect, useState } from 'react';

type Status = 'loading' | 'ready' | 'error';

interface Result {
  image: HTMLImageElement | null;
  status: Status;
}

/**
 * Loads the map raster as an HTMLImageElement for Konva's Image node.
 *
 * `use-image` from the Konva ecosystem does roughly this, but it is a
 * dependency for twenty lines and it does not surface a distinguishable
 * error state — which matters here, because a missing map raster should
 * show a real message rather than an empty stage.
 */
export function useMapImage(src: string): Result {
  const [state, setState] = useState<Result>({ image: null, status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ image: null, status: 'loading' });

    const image = new window.Image();
    image.src = src;

    image.onload = () => {
      if (!cancelled) setState({ image, status: 'ready' });
    };
    image.onerror = () => {
      if (!cancelled) setState({ image: null, status: 'error' });
    };

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [src]);

  return state;
}
