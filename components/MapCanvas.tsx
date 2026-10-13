'use client';

import type Konva from 'konva';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Circle, Image as KonvaImage, Layer, Rect, Stage } from 'react-konva';

import { getMap } from '../constants/maps';
import {
  drawsOnMap,
  getSubtype,
  pathInputOf,
  placesByClick,
  type SubtypeKey,
} from '../constants/subtypes';
import { useContainerSize } from '../hooks/useContainerSize';
import { useHistoryShortcuts } from '../hooks/useHistoryShortcuts';
import { useAutosave } from '../hooks/useAutosave';
import { useToolShortcuts } from '../hooks/useToolShortcuts';
import { useMapImage } from '../hooks/useMapImage';
import { useSpaceHeld } from '../hooks/useSpaceHeld';
import { clampPoint, mapToScreen, screenToMap, screenUnit } from '../lib/coords';
import { isTyping } from '../lib/keyboard';
import { isDrawable, isInteractive } from '../lib/layers';
import { anchorOf, fitRadius, regionAt, toolStyleOf } from '../lib/objects';
import { stageCentre, stageOf, stageRadius, stageReach } from '../lib/stages';
import { useCanvasStore } from '../store/canvasStore';
import type { Coord, Point, StrategyObject } from '../types';
import { ConflictBanner } from './ConflictBanner';
import { FloatingControls } from './FloatingControls';
import { GridOverlay } from './GridOverlay';
import { MeasureOverlay } from './MeasureOverlay';
import { MeasurePanel } from './MeasurePanel';
import { TextEditor } from './TextEditor';
import { ShowInterfaceButton, TopBar } from './TopBar';
import { ToolLabelPrompt } from './ToolLabelPrompt';
import { DraftOverlay } from './objects/DraftOverlay';
import { ObjectLayer, type MovePreview } from './objects/ObjectLayer';
import {
  REGION_HIT_WIDTH_PX,
  RegionShape,
  regionHandle,
} from './objects/RegionRenderer';
import { objectIdAt } from './objects/hit';
import { ENTER_FROM_BOTTOM } from './styles';

/** Trackpad pinch arrives as a wheel event with ctrlKey set, at a finer delta. */
const WHEEL_SENSITIVITY = 0.0015;
const PINCH_SENSITIVITY = 0.01;

/**
 * A press that travels further than this is a drag; one that stays within it
 * is a click. This is how tools share the left button with panning without a
 * modifier key, and every drawing tool is expected to reuse it.
 */
const CLICK_TRAVEL_PX = 4;

/**
 * While a click would put something down, a press this short that travels no
 * further than this is still a click. A hand placing things quickly is
 * already on its way to the next spot when the button comes up, and by the
 * strict rule above that press would be a pan — the thing never placed.
 */
const QUICK_PRESS_MS = 200;
const QUICK_TRAVEL_PX = 24;

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

/** Two clicks on the same object within this are a double-click. */
const DOUBLE_CLICK_MS = 400;

/**
 * A press this close to a measure point grabs it instead of the map, and a
 * click this close to a draft's last vertex finishes the path.
 */
const POINT_GRAB_PX = 12;

/**
 * A click this close to a measure point is a second click on that point — a
 * double-click's other half — and adds nothing. Far tighter than the grab
 * radius: a click anywhere else inside that still places a point, or the
 * shortest leg that could be measured would be the grab radius itself.
 */
const SAME_POINT_PX = 3;

/**
 * A freehand stroke keeps a point only once the pointer is this far from the
 * last one kept. The raw pointer stream is hundreds of points a stroke, and
 * the strategy document is size-capped.
 */
const STROKE_STEP_PX = 3;

/**
 * A region dragged out to less than this is not kept, and a resize stops at
 * it: a stray click with a region tool must not leave a dot too small to
 * see, and a circle must not be shrunk out of reach of its own handle.
 */
const MIN_REGION_RADIUS_PX = 8;

/** A region still being dragged out. Local, like the move preview. */
interface RegionDraft {
  subtype: SubtypeKey;
  at: Coord;
  radius: number;
}

interface Press {
  pointerId: number;
  startX: number;
  startY: number;
  /** The pointer-down event's timestamp. */
  startTime: number;
  lastX: number;
  lastY: number;
  /** Past the click threshold. */
  dragging: boolean;
  /** Measure point under the press, or -1 when the press is on the map. */
  pointIndex: number;
  /** Strategy object under the press, or null. A click on it selects it. */
  objectId: string | null;
  /**
   * Set when dragging this press moves that object rather than the map:
   * the object's anchor minus the press point, in map space, so the object
   * keeps its place under the pointer instead of snapping its centre to it.
   */
  grab: Point | null;
  /**
   * The path vertex this press holds, or null. With `grab` set, the drag
   * then moves that one vertex and leaves the rest of the path in place.
   */
  vertex: number | null;
  /**
   * The centre of the region this press is dragging out, or null. The
   * region does not exist until the press ends.
   */
  region: Coord | null;
  /**
   * The centre of the region whose handle this press holds, or null. The
   * drag then sets `objectId`'s radius and moves nothing.
   */
  resize: Coord | null;
  /**
   * A middle-button or space-held press. It pans whatever the mode and
   * whatever is under it, and its release is never a click.
   */
  pan: boolean;
  /**
   * This press is drawing a freehand stroke. `last` is then the screen
   * position of the last point kept, which is what decimation measures from.
   */
  stroke: boolean;
}

export function MapCanvas() {
  const containerRef = useContainerSize<HTMLDivElement>();
  useHistoryShortcuts();
  useToolShortcuts();
  useAutosave();
  const spaceHeld = useSpaceHeld();

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
  const objects = useCanvasStore((s) => s.objects);
  const selectedId = useCanvasStore((s) => s.selectedId);
  const activeTool = useCanvasStore((s) => s.activeTool);
  const selectObject = useCanvasStore((s) => s.selectObject);
  const placeObject = useCanvasStore((s) => s.placeObject);
  const moveObject = useCanvasStore((s) => s.moveObject);
  const moveObjectVertex = useCanvasStore((s) => s.moveObjectVertex);
  const deleteObject = useCanvasStore((s) => s.deleteObject);
  const namingId = useCanvasStore((s) => s.namingId);
  const naming = namingId === null ? null : objects.find((o) => o.id === namingId);
  const draft = useCanvasStore((s) => s.draft);
  const toolStyles = useCanvasStore((s) => s.toolStyles);
  const startDraft = useCanvasStore((s) => s.startDraft);
  const extendDraft = useCanvasStore((s) => s.extendDraft);
  const finishDraft = useCanvasStore((s) => s.finishDraft);
  const cancelDraft = useCanvasStore((s) => s.cancelDraft);
  const placeRegion = useCanvasStore((s) => s.placeRegion);
  const resizeObject = useCanvasStore((s) => s.resizeObject);
  const editText = useCanvasStore((s) => s.editText);
  const textDraft = useCanvasStore((s) => s.textDraft);
  const interfaceHidden = useCanvasStore((s) => s.interfaceHidden);
  const layers = useCanvasStore((s) => s.layers);
  // With a tool in hand and nowhere to put what it makes, say so: a click
  // that silently does nothing looks like a broken tool.
  const blockedLayer = useCanvasStore((s) =>
    s.activeTool !== null && !isDrawable(s.layers, s.activeLayerId)
      ? (s.layers.find((layer) => layer.id === s.activeLayerId) ?? null)
      : null,
  );
  const toolStage = useCanvasStore((s) => s.toolStage);
  /**
   * The stage before the one a staged tool is about to place, when there is
   * one, and how far from its centre the next centre may fall. That area is
   * drawn as a guide — it is where a click may land, not a zone.
   */
  const stageDiameters =
    activeTool === null ? undefined : getSubtype(activeTool)?.stageDiametersM;
  const guideFrom =
    activeTool !== null && stageDiameters && toolStage > 1
      ? stageOf(objects, activeTool, toolStage - 1)
      : null;
  const guideRadius =
    guideFrom && stageDiameters
      ? stageReach(
          guideFrom.radius,
          stageRadius(stageDiameters[toolStage - 1], getMap(mapKey)),
        )
      : 0;

  const map = getMap(mapKey);
  const { image, status } = useMapImage(map.imageUrl);

  const stageRef = useRef<Konva.Stage>(null);
  const press = useRef<Press | null>(null);
  const [dragging, setDragging] = useState(false);
  /**
   * Where the object in hand is being shown. Local, like `hover`: a drag is
   * committed to the store once, on release, so it is one move — not one
   * per frame.
   */
  const [preview, setPreview] = useState<MovePreview | null>(null);
  const [regionDraft, setRegionDraft] = useState<RegionDraft | null>(null);
  /** Object under the cursor, for its label. Local for the same reason. */
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  /**
   * The last clean click on an object. Double-clicks are paired up here
   * rather than taken from the DOM's `dblclick`, so a double-tap works the
   * same way and both clicks are known to have landed on the same object.
   */
  const lastClick = useRef<{ id: string; time: number } | null>(null);
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
   * Measure points sit on a non-listening layer, so they are hit-tested here
   * in screen space. Later points win, matching their draw order.
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

  const objectAt = useCallback(
    (clientX: number, clientY: number, hovering = false): StrategyObject | null => {
      const bounds = containerRef.current?.getBoundingClientRect();
      const stage = stageRef.current;
      if (!bounds || !stage) return null;
      const state = useCanvasStore.getState();
      // A measurement reads over the plan: its clicks land on the map even
      // on top of a marker, so a route can start from a drop.
      if (state.measureMode) return null;
      // A drawing tool owns the map the same way: a route has to be able to
      // run across a marker, a stroke to start on top of one, and a zone to
      // be drawn inside another. That is about presses, though. Between
      // paths the tool is still armed, and hovering must go on naming what
      // is under the cursor — or a path just drawn could not be read until
      // the tool was put down.
      if (drawsOnMap(state.activeTool) && !(hovering && !state.draft)) {
        return null;
      }
      const local = { x: clientX - bounds.left, y: clientY - bounds.top };
      const id = objectIdAt(stage, local);
      const found = state.objects.find((o) => o.id === id) ?? null;
      // The hit graph already leaves out a hidden layer (not drawn) and a
      // locked one (not listening). Checked again all the same: nothing on
      // either may ever be the thing a press lands on.
      const object = found && isInteractive(state.layers, found) ? found : null;
      if (object?.kind !== 'region') return object;
      // Circles nest, and the hit graph only knows which was drawn last. Of
      // the regions under the pointer, the innermost is the one meant — of
      // those that can be touched at all.
      return (
        regionAt(
          state.objects.filter((o) => isInteractive(state.layers, o)),
          state.selectedId,
          screenToMap(state.viewport, local),
          (REGION_HIT_WIDTH_PX / 2) * screenUnit(state.viewport),
        ) ?? object
      );
    },
    [containerRef],
  );

  /**
   * The end marker of the selected path under the pointer. The markers are
   * the handles, so only a path that draws them has any; and, as with a
   * whole-object move, only the selected, unlocked object gives one up.
   */
  const endVertexAt = useCallback(
    (clientX: number, clientY: number): { id: string; index: number; at: Coord } | null => {
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) return null;
      const state = useCanvasStore.getState();
      // The same modes that keep `objectAt` off the objects.
      if (state.measureMode || drawsOnMap(state.activeTool)) return null;
      const path = state.objects.find((o) => o.id === state.selectedId);
      if (path?.kind !== 'path' || path.locked || !path.style.endMarkers) return null;
      // The end first: it is drawn last, so it is the one on top.
      for (const index of [path.points.length - 1, 0]) {
        const at = path.points[index];
        if (!at) continue;
        const screen = mapToScreen(state.viewport, { x: at[0], y: at[1] });
        const distance = Math.hypot(
          clientX - bounds.left - screen.x,
          clientY - bounds.top - screen.y,
        );
        if (distance <= POINT_GRAB_PX) return { id: path.id, index, at };
      }
      return null;
    },
    [containerRef],
  );

  /**
   * The resize handle of the selected region, if the pointer is on it. As
   * with a path's ends, only the selected, unlocked object gives one up.
   */
  const regionHandleAt = useCallback(
    (clientX: number, clientY: number): { id: string; at: Coord } | null => {
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) return null;
      const state = useCanvasStore.getState();
      // Not held back by a region tool, unlike everything else on the map:
      // the region it has just drawn is left selected, and its handle is how
      // that one is sized before the next is drawn.
      if (state.measureMode || pathInputOf(state.activeTool) !== null) return null;
      const region = state.objects.find((o) => o.id === state.selectedId);
      // A stage has no handle: its radius is fixed.
      if (region?.kind !== 'region' || region.locked || region.stage !== undefined) {
        return null;
      }
      const [x, y] = regionHandle(region.at, region.radius);
      const screen = mapToScreen(state.viewport, { x, y });
      const distance = Math.hypot(
        clientX - bounds.left - screen.x,
        clientY - bounds.top - screen.y,
      );
      return distance <= POINT_GRAB_PX ? { id: region.id, at: region.at } : null;
    },
    [containerRef],
  );

  /**
   * The radius that puts a circle about `centre` through the pointer, held
   * to what keeps the circle on the map. `floor` keeps it from going under
   * the minimum, for a resize; a region being drawn is allowed to, and is
   * then discarded.
   */
  const radiusAt = useCallback(
    (centre: Coord, clientX: number, clientY: number, floor = false): number | null => {
      const point = mapPointAt(clientX, clientY);
      if (!point) return null;
      const reach = Math.hypot(point.x - centre[0], point.y - centre[1]);
      const least = floor
        ? MIN_REGION_RADIUS_PX * screenUnit(useCanvasStore.getState().viewport)
        : 0;
      return fitRadius(centre, Math.max(reach, least));
    },
    [mapPointAt],
  );

  /**
   * Where object `id`, grabbed with `grab`, belongs with the pointer here.
   * A stage goes only as far as its neighbours allow — the same function the
   * store moves it with, so the preview never shows a place it cannot keep.
   */
  const moveTarget = useCallback(
    (id: string, grab: Point, clientX: number, clientY: number): Coord | null => {
      const point = mapPointAt(clientX, clientY);
      if (!point) return null;
      const to: Coord = [point.x + grab.x, point.y + grab.y];
      const { objects: all } = useCanvasStore.getState();
      const object = all.find((o) => o.id === id);
      return object?.kind === 'region' ? stageCentre(all, object, to) : to;
    },
    [mapPointAt],
  );

  useEffect(() => {
    // Measure mode has its own meaning for Escape and Backspace, and holds
    // no selection for these to act on.
    if (measureMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const state = useCanvasStore.getState();
      if (event.key === 'Escape') {
        // The first Escape throws away the whole path in progress and leaves
        // the tool armed for another; only the next one puts the tool down.
        if (state.draft) {
          state.cancelDraft();
        } else {
          state.selectObject(null);
          state.setTool(null);
        }
      } else if (
        event.key === 'Enter' &&
        state.draft &&
        // A focused button already acts on Enter; don't finish as well.
        !(event.target instanceof HTMLButtonElement)
      ) {
        state.finishDraft();
      } else if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        state.selectedId
      ) {
        // Backspace would otherwise navigate back in some browsers.
        event.preventDefault();
        state.deleteObject(state.selectedId);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [measureMode]);

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
      // The right button is reserved for context actions in later steps.
      const middle = event.button === 1;
      if (event.button !== 0 && !middle) return;
      // A pinch gesture is more important than a pan; the two fingers are
      // deliberately spreading or closing, so don't compete with it.
      if (pinch.current) return;
      // One press at a time: a second button must not replace the first.
      if (press.current) return;
      const idle: Press = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startTime: event.timeStamp,
        lastX: event.clientX,
        lastY: event.clientY,
        dragging: false,
        pointIndex: -1,
        objectId: null,
        grab: null,
        vertex: null,
        region: null,
        resize: null,
        pan: false,
        stroke: false,
      };
      const { activeTool: tool } = useCanvasStore.getState();
      if (middle || spaceHeld) {
        // Middle-click would otherwise start the browser's autoscroll.
        event.preventDefault();
        press.current = { ...idle, pan: true };
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      if (tool && pathInputOf(tool) === 'stroke') {
        const start = mapPointAt(event.clientX, event.clientY);
        if (!start) return;
        startDraft(tool, [start.x, start.y]);
        press.current = { ...idle, stroke: true };
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      if (
        tool &&
        getSubtype(tool)?.kind === 'region' &&
        // A staged region is placed by a click, further down, not dragged out.
        drawsOnMap(tool) &&
        // The one press a region tool does not draw with: see `regionHandleAt`.
        !regionHandleAt(event.clientX, event.clientY)
      ) {
        const start = mapPointAt(event.clientX, event.clientY);
        if (!start) return;
        const centre: Coord = [start.x, start.y];
        setRegionDraft({ subtype: tool, at: centre, radius: 0 });
        press.current = { ...idle, region: centre };
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      const pointIndex = measurePointAt(event.clientX, event.clientY);
      const origin = mapPointAt(event.clientX, event.clientY);
      // Checked before the object under the press: an end marker reaches
      // past the line, and may sit on top of another marker.
      const end = pointIndex < 0 ? endVertexAt(event.clientX, event.clientY) : null;
      if (end && origin) {
        press.current = {
          ...idle,
          objectId: end.id,
          vertex: end.index,
          grab: { x: end.at[0] - origin.x, y: end.at[1] - origin.y },
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      // Before the body too: the handle sits on the edge, half over the disc.
      const handle = pointIndex < 0 ? regionHandleAt(event.clientX, event.clientY) : null;
      if (handle) {
        press.current = { ...idle, objectId: handle.id, resize: handle.at };
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      const object = pointIndex < 0 ? objectAt(event.clientX, event.clientY) : null;
      // Only an already-selected object moves. A drag that starts on any
      // other object pans, so crossing a busy map never nudges a marker.
      const movable =
        object !== null &&
        origin !== null &&
        !object.locked &&
        object.id === useCanvasStore.getState().selectedId;
      press.current = {
        ...idle,
        pointIndex,
        objectId: object?.id ?? null,
        grab: movable
          ? {
              x: anchorOf(object)[0] - origin.x,
              y: anchorOf(object)[1] - origin.y,
            }
          : null,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [
      measurePointAt,
      endVertexAt,
      regionHandleAt,
      objectAt,
      mapPointAt,
      spaceHeld,
      startDraft,
    ],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const current = press.current;
      const pressed = current !== null && current.pointerId === event.pointerId;

      if (pressed && current.region) {
        const radius = radiusAt(current.region, event.clientX, event.clientY);
        if (radius !== null) setRegionDraft((draft) => draft && { ...draft, radius });
      } else if (pressed && current.stroke) {
        if (
          Math.hypot(event.clientX - current.lastX, event.clientY - current.lastY) >=
          STROKE_STEP_PX
        ) {
          const point = mapPointAt(event.clientX, event.clientY);
          if (point) extendDraft([point.x, point.y]);
          current.lastX = event.clientX;
          current.lastY = event.clientY;
        }
      } else if (pressed) {
        if (!current.dragging) {
          const travel = Math.hypot(
            event.clientX - current.startX,
            event.clientY - current.startY,
          );
          // A pan press never places, so it gets no allowance.
          const quick =
            !current.pan &&
            (measureMode || activeTool !== null) &&
            event.timeStamp - current.startTime <= QUICK_PRESS_MS &&
            travel <= QUICK_TRAVEL_PX;
          if (travel > CLICK_TRAVEL_PX && !quick) {
            current.dragging = true;
            setDragging(true);
          }
        }
        if (current.dragging && current.pointIndex >= 0) {
          const point = mapPointAt(event.clientX, event.clientY);
          if (point) moveMeasurePoint(current.pointIndex, point);
        } else if (current.dragging && current.resize && current.objectId) {
          const radius = radiusAt(current.resize, event.clientX, event.clientY, true);
          if (radius !== null) {
            setPreview({ id: current.objectId, at: current.resize, vertex: null, radius });
          }
        } else if (current.dragging && current.grab && current.objectId) {
          const at = moveTarget(
            current.objectId,
            current.grab,
            event.clientX,
            event.clientY,
          );
          if (at) setPreview({ id: current.objectId, at, vertex: current.vertex });
        } else if (current.dragging) {
          // `last` is still the press origin on the frame the threshold is
          // crossed, so the travel spent deciding is not lost from the pan.
          panBy(event.clientX - current.lastX, event.clientY - current.lastY);
          current.lastX = event.clientX;
          current.lastY = event.clientY;
        }
      }

      // Touch only reports movement while pressed, so it never hovers; and
      // mid-press the map or an object is in hand, which is not hovering.
      if (!pressed && event.pointerType !== 'touch') {
        setHoveredId(objectAt(event.clientX, event.clientY, true)?.id ?? null);
      }

      // Only a route or a click-placed path has a leg that follows the cursor.
      if (!measureMode && pathInputOf(activeTool) !== 'vertices') return;
      // No preview leg while a point is being dragged: it would run from the
      // route's end to the point in hand.
      const grabbing = pressed && current.pointIndex >= 0;
      setHover(grabbing ? null : mapPointAt(event.clientX, event.clientY));
    },
    [
      panBy,
      moveMeasurePoint,
      measureMode,
      activeTool,
      mapPointAt,
      moveTarget,
      radiusAt,
      objectAt,
      extendDraft,
    ],
  );

  const endPress = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const current = press.current;
      if (!current || current.pointerId !== event.pointerId) return;
      press.current = null;
      setDragging(false);
      event.currentTarget.releasePointerCapture(event.pointerId);

      // Anything but a clean click on the same object breaks a double-click.
      const previousClick = lastClick.current;
      lastClick.current = null;

      if (current.stroke) {
        // A cancelled stroke is dropped, like a cancelled drag.
        if (event.type !== 'pointerup') {
          cancelDraft();
          return;
        }
        // End exactly where the pointer lifted, not up to a step short of it.
        if (event.clientX !== current.lastX || event.clientY !== current.lastY) {
          const point = mapPointAt(event.clientX, event.clientY);
          if (point) extendDraft([point.x, point.y]);
        }
        // A press that never moved left one point, which finishing discards.
        finishDraft();
        return;
      }
      if (current.region) {
        setRegionDraft(null);
        // A cancelled drag makes nothing, like a cancelled stroke.
        if (event.type !== 'pointerup') return;
        const state = useCanvasStore.getState();
        const radius = radiusAt(current.region, event.clientX, event.clientY);
        if (
          state.activeTool === null ||
          radius === null ||
          // A click, or a drag too short to have been meant.
          radius * state.viewport.scale < MIN_REGION_RADIUS_PX
        ) {
          return;
        }
        placeRegion(state.activeTool, current.region, radius);
        return;
      }
      if (current.pan) return;

      if (current.dragging && current.resize && current.objectId) {
        setPreview(null);
        // A cancelled drag leaves the region the size it was.
        if (event.type !== 'pointerup') return;
        const radius = radiusAt(current.resize, event.clientX, event.clientY, true);
        if (radius !== null) resizeObject(current.objectId, radius);
        return;
      }

      if (current.dragging && current.grab && current.objectId) {
        setPreview(null);
        // A cancelled drag leaves the object where it was.
        if (event.type !== 'pointerup') return;
        const at = moveTarget(
          current.objectId,
          current.grab,
          event.clientX,
          event.clientY,
        );
        if (!at) return;
        if (current.vertex === null) moveObject(current.objectId, at);
        else moveObjectVertex(current.objectId, current.vertex, at);
        return;
      }

      // Only a clean click acts: not a drag, not a cancelled press, and not
      // a click on an existing measure point.
      if (current.dragging) return;
      if (event.type !== 'pointerup') return;
      if (current.pointIndex >= 0) {
        // The press was near enough to grab that point, had it dragged. As a
        // click it only counts as landing on the point when it is right on it.
        const state = useCanvasStore.getState();
        const held = state.measurePoints[current.pointIndex];
        const bounds = containerRef.current?.getBoundingClientRect();
        if (!held || !bounds) return;
        const screen = mapToScreen(state.viewport, held);
        const distance = Math.hypot(
          current.startX - bounds.left - screen.x,
          current.startY - bounds.top - screen.y,
        );
        if (distance <= SAME_POINT_PX) return;
      }

      // An armed marker tool places on every click, wherever it lands. Each
      // marker it puts down sits right under the pointer, so letting that
      // marker take the next click would turn rapid placing into a select
      // and then, as a double-click, a delete. Dragging the selected marker
      // still moves it; selecting another needs the tool put down. A staged
      // region is the same: each stage is placed inside the one before.
      const placing = placesByClick(activeTool);

      if (current.objectId && !placing) {
        // The first click selects; a second on the same object deletes it —
        // or, for a note, reopens it in the editor.
        // This handler is the only thing that acts on a click, so there is
        // no map action left for the deleting click to fall through to.
        if (
          previousClick?.id === current.objectId &&
          event.timeStamp - previousClick.time <= DOUBLE_CLICK_MS
        ) {
          const again = useCanvasStore
            .getState()
            .objects.find((o) => o.id === current.objectId);
          if (again?.kind === 'text') {
            editText(again.id);
          } else {
            deleteObject(current.objectId);
            setHoveredId(null);
          }
        } else {
          lastClick.current = { id: current.objectId, time: event.timeStamp };
          selectObject(current.objectId);
        }
        return;
      }

      // Where the press began, not where it ended: a quick click may have
      // travelled, and the aim was taken when the button went down.
      const point = mapPointAt(current.startX, current.startY);
      if (!point) return;
      if (measureMode) {
        addMeasurePoint(point);
        // Touch has no hover, so seed it — otherwise the preview leg would
        // run to wherever the pointer last moved before this tap.
        setHover(point);
      } else if (activeTool && pathInputOf(activeTool) === 'vertices') {
        const state = useCanvasStore.getState();
        const last = state.draft?.points[state.draft.points.length - 1];
        if (!last) {
          startDraft(activeTool, [point.x, point.y]);
        } else if (
          // Clicking the last vertex again finishes the path. A double-click
          // is the same thing: its second click lands on the vertex its
          // first one placed.
          Math.hypot(point.x - last[0], point.y - last[1]) * state.viewport.scale <=
          POINT_GRAB_PX
        ) {
          finishDraft();
        } else {
          extendDraft([point.x, point.y]);
        }
        // Seeded for touch, as for a measured route.
        setHover(point);
      } else if (activeTool) {
        placeObject(activeTool, [point.x, point.y]);
      } else {
        selectObject(null);
      }
    },
    [
      containerRef,
      measureMode,
      activeTool,
      mapPointAt,
      moveTarget,
      radiusAt,
      addMeasurePoint,
      placeObject,
      placeRegion,
      resizeObject,
      editText,
      moveObject,
      moveObjectVertex,
      deleteObject,
      selectObject,
      startDraft,
      extendDraft,
      finishDraft,
      cancelDraft,
    ],
  );

  /** Cancel any in-progress single-finger drag when a pinch starts. */
  const handleTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (event.touches.length !== 2) return;

      // Cancel any ongoing single-finger press/drag so it does not compete
      // with the pinch gesture.
      if (press.current) {
        // A second finger mid-stroke means the first was never drawing.
        if (press.current.stroke) cancelDraft();
        setRegionDraft(null);
        event.currentTarget.releasePointerCapture(press.current.pointerId);
        press.current = null;
        setDragging(false);
        setPreview(null);
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
    [setDragging, cancelDraft],
  );

  /**
   * Two fingers on the map zoom it and move it, together, whatever tool is
   * in hand: on a phone there is no space bar or middle button to pan with,
   * and with a drawing tool armed one finger draws. The press the first
   * finger began is dropped when the second lands, so the gesture never
   * places, draws or selects anything.
   */
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

      // Only act when at least one finger has moved meaningfully, to avoid
      // jitter from sub-pixel drift.
      const move0 = Math.hypot(p0.clientX - state.x1, p0.clientY - state.y1);
      const move1 = Math.hypot(p1.clientX - state.x2, p1.clientY - state.y2);
      if (move0 < PINCH_EPSILON_PX && move1 < PINCH_EPSILON_PX) return;

      const newDist = Math.hypot(p1.clientX - p0.clientX, p1.clientY - p0.clientY);

      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) return;

      // The fingers' midpoint is what the map is held by. Carry the map as
      // far as the midpoint has travelled, then zoom about where it is now:
      // the ground under the gesture stays under it through both.
      const midX = (p0.clientX + p1.clientX) / 2;
      const midY = (p0.clientY + p1.clientY) / 2;
      panBy(midX - (state.x1 + state.x2) / 2, midY - (state.y1 + state.y2) / 2);
      zoom(
        { x: midX - bounds.left, y: midY - bounds.top },
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
    [containerRef, zoom, panBy],
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
    : spaceHeld
      ? 'grab'
      : (measureMode && !measureDone) || activeTool
        ? 'crosshair'
        : 'grab';

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-neutral-950">
      {!interfaceHidden && <TopBar />}
      {/*
        The map's area: everything below the bar, whatever else is showing.
        Panels are laid over it and never take width from it.
      */}
      <div className="relative min-h-0 flex-1">
      {/*
        The controls are a sibling of this surface, not a child, so pressing
        a button never starts a pan or places anything on the map.
      */}
      <div
        ref={containerRef}
        className="relative h-full w-full touch-none"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPress}
        onPointerCancel={endPress}
        // Autoscroll starts from the mouse event, not the pointer event.
        onMouseDown={(event) => {
          if (event.button === 1) event.preventDefault();
        }}
        onPointerLeave={() => {
          setHover(null);
          setHoveredId(null);
        }}
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
            ref={stageRef}
          >
            {/*
              The stage listens so strategy objects can be hit-tested, but
              only their layer does. The map and grid below, and the measure
              overlay above, are non-listening layers: Konva keeps no hit
              graph for them, so they can never swallow a click.
            */}
            <Layer listening={false}>
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
            </Layer>
            <Layer>
              <ObjectLayer
                objects={objects}
                layers={layers}
                viewport={viewport}
                selectedId={selectedId}
                hoveredId={hoveredId}
                preview={preview}
                hiddenId={textDraft?.id ?? null}
              />
            </Layer>
            <Layer listening={false}>
              {guideFrom && (
                <Circle
                  x={guideFrom.at[0]}
                  y={guideFrom.at[1]}
                  radius={guideRadius}
                  stroke="#fbbf24"
                  strokeWidth={1.5}
                  dash={[6, 6]}
                  strokeScaleEnabled={false}
                  fill="rgba(251,191,36,0.08)"
                />
              )}
              {regionDraft && (
                <RegionShape
                  at={regionDraft.at}
                  radius={regionDraft.radius}
                  style={toolStyleOf(regionDraft.subtype, toolStyles[regionDraft.subtype])}
                />
              )}
              {draft && (
                <DraftOverlay
                  draft={draft}
                  style={toolStyleOf(draft.subtype, toolStyles[draft.subtype])}
                  hover={hover}
                  unit={screenUnit(viewport)}
                />
              )}
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
      {naming && <ToolLabelPrompt key={naming.id} subtype={naming.subtype} />}
      {textDraft && <TextEditor key={textDraft.id} note={textDraft} />}
      {interfaceHidden ? <ShowInterfaceButton /> : <FloatingControls />}
      <ConflictBanner />
      {blockedLayer && (
        <p
          role="status"
          className={`pointer-events-none absolute bottom-4 left-1/2 w-[min(22rem,calc(100%-2rem))] -translate-x-1/2 rounded-lg border border-amber-300/40 bg-neutral-900/90 px-3 py-2 text-center text-xs text-amber-200 shadow-lg backdrop-blur ${ENTER_FROM_BOTTOM}`}
        >
          “{blockedLayer.name}” is {blockedLayer.visible ? 'locked' : 'hidden'}, so nothing can
          be drawn on it. {blockedLayer.visible ? 'Unlock' : 'Show'} it, or make another layer
          active.
        </p>
      )}
      </div>
    </div>
  );
}
