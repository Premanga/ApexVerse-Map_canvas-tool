'use client';

import { useCallback, useRef } from 'react';
import { Image as KonvaImage, Layer, Rect, Stage } from 'react-konva';

import { getMap } from '../constants/maps';
import { useContainerSize } from '../hooks/useContainerSize';
import { useMapImage } from '../hooks/useMapImage';
import { useCanvasStore } from '../store/canvasStore';

/** Trackpad pinch arrives as a wheel event with ctrlKey set, at a finer delta. */
const WHEEL_SENSITIVITY = 0.0015;
const PINCH_SENSITIVITY = 0.01;

export function MapCanvas() {
  const containerRef = useContainerSize<HTMLDivElement>();

  const mapKey = useCanvasStore((s) => s.mapKey);
  const viewport = useCanvasStore((s) => s.viewport);
  const container = useCanvasStore((s) => s.container);
  const zoom = useCanvasStore((s) => s.zoom);
  const panBy = useCanvasStore((s) => s.panBy);

  const map = getMap(mapKey);
  const { image, status } = useMapImage(map.imageUrl);

  /** Pointer id of the drag in progress, if any. */
  const dragging = useRef<number | null>(null);
  const last = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) return;

      const sensitivity = event.ctrlKey ? PINCH_SENSITIVITY : WHEEL_SENSITIVITY;
      zoom(
        { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
        Math.exp(-event.deltaY * sensitivity),
      );
    },
    [containerRef, zoom],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Secondary buttons are reserved for context actions in later steps.
      if (event.button !== 0) return;
      dragging.current = event.pointerId;
      last.current = { x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (dragging.current !== event.pointerId) return;
      panBy(event.clientX - last.current.x, event.clientY - last.current.y);
      last.current = { x: event.clientX, y: event.clientY };
    },
    [panBy],
  );

  const endDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragging.current !== event.pointerId) return;
    dragging.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full touch-none overflow-hidden bg-neutral-950"
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{ cursor: dragging.current !== null ? 'grabbing' : 'grab' }}
    >
      {container && (
        <Stage
          width={container.width}
          height={container.height}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          x={viewport.x}
          y={viewport.y}
          listening={false}
        >
          <Layer>
            {/*
              The map occupies exactly one normalized unit. Everything drawn
              in later steps shares this coordinate space, so a persisted
              point renders at its stored value with no conversion.
            */}
            {image ? (
              <KonvaImage image={image} x={0} y={0} width={1} height={1} />
            ) : (
              <Rect x={0} y={0} width={1} height={1} fill="#1c1c1c" />
            )}
          </Layer>
        </Stage>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-neutral-400">
          <p>
            Could not load the {map.displayName} map image.
            <br />
            <span className="text-neutral-500">Expected at {map.imageUrl}</span>
          </p>
        </div>
      )}
    </div>
  );
}
