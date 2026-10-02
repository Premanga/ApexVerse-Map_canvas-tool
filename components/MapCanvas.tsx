'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Image as KonvaImage, Layer, Rect, Stage } from 'react-konva';

import { getMap } from '../constants/maps';
import { useContainerSize } from '../hooks/useContainerSize';
import { useMapImage } from '../hooks/useMapImage';
import { clampPoint, mapToScreen, screenToMap } from '../lib/coords';
import { useCanvasStore } from '../store/canvasStore';
import type { Point } from '../types';
import { CanvasControls } from './CanvasControls';
import { GridOverlay } from './GridOverlay';
import { MeasureOverlay } from './MeasureOverlay';
import { MeasurePanel } from './MeasurePanel';

/** Trackpad pinch arrives as a wheel event with ctrlKey set, at a finer delta. */
const WHEEL_SENSITIVITY = 0.0015;
const PINCH_SENSITIVITY = 0.01;

/**
 * A press that travels further than this is a drag; one that stays within it
 * is a click. This is how tools share the left button with panning without a
 * modifier key, and every drawing tool is expected to reuse it.
 */
const CLICK_TRAVEL_PX = 4;

/** Minimum finger movement to register a meaningful zoom step. */
const PINCH_EPSILON_PX = 1;

/**
 * Finger state captured at touch start, used to persist across touchmove
 * events without re-rendering. Touch event handlers use refs instead of
 * state to avoid unnecessary re-renders during the gesture.
 */
interface PinchState {
  id1: number;
  id2: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  initialDist: number;
}

/** A press this close to a measure point grabs it instead of the map. */
const POINT_GRAB_PX = 12;

interface Press {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  /** Past the click threshold. */
  dragging: boolean;
  /** Measure point under the press, or -1 when the press is on the map. */
  pointIndex: number;
}

export function MapCanvas() {
  const containerRef = useContainerSize<HTMLDivElement>();

  const mapKey = useCanvasStore((s) => s.mapKey);
  const viewport = useCanvasStore((s) => s.viewport);
  const container = useCanvasStore((s) => s.container);
  const gridVisible = useCanvasStore((s) => s.gridVisible);
  const measureMode = useCanvasStore((s) => s.measureMode);
  const measurePoints = useCanvasStore((s) => s.measurePoints);
  const measureDone = useCanvasStore((s) => s.measureDone);
  const zoom = useCanvasStore((s) => s.zoom);
  const panBy = useCanvasStore((s) => s.panBy);
  const addMeasurePoint = useCanvasStore((s) => s.addMeasurePoint);
  const moveMeasurePoint = useCanvasStore((s) => s.moveMeasurePoint);

  const map = getMap(mapKey);
  const { image, status } = useMapImage(map.imageUrl);

  const press = useRef<Press | null>(null);
  const [dragging, setDragging] = useState(false);
  /** Cursor in map space. Per-frame and local to this view, so not in the store. */
  const [hover, setHover] = useState<Point | null>(null);

  /** Active two-finger pinch state, if any. */
  const pinch = useRef<PinchState | null>(null);

  const mapPointAt = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) return null;
      // Read the viewport fresh: a pan earlier in the same event has already
      // moved it past the value this render closed over.
      const { viewport: current } = useCanvasStore.getState();
      return clampPoint(
        screenToMap(current, {
          x: clientX - bounds.left,
          y: clientY - bounds.top,
        }),
      );
    },
    [containerRef],
  );

  /**
   * The stage does not listen for events, so points are hit-tested here in
   * screen space. Later points win, matching their draw order.
   */
  const measurePointAt = useCallback(
    (clientX: number, clientY: number): number => {
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) return -1;
      const state = useCanvasStore.getState();
      if (!state.measureMode) return -1;
      for (let i = state.measurePoints.length - 1; i >= 0; i--) {
        const screen = mapToScreen(state.viewport, state.measurePoints[i]);
        const distance = Math.hypot(
          clientX - bounds.left - screen.x,
          clientY - bounds.top - screen.y,
        );
        if (distance <= POINT_GRAB_PX) return i;
      }
      return -1;
    },
    [containerRef],
  );

  useEffect(() => {
    if (!measureMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const state = useCanvasStore.getState();
      if (event.key === 'Escape') {
        state.setMeasureMode(false);
      } else if (event.key === 'Backspace') {
        state.removeLastMeasurePoint();
      } else if (
        event.key === 'Enter' &&
        // A focused button already acts on Enter; don't finish as well.
        !(event.target instanceof HTMLButtonElement)
      ) {
        state.finishMeasure();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [measureMode]);

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
      // A pinch gesture is more important than a pan; the two fingers are
      // deliberately spreading or closing, so don't compete with it.
      if (pinch.current) return;
      press.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        dragging: false,
        pointIndex: measurePointAt(event.clientX, event.clientY),
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [measurePointAt],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const current = press.current;
      const pressed = current !== null && current.pointerId === event.pointerId;

      if (pressed) {
        if (
          !current.dragging &&
          Math.hypot(
            event.clientX - current.startX,
            event.clientY - current.startY,
          ) > CLICK_TRAVEL_PX
        ) {
          current.dragging = true;
          setDragging(true);
        }
        if (current.dragging && current.pointIndex >= 0) {
          const point = mapPointAt(event.clientX, event.clientY);
          if (point) moveMeasurePoint(current.pointIndex, point);
        } else if (current.dragging) {
          // `last` is still the press origin on the frame the threshold is
          // crossed, so the travel spent deciding is not lost from the pan.
          panBy(event.clientX - current.lastX, event.clientY - current.lastY);
          current.lastX = event.clientX;
          current.lastY = event.clientY;
        }
      }

      if (!measureMode) return;
      // No preview leg while a point is being dragged: it would run from the
      // route's end to the point in hand.
      const grabbing = pressed && current.pointIndex >= 0;
      setHover(grabbing ? null : mapPointAt(event.clientX, event.clientY));
    },
    [panBy, moveMeasurePoint, measureMode, mapPointAt],
  );

  const endPress = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const current = press.current;
      if (!current || current.pointerId !== event.pointerId) return;
      press.current = null;
      setDragging(false);
      event.currentTarget.releasePointerCapture(event.pointerId);

      // Only a clean click on open map places a point: not a drag, not a
      // cancelled press, and not a click on an existing point.
      if (current.dragging || current.pointIndex >= 0) return;
      if (event.type !== 'pointerup' || !measureMode) return;
      const point = mapPointAt(event.clientX, event.clientY);
      if (!point) return;
      addMeasurePoint(point);
      // Touch has no hover, so seed it — otherwise the preview leg would run
      // to wherever the pointer last moved before this tap.
      setHover(point);
    },
    [measureMode, mapPointAt, addMeasurePoint],
  );

  /** Cancel any in-progress single-finger drag when a pinch starts. */
  const handleTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (event.touches.length !== 2) return;

      // Cancel any ongoing single-finger press/drag so it does not compete
      // with the pinch gesture.
      if (press.current) {
        event.currentTarget.releasePointerCapture(press.current.pointerId);
        press.current = null;
        setDragging(false);
      }

      event.preventDefault();

      const t0 = event.touches[0];
      const t1 = event.touches[1];
      const newDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);

      pinch.current = {
        id1: t0.identifier,
        id2: t1.identifier,
        x1: t0.clientX,
        y1: t0.clientY,
        x2: t1.clientX,
        y2: t1.clientY,
        initialDist: newDist,
      };
    },
    [setDragging],
  );

  /** Smooth pinch-to-zoom while two fingers are on the map. */
  const handleTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const state = pinch.current;
      if (!state) return;
      if (event.touches.length !== 2) {
        pinch.current = null;
        return;
      }

      // Confirm both original fingers are still the active touches,
      // sorted into a stable order so distance/midpoint math is consistent.
      const touches = Array.from(event.touches);
      const matches = touches.filter(
        (t) => t.identifier === state.id1 || t.identifier === state.id2,
      );
      if (matches.length !== 2) {
        pinch.current = null;
        return;
      }
      const [p0, p1] = matches.sort((a, b) => a.identifier - b.identifier);

      // Only apply zoom when at least one finger has moved meaningfully,
      // to avoid jitter from sub-pixel drift.
      const move0 = Math.hypot(p0.clientX - state.x1, p0.clientY - state.y1);
      const move1 = Math.hypot(p1.clientX - state.x2, p1.clientY - state.y2);
      if (move0 < PINCH_EPSILON_PX && move1 < PINCH_EPSILON_PX) return;

      const newDist = Math.hypot(p1.clientX - p0.clientX, p1.clientY - p0.clientY);

      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) return;

      // Center the zoom on the midpoint between the fingers so the area
      // under the gesture stays fixed instead of drifting.
      zoom(
        {
          x: (p0.clientX + p1.clientX) / 2 - bounds.left,
          y: (p0.clientY + p1.clientY) / 2 - bounds.top,
        },
        newDist / state.initialDist,
      );

      // Roll the state forward so the next frame applies a smooth
      // incremental factor instead of compounding from the gesture's start.
      state.initialDist = newDist;
      state.x1 = p0.clientX;
      state.y1 = p0.clientY;
      state.x2 = p1.clientX;
      state.y2 = p1.clientY;

      event.preventDefault();
    },
    [containerRef, zoom],
  );

  /** End the pinch gesture when either finger lifts. */
  const handleTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      const state = pinch.current;
      if (!state) return;
      // Clear the gesture only when one of the two pinch fingers leaves.
      const lifted = Array.from(event.changedTouches).some((t) =>
        t.identifier === state.id1 || t.identifier === state.id2,
      );
      if (lifted) pinch.current = null;
    },
    [],
  );

  const cursor = dragging
    ? 'grabbing'
    : measureMode && !measureDone
      ? 'crosshair'
      : 'grab';

  return (
    <div className="relative h-full w-full overflow-hidden bg-neutral-950">
      {/*
        The controls are a sibling of this surface, not a child, so pressing
        a button never starts a pan or places a measure point.
      */}
      <div
        ref={containerRef}
        className="relative h-full w-full touch-none"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPress}
        onPointerCancel={endPress}
        onPointerLeave={() => setHover(null)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{ cursor }}
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
              {gridVisible && <GridOverlay map={map} viewport={viewport} />}
              {measureMode && (
                <MeasureOverlay
                  map={map}
                  viewport={viewport}
                  points={measurePoints}
                  hover={measureDone ? null : hover}
                />
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

      {measureMode && <MeasurePanel />}
      <CanvasControls />
    </div>
  );
}
