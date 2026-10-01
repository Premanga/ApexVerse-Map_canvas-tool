'use client';

import dynamic from 'next/dynamic';

/**
 * Client-only entry point for the Map Canvas.
 *
 * Konva touches `window` at module scope, so it cannot server-render. This
 * is also the seam where the share route differs: the page shell and its
 * metadata render on the server, and this mounts underneath once hydrated.
 * Import this, never MapCanvas directly.
 */
export const MapCanvasShell = dynamic(
  () => import('./MapCanvas').then((m) => m.MapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full w-full place-items-center bg-neutral-950 text-sm text-neutral-500">
        Loading map…
      </div>
    ),
  },
);
