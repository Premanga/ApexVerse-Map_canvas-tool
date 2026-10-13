import { create } from 'zustand';

import {
  DEFAULT_LAYERS,
  DEFAULT_STRATEGY_NAME,
  assertReadable,
  normalizePlan,
} from '../persistence/document';
import { newId } from '../lib/id';
import {
  interactiveLayerIds,
  isDrawable,
  isInteractive,
  nextLayerName,
  renumber,
  reorder,
} from '../lib/layers';
import type {
  Coord,
  ObjectPatch,
  ObjectStyle,
  Point,
  Size,
  StrategyDocument,
  StrategyLayer,
  StrategyObject,
  StrategyView,
  TextObject,
  ToolStyle,
  Viewport,
} from '../types';
import { parseHex } from '../lib/color';
import { nextStage, pruneStages, stageCentre, stageOf, stageRadius } from '../lib/stages';
import { MAX_NOTE_FONT_PX, MIN_NOTE_FONT_PX, notePxToFontSize } from '../lib/text';
import { DEFAULT_MAP_KEY, getMap } from '../constants/maps';
import {
  atSubtypeLimit,
  getSubtype,
  listSubtypes,
  type SubtypeKey,
} from '../constants/subtypes';
import { clampViewport, fitViewport, viewportOf, zoomAt } from '../lib/coords';
import {
  emptyHistory,
  record,
  redo as redoStep,
  undo as undoStep,
  type History,
} from '../lib/history';
import {
  MAX_LABEL_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_STROKE_PX,
  MIN_STROKE_PX,
  clampCoord,
  clampObject,
  createPath,
  createPoint,
  createRegion,
  createText,
  duplicateOf,
  moveTo,
  moveVertex,
  nextZ,
  patchObject,
  resizeTo,
  toolStyleOf,
} from '../lib/objects';

/**
 * Canvas store — map selection, viewport, the strategy objects with their
 * selection and active tool, and the view-only aids (grid, measure).
 *
 * The viewport lives in the store rather than in Konva's own stage state so
 * that non-canvas UI (zoom buttons, a minimap, the grid overlay) reads one
 * value instead of reaching into the stage ref.
 */

/**
 * A path still being drawn. Not a strategy object until it is finished: it
 * is in neither `objects` nor the history, which is what makes the finished
 * path a single undo step however many vertices went into it.
 */
export interface PathDraft {
  subtype: SubtypeKey;
  points: Coord[];
}

interface CanvasState {
  mapKey: string;
  viewport: Viewport;
  /** Null until the container has been measured. */
  container: Size | null;
  gridVisible: boolean;
  measureMode: boolean;
  /**
   * The measured route, A onwards, at most MAX_MEASURE_POINTS normalized
   * points. A measurement is a transient reading, not a strategy object —
   * it is never persisted. Distances are derived from these on render.
   */
  measurePoints: Point[];
  /** A finished route takes no more points until it is cleared or undone. */
  measureDone: boolean;
  /** The strategy document's contents. Written only by `commit`, below. */
  objects: StrategyObject[];
  /**
   * Earlier and undone states of the plan — `objects` and `layers` together
   * — and of nothing else: undo never moves the camera, the selection or
   * the mode. Session-only — it is not
   * part of the strategy document, and loading a document must start it
   * empty rather than restore it.
   */
  history: History<Plan>;
  selectedId: string | null;
  /** The subtype a click on open map places. Null is pan mode. */
  activeTool: SubtypeKey | null;
  /**
   * The point just placed whose name is still on offer. It is already in
   * the plan: ignoring the question leaves it saved, unnamed.
   */
  namingId: string | null;
  /**
   * The note open in the editor, carrying the text as typed so far. For a
   * new note this is all there is of it — like a draft it is in neither
   * `objects` nor the history until it is committed. For an existing one it
   * is a working copy, and `objects` keeps the text as it was. Either way a
   * whole edit is one undo step and its keystrokes are none.
   *
   * While it is set the viewport is locked: the editor is an HTML field laid
   * over the canvas, and must not be left behind by a pan or a zoom.
   */
  textDraft: TextObject | null;
  /**
   * Which stage a staged tool's next click places, counted from 1. Set to
   * the first stage still missing when such a tool is picked, and moved on
   * by each new placement.
   */
  toolStage: number;
  /** The name the active tool's next path will carry. */
  toolLabel: string;
  /** Dropped whenever the tool changes, so it never outlives its tool. */
  draft: PathDraft | null;
  /**
   * The colour and width chosen for each tool that offers the choice. A
   * preference for what is drawn next, not part of the document: an object
   * copies it when it is created and never reads it again. Unlike the rest
   * of the tool state it outlives the tool, so picking the tool again finds
   * its settings as they were left.
   */
  toolStyles: Partial<Record<SubtypeKey, ToolStyle>>;
  /**
   * The colour last set for all tools at once. Only what the shared picker
   * shows: each tool draws from `toolStyles`, which may have moved on since.
   */
  sharedColor: string;
  /**
   * What the plan is called. Session-only for now: it becomes part of what
   * is saved when persistence arrives, and is not in the undo history.
   */
  strategyName: string;
  /**
   * Every panel and bar put away, leaving the map alone on screen. A matter
   * for the view, like the grid; the plan and the tool in hand are untouched.
   */
  interfaceHidden: boolean;
  /**
   * The document's layers, bottom first: their order is draw order. Part of
   * the plan like `objects` — saved with it, and undone with it — so a
   * layer's visibility and lock are the author's, not this sitting's.
   * Never empty. Written only by `commit`, below.
   */
  layers: StrategyLayer[];
  /**
   * The layer new objects are put on. A matter for the sitting, not the
   * document. Always names a layer that exists; if that layer is hidden or
   * locked, nothing can be drawn until it is not, or another is chosen.
   */
  activeLayerId: string;
  /** Whether the layers panel is showing. View state only. */
  layersPanelOpen: boolean;
  /**
   * The view of a document loaded before the canvas had a size to show it
   * in. Applied, once, when the container is first measured.
   */
  pendingView: StrategyView | null;

  /**
   * Replaces the whole canvas with `document`, under `title`. Whatever was
   * on it is gone, and so is everything that belonged to the sitting: the
   * undo history starts empty — it is never part of a document — and the
   * selection, the tool in hand and any measurement are dropped. Throws,
   * changing nothing, for a document this build cannot read.
   */
  loadDocument: (document: StrategyDocument, title: string) => void;
  /** An empty, untitled strategy on the current map, as at first launch. */
  resetDocument: () => void;

  setLayersPanelOpen: (open: boolean) => void;
  /** Ignored for a layer that does not exist. */
  setActiveLayer: (id: string) => void;
  /**
   * Each of the following is one undo step — a delete included, however
   * many objects go with the layer.
   */
  /** Adds an empty layer on top and makes it the active one. */
  addLayer: () => void;
  /** Ignored for a blank name. */
  renameLayer: (id: string, name: string) => void;
  setLayerVisible: (id: string, visible: boolean) => void;
  setLayerLocked: (id: string, locked: boolean) => void;
  /** Moves a layer to position `to`, counted from the bottom. */
  moveLayer: (id: string, to: number) => void;
  /**
   * Deletes a layer AND every object on it. Ignored for the last layer
   * left: a document always has one.
   */
  deleteLayer: (id: string) => void;
  /** Puts an object on another layer. Ignored for a layer that does not exist. */
  moveObjectToLayer: (objectId: string, layerId: string) => void;

  setStrategyName: (name: string) => void;
  setInterfaceHidden: (hidden: boolean) => void;
  setMap: (mapKey: string) => void;
  /** Called by the ResizeObserver. Re-fits on first measure, clamps after. */
  setContainer: (container: Size) => void;
  zoom: (anchor: Point, factor: number) => void;
  panBy: (dx: number, dy: number) => void;
  fit: () => void;
  setGridVisible: (visible: boolean) => void;
  /**
   * Entering and leaving both discard the current measurement. Entering
   * also drops the tool and the selection: one mode owns the click.
   */
  setMeasureMode: (active: boolean) => void;
  /** Ignored once the route is finished; the last allowed point finishes it. */
  addMeasurePoint: (point: Point) => void;
  moveMeasurePoint: (index: number, point: Point) => void;
  /** Also reopens a finished route, so the removed point can be re-placed. */
  removeLastMeasurePoint: () => void;
  /** Needs at least two points — one point is not a measurement. */
  finishMeasure: () => void;
  clearMeasure: () => void;
  /**
   * Choosing a tool leaves measure mode and drops whatever the previous one
   * left half-made: a draft, or a note still open.
   */
  setTool: (tool: SubtypeKey | null) => void;
  /** Picks a tool. Ignored for a subtype already at its `maxCount`. */
  requestTool: (tool: SubtypeKey) => void;
  /**
   * Types into the name of the point `namingId` holds. However many
   * keystrokes it takes, the name is one undo step: they share a gesture,
   * which `settleNaming` closes.
   */
  nameObject: (label: string) => void;
  /** Trims the name typed so far and records it. The question stays open. */
  settleNaming: () => void;
  /** Settles the name and stops asking. The tool stays as it is. */
  endNaming: () => void;
  /**
   * Changes what `tool` draws next, as far as its subtype offers the
   * choice: width with style controls, lettering size with a font size
   * control. The rest of the patch is ignored — colour is set for all tools
   * at once, by `setSharedColor` — and a width or a size is brought into
   * the allowed range. Objects already drawn are untouched.
   */
  setToolStyle: (tool: SubtypeKey, patch: Partial<Omit<ToolStyle, 'color'>>) => void;
  /**
   * Sets the colour every tool with a colour choice draws next, leaving
   * their widths alone. Ignored unless `color` is a hex colour.
   */
  setSharedColor: (color: string) => void;
  /**
   * Sets the name the active tool's next object will carry. Ignored unless
   * that tool's subtype has an optional label field.
   */
  setToolLabel: (label: string) => void;
  selectObject: (id: string | null) => void;
  /**
   * Places a new object of `subtype` from a single click. A text kind opens
   * empty in the editor, as `textDraft`. A point is added and selected at
   * once, and one with a label prompt is then offered a name through
   * `namingId`. The
   * placement that fills a subtype's `maxCount` puts the tool down. Only
   * point and text kinds can be placed this way; the other kinds need a
   * gesture and have their own entry points.
   */
  placeObject: (subtype: SubtypeKey, at: Coord) => void;
  /**
   * Adds a region of `subtype`, `radius` about `at`, as one object and one
   * undo step, and leaves it selected with its handle in reach. The tool
   * stays armed for the next, until its subtype's `maxCount` is reached.
   * Ignored unless `subtype` is a region.
   */
  placeRegion: (subtype: SubtypeKey, at: Coord, radius: number) => void;
  /** Picks the stage a staged tool places next. Held to the stages it has. */
  setToolStage: (stage: number) => void;
  /**
   * Puts stage `toolStage` of `subtype` at `at`, or — the rules allowing no
   * centre there — at the nearest point they do allow. A stage already on
   * the map is moved rather than made twice. Ignored while the stage before
   * it is not placed. One undo step either way; a new stage moves
   * `toolStage` on to the next. Ignored unless `subtype` is staged.
   */
  placeStage: (subtype: SubtypeKey, at: Coord) => void;
  /** Opens an existing note in the editor. Ignored for a locked one. */
  editText: (id: string) => void;
  /** Types into the open note. Not an undo step. */
  setTextContent: (content: string) => void;
  /**
   * Closes the editor and keeps what was typed, as one undo step. A new
   * note left blank is dropped without a trace; an existing one emptied is
   * deleted. With `id`, ignored unless that is the note open — a field that
   * has since been replaced must not commit its successor.
   */
  commitText: (id?: string) => void;
  /** Closes the editor and keeps nothing: a new note never existed. */
  cancelText: () => void;
  /** Opens a draft at its first vertex. Ignored unless `subtype` is a path. */
  startDraft: (subtype: SubtypeKey, at: Coord) => void;
  /**
   * Appends a vertex to the open draft, and finishes it if that vertex is
   * the last its subtype allows.
   */
  extendDraft: (at: Coord) => void;
  /**
   * Closes the draft and adds it as one object. A draft with fewer than two
   * vertices is not a path and is discarded instead. A subtype with a vertex
   * cap makes one path per activation, so adding its path puts the tool down.
   */
  finishDraft: () => void;
  cancelDraft: () => void;
  updateObject: (id: string, patch: ObjectPatch) => void;
  /**
   * Moves the object's anchor to `to` — for a stage, to the nearest point
   * to it that its neighbours allow. Ignored for a locked object.
   */
  moveObject: (id: string, to: Coord) => void;
  /**
   * Moves one vertex of a path to `to`, leaving the others in place. Ignored
   * for a locked object and for any kind but a path.
   */
  moveObjectVertex: (id: string, index: number, to: Coord) => void;
  /**
   * Sets a region's radius, as far as the map allows. Ignored for a locked
   * object and for any kind but a region.
   */
  resizeObject: (id: string, radius: number) => void;
  /**
   * Merges `patch` into an object's style. Like every edit it is one undo
   * step, or part of one inside a gesture — which is how a slider dragged
   * across its range undoes in one go.
   */
  setObjectStyle: (id: string, patch: Partial<ObjectStyle>) => void;
  /** Replaces a note's text. Ignored for any kind but text. */
  updateText: (id: string, content: string) => void;
  /**
   * Adds a copy of the object beside it and selects the copy. Ignored for a
   * stage, of which there is one each, and for a subtype at its `maxCount`.
   */
  duplicateObject: (id: string) => void;
  /** Ignored for a locked object. */
  deleteObject: (id: string) => void;
  /** Deletes every object of `subtype` — a reset for one tool. Spares locked ones. */
  deleteSubtype: (subtype: string) => void;
  /**
   * Deletes every object, of every tool, as one undo step. Spares locked
   * ones. Anything half-made goes too; the tool itself stays picked.
   */
  deleteAll: () => void;
  undo: () => void;
  redo: () => void;
  /**
   * Opens a continuous gesture — a live drag, a path being drawn, a zone
   * being resized. Until it ends, the ordinary actions above still update
   * `objects` on every frame but record nothing, and the whole gesture
   * becomes a single undo step. Undo and redo are ignored while one is open.
   */
  beginGesture: () => void;
  /** Closes the gesture, recording one step if it changed anything. */
  endGesture: () => void;
}

export const MAX_MEASURE_POINTS = 4;

const NO_VIEWPORT: Viewport = { scale: 1, x: 0, y: 0 };

const NO_TOOL = {
  activeTool: null,
  textDraft: null,
  toolLabel: '',
  draft: null,
} as const;
const NO_MEASURE = { measureMode: false, measurePoints: [], measureDone: false };

const isFinitePoint =(p: Point) => Number.isFinite(p.x) && Number.isFinite(p.y);

export const useCanvasStore = create<CanvasState>((set, get) => ({
  mapKey: DEFAULT_MAP_KEY,
  viewport: NO_VIEWPORT,
  container: null,
  gridVisible: false,
  measureMode: false,
  measurePoints: [],
  measureDone: false,
  objects: [],
  history: emptyHistory(),
  selectedId: null,
  activeTool: null,
  namingId: null,
  textDraft: null,
  toolStage: 1,
  toolLabel: '',
  draft: null,
  toolStyles: {},
  // Only where the shared picker starts; nothing takes it until it is picked.
  sharedColor: '#ffffff',
  strategyName: DEFAULT_STRATEGY_NAME,
  interfaceHidden: false,
  layers: DEFAULT_LAYERS,
  activeLayerId: DEFAULT_LAYERS[0].id,
  layersPanelOpen: false,
  pendingView: null,

  loadDocument: (document, title) => {
    assertReadable(document);
    // A gesture left open by the old plan must not record against the new.
    gestureBase = null;
    const { container } = get();
    const { layers, objects } = normalizePlan(document);
    set({
      ...NO_TOOL,
      ...NO_MEASURE,
      mapKey: document.map,
      layers,
      // New work goes on top, as it would in a fresh strategy.
      activeLayerId: layers[layers.length - 1].id,
      // Both are the identity on a document this build saved.
      objects: pruneStages(objects.map(clampObject)),
      history: emptyHistory(),
      selectedId: null,
      namingId: null,
      strategyName: title,
      viewport: container
        ? viewportOf(document.view, container, getMap(document.map))
        : NO_VIEWPORT,
      pendingView: container ? null : document.view,
    });
  },

  resetDocument: () => {
    gestureBase = null;
    const { container } = get();
    set({
      ...NO_TOOL,
      ...NO_MEASURE,
      layers: DEFAULT_LAYERS,
      activeLayerId: DEFAULT_LAYERS[0].id,
      objects: [],
      history: emptyHistory(),
      selectedId: null,
      namingId: null,
      strategyName: DEFAULT_STRATEGY_NAME,
      viewport: container ? fitViewport(container) : NO_VIEWPORT,
      pendingView: null,
    });
  },

  setStrategyName: (strategyName) =>
    set({ strategyName: strategyName.slice(0, MAX_LABEL_LENGTH) }),

  setInterfaceHidden: (interfaceHidden) => set({ interfaceHidden }),

  setMap: (mapKey) => {
    const { container } = get();
    set({
      mapKey,
      viewport: container ? fitViewport(container) : NO_VIEWPORT,
      measurePoints: [],
      measureDone: false,
    });
  },

  setContainer: (container) => {
    const { container: previous, viewport, pendingView, mapKey } = get();
    const first = pendingView
      ? viewportOf(pendingView, container, getMap(mapKey))
      : fitViewport(container);
    set({
      container,
      viewport: previous ? clampViewport(viewport, container) : first,
      pendingView: null,
    });
  },

  // The three below stand still while a note is being edited: see `textDraft`.
  zoom: (anchor, factor) => {
    const { container, viewport, mapKey, textDraft } = get();
    if (!container || textDraft) return;
    set({ viewport: zoomAt(viewport, anchor, factor, container, getMap(mapKey)) });
  },

  panBy: (dx, dy) => {
    const { container, viewport, textDraft } = get();
    if (!container || textDraft) return;
    set({
      viewport: clampViewport(
        { ...viewport, x: viewport.x + dx, y: viewport.y + dy },
        container,
      ),
    });
  },

  fit: () => {
    const { container, textDraft } = get();
    if (!container || textDraft) return;
    set({ viewport: fitViewport(container) });
  },

  setGridVisible: (gridVisible) => set({ gridVisible }),

  setMeasureMode: (measureMode) => {
    if (measureMode) {
      get().endNaming();
      get().commitText();
    }
    set({
      measureMode,
      measurePoints: [],
      measureDone: false,
      ...(measureMode && { ...NO_TOOL, selectedId: null }),
    });
  },

  addMeasurePoint: (point) => {
    const { measurePoints, measureDone } = get();
    if (measureDone || measurePoints.length >= MAX_MEASURE_POINTS) return;
    if (!isFinitePoint(point)) return;
    const next = [...measurePoints, point];
    set({ measurePoints: next, measureDone: next.length >= MAX_MEASURE_POINTS });
  },

  moveMeasurePoint: (index, point) => {
    const { measurePoints } = get();
    if (index < 0 || index >= measurePoints.length || !isFinitePoint(point)) return;
    set({ measurePoints: measurePoints.map((p, i) => (i === index ? point : p)) });
  },

  removeLastMeasurePoint: () =>
    set({ measurePoints: get().measurePoints.slice(0, -1), measureDone: false }),

  finishMeasure: () => {
    if (get().measurePoints.length >= 2) set({ measureDone: true });
  },

  clearMeasure: () => set({ measurePoints: [], measureDone: false }),

  setTool: (activeTool) => {
    // The point being named is already saved; only the question goes.
    get().endNaming();
    // Likewise a note being typed is kept, not thrown away with the tool.
    get().commitText();
    const stages = activeTool === null ? undefined : getSubtype(activeTool)?.stageDiametersM;
    set({
      ...NO_TOOL,
      ...NO_MEASURE,
      activeTool,
      // A staged tool opens on the stage the plan is waiting for.
      ...(activeTool !== null &&
        stages && { toolStage: nextStage(get().objects, activeTool, stages.length) }),
    });
  },

  requestTool: (tool) => {
    if (atSubtypeLimit(tool, get().objects)) return;
    get().setTool(tool);
  },

  nameObject: (label) => {
    const { namingId, objects } = get();
    if (namingId === null) return;
    get().beginGesture();
    // Kept as typed, like `toolLabel`; trimmed when the name is settled.
    const patch = { label: label.slice(0, MAX_LABEL_LENGTH) };
    commit(objects.map((o) => (o.id === namingId ? patchObject(o, patch) : o)));
  },

  settleNaming: () => {
    const { namingId, objects } = get();
    if (namingId === null) return;
    const named = objects.find((o) => o.id === namingId);
    if (named && named.label !== named.label.trim()) {
      // Inside the gesture when there is one, so the trim is not a step.
      get().updateObject(named.id, { label: named.label.trim() });
    }
    get().endGesture();
  },

  endNaming: () => {
    if (get().namingId === null) return;
    get().settleNaming();
    set({ namingId: null });
  },

  setToolStyle: (tool, patch) => {
    const definition = getSubtype(tool);
    if (!definition?.styleControls && !definition?.fontSizeControl) return;
    const { toolStyles } = get();
    const { color, strokeWidth } = toolStyleOf(tool, toolStyles[tool]);
    const next: ToolStyle = { ...toolStyles[tool], color, strokeWidth };
    if (
      definition.styleControls &&
      patch.strokeWidth !== undefined &&
      Number.isFinite(patch.strokeWidth)
    ) {
      next.strokeWidth = Math.min(
        MAX_STROKE_PX,
        Math.max(MIN_STROKE_PX, Math.round(patch.strokeWidth)),
      );
    }
    if (
      definition.fontSizeControl &&
      patch.fontSize !== undefined &&
      Number.isFinite(patch.fontSize)
    ) {
      next.fontSize = Math.min(
        notePxToFontSize(MAX_NOTE_FONT_PX),
        Math.max(notePxToFontSize(MIN_NOTE_FONT_PX), patch.fontSize),
      );
    }
    set({ toolStyles: { ...toolStyles, [tool]: next } });
  },

  setSharedColor: (input) => {
    const color = parseHex(input);
    if (color === null) return;
    const toolStyles = { ...get().toolStyles };
    for (const [key, definition] of listSubtypes()) {
      if (!definition.styleControls && !definition.sharedColor) continue;
      const { strokeWidth } = toolStyleOf(key, toolStyles[key]);
      toolStyles[key] = { ...toolStyles[key], color, strokeWidth };
    }
    set({ sharedColor: color, toolStyles });
  },

  setToolLabel: (label) => {
    const { activeTool } = get();
    if (!activeTool || getSubtype(activeTool)?.labelField === undefined) return;
    // Kept as typed, spaces and all, so the field does not fight the
    // keyboard; it is trimmed when an object takes it.
    set({ toolLabel: label.slice(0, MAX_LABEL_LENGTH) });
  },

  selectObject: (selectedId) => {
    // Turning to another object, or to none, is the name being left alone.
    if (selectedId !== get().namingId) get().endNaming();
    if (selectedId !== get().textDraft?.id) get().commitText();
    set({ selectedId });
  },

  placeObject: (subtype, at) => {
    if (!at.every(Number.isFinite)) return;
    const definition = getSubtype(subtype);
    if (definition?.kind === 'region' && definition.stageDiametersM) {
      get().placeStage(subtype, at);
      return;
    }
    if (definition?.kind !== 'point' && definition?.kind !== 'text') return;
    if (!canDraw()) return;
    // The previous point's name is settled as it stands before the next
    // object exists, so the two are separate undo steps. A note still open
    // is kept the same way.
    get().endNaming();
    get().commitText();
    if (definition.kind === 'text') {
      const { objects, toolStyles } = get();
      set({
        textDraft: onActiveLayer(
          createText(subtype, at, nextZ(objects), toolStyleOf(subtype, toolStyles[subtype])),
        ),
        selectedId: null,
      });
      return;
    }
    const { objects } = get();
    // Checked here as well as when the tool is picked: a marker tool stays
    // armed between placements, and redo can refill the count.
    if (atSubtypeLimit(subtype, objects)) return;
    const object = onActiveLayer(createPoint(subtype, at, nextZ(objects)));
    commit([...objects, object]);
    set({
      selectedId: object.id,
      // Saved already; a name is asked for afterwards, and may be ignored
      // by simply placing the next point.
      namingId: definition.labelPrompt !== undefined ? object.id : null,
      ...(atSubtypeLimit(subtype, get().objects) && { activeTool: null }),
    });
  },

  placeRegion: (subtype, at, radius) => {
    if (!at.every(Number.isFinite) || !Number.isFinite(radius)) return;
    const definition = getSubtype(subtype);
    // A staged region is never drawn to size: see `placeStage`.
    if (definition?.kind !== 'region' || definition.stageDiametersM) return;
    if (!canDraw()) return;
    const { objects, toolStyles } = get();
    if (atSubtypeLimit(subtype, objects)) return;
    const region = createRegion(
      subtype,
      at,
      radius,
      nextZ(objects),
      toolStyleOf(subtype, toolStyles[subtype]),
    );
    commit([...objects, onActiveLayer(region)]);
    set({
      selectedId: region.id,
      ...(atSubtypeLimit(subtype, get().objects) && { activeTool: null }),
    });
  },

  setToolStage: (stage) => {
    const { activeTool } = get();
    const stages = activeTool === null ? undefined : getSubtype(activeTool)?.stageDiametersM;
    if (!stages || !Number.isFinite(stage)) return;
    set({ toolStage: Math.min(stages.length, Math.max(1, Math.round(stage))) });
  },

  placeStage: (subtype, at) => {
    if (!at.every(Number.isFinite)) return;
    const definition = getSubtype(subtype);
    const diameters = definition?.stageDiametersM;
    if (definition?.kind !== 'region' || !diameters) return;
    get().endNaming();
    get().commitText();
    const { objects, toolStage, toolStyles, mapKey } = get();
    const stage = Math.min(diameters.length, Math.max(1, toolStage));
    // Its centre is only defined relative to the stage before it.
    if (stage > 1 && !stageOf(objects, subtype, stage - 1)) return;
    const radius = stageRadius(diameters[stage - 1], getMap(mapKey));
    const centre = stageCentre(objects, { subtype, stage, radius }, clampCoord(at));
    const placed = stageOf(objects, subtype, stage);
    if (placed) {
      // A stage on a hidden or locked layer is not this click's to move.
      if (placed.locked || !isInteractive(get().layers, placed)) return;
      commit(objects.map((o) => (o === placed ? moveTo(o, centre) : o)));
      set({ selectedId: placed.id });
      return;
    }
    if (!canDraw()) return;
    const region = createRegion(
      subtype,
      centre,
      radius,
      nextZ(objects),
      toolStyleOf(subtype, toolStyles[subtype]),
      stage,
    );
    commit([...objects, onActiveLayer(region)]);
    set({ selectedId: region.id, toolStage: Math.min(diameters.length, stage + 1) });
  },

  editText: (id) => {
    get().commitText();
    const note = get().objects.find((o) => o.id === id);
    if (note?.kind !== 'text' || note.locked) return;
    set({ textDraft: note, selectedId: id });
  },

  setTextContent: (content) => {
    const { textDraft } = get();
    if (!textDraft) return;
    set({ textDraft: { ...textDraft, content: content.slice(0, MAX_NOTE_LENGTH) } });
  },

  commitText: (id) => {
    const { textDraft, objects } = get();
    if (!textDraft || (id !== undefined && id !== textDraft.id)) return;
    set({ textDraft: null });
    const content = textDraft.content.trim();
    if (!objects.some((o) => o.id === textDraft.id)) {
      // A note with nothing in it draws nothing: there would be no way to
      // find it again, let alone select it.
      if (content === '') return;
      commit([...objects, { ...textDraft, content, z: nextZ(objects) }]);
      set({ selectedId: textDraft.id });
      return;
    }
    commit(
      content === ''
        ? objects.filter((o) => o.id !== textDraft.id)
        : objects.map((o) =>
            o.id === textDraft.id && o.kind === 'text' ? { ...o, content } : o,
          ),
    );
  },

  cancelText: () => set({ textDraft: null }),

  startDraft: (subtype, at) => {
    if (!at.every(Number.isFinite)) return;
    if (getSubtype(subtype)?.kind !== 'path' || !canDraw()) return;
    set({ draft: { subtype, points: [clampCoord(at)] } });
  },

  extendDraft: (at) => {
    const { draft } = get();
    if (!draft || !at.every(Number.isFinite)) return;
    const points = [...draft.points, clampCoord(at)];
    set({ draft: { ...draft, points } });
    // A capped path is complete at its last allowed vertex. Finishing here,
    // rather than in the click handler, means no caller can add one more.
    const { maxPoints } = getSubtype(draft.subtype) ?? {};
    if (maxPoints !== undefined && points.length >= maxPoints) get().finishDraft();
  },

  finishDraft: () => {
    const { draft, objects, toolStyles, toolLabel } = get();
    if (!draft) return;
    set({ draft: null });
    if (draft.points.length < 2) return;
    const definition = getSubtype(draft.subtype);
    const named = definition?.labelField !== undefined;
    const path = createPath(
      draft.subtype,
      draft.points,
      nextZ(objects),
      // Read now, not when the draft opened: the settings the stroke was
      // last shown in are the ones it keeps.
      toolStyleOf(draft.subtype, toolStyles[draft.subtype]),
      named ? toolLabel.trim() : '',
    );
    commit([...objects, onActiveLayer(path)]);
    // A name is for one path. The colour stays for the next; the name does
    // not, so two paths share one only when it is typed twice.
    if (named) set({ toolLabel: '' });
    // A capped tool is spent by its one path:
    // the next path needs the tool picked again, so a stray
    // click after the last vertex cannot start another. The path is left
    // selected, which puts its end markers in hand for adjusting.
    if (definition?.maxPoints !== undefined) {
      set({ ...NO_TOOL, selectedId: path.id });
    }
  },

  cancelDraft: () => set({ draft: null }),

  updateObject: (id, patch) =>
    commit(get().objects.map((o) => (o.id === id ? patchObject(o, patch) : o))),

  moveObject: (id, to) => {
    if (!to.every(Number.isFinite)) return;
    const { objects } = get();
    commit(
      objects.map((o) => {
        if (o.id !== id || o.locked) return o;
        return moveTo(o, o.kind === 'region' ? stageCentre(objects, o, to) : to);
      }),
    );
  },

  moveObjectVertex: (id, index, to) => {
    if (!to.every(Number.isFinite)) return;
    commit(
      get().objects.map((o) =>
        o.id === id && !o.locked ? moveVertex(o, index, to) : o,
      ),
    );
  },

  // The four below settle a name in progress first: its gesture must not be
  // left open over a change that is not part of it.
  resizeObject: (id, radius) => {
    if (!Number.isFinite(radius)) return;
    commit(
      get().objects.map((o) => (o.id === id && !o.locked ? resizeTo(o, radius) : o)),
    );
  },

  setObjectStyle: (id, patch) =>
    commit(
      get().objects.map((o) =>
        o.id === id ? { ...o, style: { ...o.style, ...patch } } : o,
      ),
    ),

  updateText: (id, content) =>
    commit(
      get().objects.map((o) =>
        o.id === id && o.kind === 'text'
          ? { ...o, content: content.slice(0, MAX_NOTE_LENGTH) }
          : o,
      ),
    ),

  duplicateObject: (id) => {
    const { objects } = get();
    const original = objects.find((o) => o.id === id);
    if (!original || atSubtypeLimit(original.subtype, objects)) return;
    if (original.kind === 'region' && original.stage !== undefined) return;
    const copy = duplicateOf(original, nextZ(objects));
    commit([...objects, copy]);
    set({ selectedId: copy.id });
  },

  deleteObject: (id) => {
    get().settleNaming();
    commit(get().objects.filter((o) => o.id !== id || o.locked));
  },

  deleteSubtype: (subtype) => {
    get().settleNaming();
    // A note open in the editor may be one of those going.
    set({ textDraft: null });
    const kept = sealed();
    commit(get().objects.filter((o) => o.subtype !== subtype || kept(o)));
  },

  deleteAll: () => {
    get().settleNaming();
    set({ draft: null, textDraft: null });
    commit(get().objects.filter(sealed()));
  },

  // Neither runs under an open note: its working copy would outlive the
  // state it was taken from.
  undo: () => {
    get().settleNaming();
    if (gestureBase || get().textDraft) return;
    const step = undoStep(get().history, planOf(get()));
    if (step) set({ ...present(step.present), history: step.history });
  },

  redo: () => {
    get().settleNaming();
    if (gestureBase || get().textDraft) return;
    const step = redoStep(get().history, planOf(get()));
    if (step) set({ ...present(step.present), history: step.history });
  },

  beginGesture: () => {
    // A gesture already open keeps its baseline: nesting must not split it.
    gestureBase ??= planOf(get());
  },

  endGesture: () => {
    const base = gestureBase;
    gestureBase = null;
    if (!base || samePlan(base, planOf(get()))) return;
    set({ history: record(get().history, base) });
  },

  setLayersPanelOpen: (layersPanelOpen) => set({ layersPanelOpen }),

  setActiveLayer: (id) => {
    if (get().layers.some((layer) => layer.id === id)) set({ activeLayerId: id });
  },

  // Each of the layer edits below first closes any edit still open — a name
  // being typed, a slider mid-drag — so it is an undo step of its own.
  addLayer: () => {
    get().settleNaming();
    get().endGesture();
    const { objects, layers } = get();
    const layer: StrategyLayer = {
      id: newId(),
      name: nextLayerName(layers),
      visible: true,
      locked: false,
    };
    commit(objects, [...layers, layer]);
    set({ activeLayerId: layer.id });
  },

  renameLayer: (id, name) => {
    const next = name.trim().slice(0, MAX_LABEL_LENGTH);
    if (next === '') return;
    get().endGesture();
    patchLayer(id, { name: next });
  },

  setLayerVisible: (id, visible) => {
    get().settleNaming();
    get().endGesture();
    patchLayer(id, { visible });
  },

  setLayerLocked: (id, locked) => {
    get().settleNaming();
    get().endGesture();
    patchLayer(id, { locked });
  },

  moveLayer: (id, to) => {
    get().endGesture();
    const { objects, layers } = get();
    commit(objects, reorder(layers, id, to));
  },

  deleteLayer: (id) => {
    const { layers } = get();
    if (layers.length <= 1 || !layers.some((layer) => layer.id === id)) return;
    get().settleNaming();
    get().endGesture();
    // Anything half-made on the layer goes with it, outside the history.
    if (get().textDraft?.layer === id) set({ textDraft: null });
    // One commit, so the layer and all its objects come back in one undo —
    // and with them the names the remaining layers had before closing up.
    commit(
      get().objects.filter((o) => o.layer !== id),
      renumber(layers.filter((layer) => layer.id !== id)),
    );
  },

  moveObjectToLayer: (objectId, layerId) => {
    const { objects, layers } = get();
    if (!layers.some((layer) => layer.id === layerId)) return;
    commit(objects.map((o) => (o.id === objectId ? { ...o, layer: layerId } : o)));
  },
}));

/** The plan: everything the undo history remembers, and all of it. */
interface Plan {
  objects: StrategyObject[];
  layers: StrategyLayer[];
}

const planOf = ({ objects, layers }: Plan): Plan => ({ objects, layers });

/** Whether the active layer can take a new object: it shows and is unlocked. */
function canDraw(): boolean {
  const { layers, activeLayerId } = useCanvasStore.getState();
  return isDrawable(layers, activeLayerId);
}

/** `object` as it is created: on the active layer. */
function onActiveLayer<T extends StrategyObject>(object: T): T {
  return { ...object, layer: useCanvasStore.getState().activeLayerId };
}

/**
 * Tells the objects a sweeping delete must leave alone: the locked ones,
 * and everything on a locked layer. Hiding is not protecting — a hidden
 * object is still part of the plan, and goes with the rest.
 */
function sealed(): (object: StrategyObject) => boolean {
  const locked = new Set(
    useCanvasStore
      .getState()
      .layers.filter((layer) => layer.locked)
      .map((layer) => layer.id),
  );
  return (object) => object.locked || locked.has(object.layer);
}

function patchLayer(id: string, patch: Partial<StrategyLayer>): void {
  const { objects, layers } = useCanvasStore.getState();
  const layer = layers.find((candidate) => candidate.id === id);
  // Unchanged, `layers` must stay the same array, or it would be a step.
  if (!layer || (Object.keys(patch) as (keyof StrategyLayer)[]).every((k) => layer[k] === patch[k])) {
    return;
  }
  commit(
    objects,
    layers.map((candidate) => (candidate.id === id ? { ...candidate, ...patch } : candidate)),
  );
}


/**
 * `objects` as they stood when the open gesture began, or null when none is
 * open. Bookkeeping rather than state — nothing renders from it — so it
 * stays out of the store.
 */
let gestureBase: Plan | null = null;

const samePlan = (a: Plan, b: Plan) =>
  a.layers === b.layers && sameObjects(a.objects, b.objects);

const sameObjects = (a: StrategyObject[], b: StrategyObject[]) =>
  a.length === b.length && a.every((o, i) => o === b[i]);

/**
 * The state change that makes a plan current. Selection is not part of the
 * document, but it must never outlive what it names — after a delete, or
 * after undoing the add that created it — and it must never rest on an
 * object that cannot be touched: one whose layer has been hidden or locked.
 */
function present({ objects, layers }: Plan) {
  const state = useCanvasStore.getState();
  const { selectedId, namingId, activeLayerId, activeTool, toolStage } = state;
  const reachable = interactiveLayerIds(layers);
  // A staged tool follows its stages off the map: when one goes — deleted,
  // or its placing undone — the tool turns back to the first stage now
  // missing, which is 1 once none are left. Otherwise it would be left
  // pointing at a stage that can no longer be placed.
  const stages = activeTool === null ? undefined : getSubtype(activeTool)?.stageDiametersM;
  const staged = (list: StrategyObject[]) =>
    list.filter((o) => o.kind === 'region' && o.subtype === activeTool && o.stage !== undefined)
      .length;
  const stageLost =
    activeTool !== null && stages !== undefined && staged(objects) < staged(state.objects);
  const selected = objects.find((o) => o.id === selectedId);
  return {
    objects,
    layers,
    selectedId: selected && reachable.has(selected.layer) ? selectedId : null,
    // Nor may the offer of a name outlive the object it is for.
    namingId: objects.some((o) => o.id === namingId) ? namingId : null,
    // Its layer deleted, or the delete undone past it: fall back to the top.
    activeLayerId: layers.some((layer) => layer.id === activeLayerId)
      ? activeLayerId
      : layers[layers.length - 1].id,
    toolStage:
      stageLost && activeTool !== null && stages
        ? nextStage(objects, activeTool, stages.length)
        : toolStage,
  };
}

/**
 * The only writer of a new plan. Add, update, move and delete all build the
 * next `objects` — and a layer edit the next `layers` — and hand them here,
 * which makes this the one place history is recorded — the actions never
 * mention it — and the one place coordinates are forced into [0,1], so no
 * action can skip the clamp. Objects and layers changed in one call are one
 * step: that is what makes a layer's delete, with all its objects, undo in
 * one.
 *
 * A snapshot is the previous array itself, not a copy: every action builds a
 * new array and new objects for what it changes, so an old array is never
 * written to again and unchanged objects are shared between snapshots.
 *
 * Kept off the store's public state so nothing outside this file can
 * replace the array without going through a named action.
 */
function commit(next: StrategyObject[], nextLayers?: StrategyLayer[]): void {
  const state = useCanvasStore.getState();
  const current = planOf(state);
  // Here rather than in the delete actions, so that no way of removing a
  // stage can leave the ones that depended on it behind.
  const objects = pruneStages(next.map(clampObject));
  const plan: Plan = {
    // Kept as the same array when nothing in it changed, as history expects.
    objects: sameObjects(objects, current.objects) ? current.objects : objects,
    layers: nextLayers ?? current.layers,
  };
  const { history } = state;
  // An action that changed nothing (unknown id, locked object) must not
  // become an empty undo step.
  if (samePlan(plan, current)) return;
  useCanvasStore.setState({
    ...present(plan),
    // Inside a gesture the intermediate states are not steps; `endGesture`
    // records the one that is.
    ...(gestureBase === null && { history: record(history, current) }),
  });
}
