/**
 * Map Canvas — shared types.
 *
 * Coordinate convention (load-bearing, read this before touching geometry):
 * every position in this module is NORMALIZED to [0, 1] on both axes,
 * measured from the map image's top-left corner. Nothing is ever stored or
 * passed around in screen pixels. The Konva stage's own coordinate space is
 * this same normalized space, so a persisted point renders as-is.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/**
 * Stage transform.
 *
 * `scale` is screen pixels per normalized unit — i.e. the on-screen edge
 * length of the whole map. `x` / `y` are the screen position of the map's
 * top-left corner.
 */
export interface Viewport {
  scale: number;
  x: number;
  y: number;
}

export interface MapDefinition {
  /** Stable key persisted in the strategy document. */
  key: string;
  displayName: string;
  /** Map raster. Served from static assets or object storage. */
  imageUrl: string;
  /** Source raster size. Used for aspect ratio only. */
  imagePx: Size;
  /**
   * Real-world edge length in metres — the sole input to distance
   * measurement. An error here is silently wrong everywhere rather than
   * visibly broken, so it must be verified against the in-game map.
   */
  worldSizeM: number;
  /** Cells per edge drawn by the grid overlay. A display choice. */
  gridDivisions: number;
}

/**
 * A persisted position: `[x, y]`, normalized. A tuple rather than a `Point`
 * because a path stores hundreds of these in the strategy document.
 */
export type Coord = [x: number, y: number];

/** The four geometry primitives. Rendering dispatches on this and nothing else. */
export type ObjectKind = 'point' | 'path' | 'region' | 'text';

export interface ObjectStyle {
  color: string;
  /** Screen pixels, like every other stroke in this module. */
  strokeWidth: number;
  /** Path and region kinds: dash pattern in screen pixels. Solid when absent. */
  dash?: number[];
  /**
   * Region kinds: how strongly the inside is tinted with `color`, from 0
   * (clear) to 1. Clear when absent.
   */
  fillOpacity?: number;
  /** Point kinds: the badge's radius in screen pixels. 11 when absent. */
  size?: number;
  /**
   * Text kinds: the height of the lettering, NORMALIZED — a fraction of the
   * map's edge — and so the one size in this module that grows and shrinks
   * with the zoom. Deliberate: text held at a constant size on screen piles
   * up into an unreadable heap when the map is zoomed out, where lettering
   * painted on the map shrinks away and declutters itself.
   */
  fontSize?: number;
  /** Path kinds: an arrowhead at the last vertex. */
  arrowEnd?: boolean;
  /**
   * Path kinds: the arrowhead's length and width in screen pixels. Sized
   * from the stroke width when absent.
   */
  arrowSize?: number;
  /**
   * Path kinds: a filled glyph at the last vertex, turned to face along the
   * final segment. SVG path data on a 16×16 box, centred, pointing right.
   */
  endGlyph?: string;
  /** Path kinds: the end glyph's edge in screen pixels. 24 when absent. */
  endGlyphSize?: number;
  /**
   * Path kinds: a dot on the first and last vertex. With an `endGlyph` the
   * glyph stands in for the last one.
   */
  endMarkers?: boolean;
  /**
   * Path and region kinds: a dark edge under the line, so a light colour
   * still reads over bright ground and a dark one over shadow. Solid even
   * under a dashed line, which then reads as marks on a continuous band.
   */
  casing?: boolean;
  /**
   * Path kinds, dashed only: the dashes travel from the first vertex towards
   * the last at this many screen pixels a second. Still when absent.
   */
  flow?: number;
}

/**
 * A property of an object that the properties panel can edit. A subtype
 * lists the ones that apply to it; the panel draws one control per entry and
 * knows nothing else about the subtype.
 */
export type ObjectProperty =
  | 'color'
  | 'size'
  | 'strokeWidth'
  | 'dash'
  | 'fillOpacity'
  | 'radius'
  | 'content'
  | 'fontSize';

/** The part of a style a tool's own settings may choose. */
export type ToolStyle = Pick<ObjectStyle, 'color' | 'strokeWidth' | 'fontSize'>;

interface ObjectBase {
  /** Client-generated uuid. */
  id: string;
  /**
   * The tactical meaning — a key into the subtype registry. Left as a plain
   * string because a strategy document may carry a subtype this build does
   * not know; such an object still renders from its `kind` and own `style`.
   */
  subtype: string;
  style: ObjectStyle;
  label: string;
  /** The id of the `StrategyLayer` it is on. Not a Konva layer. */
  layer: string;
  /** Draw order WITHIN its layer; higher is on top. Layers order first. */
  z: number;
  /** A locked object can be selected but not moved or deleted. */
  locked: boolean;
}

export interface PointObject extends ObjectBase {
  kind: 'point';
  at: Coord;
}

export interface PathObject extends ObjectBase {
  kind: 'path';
  points: Coord[];
}

export interface RegionObject extends ObjectBase {
  kind: 'region';
  at: Coord;
  /** Normalized: a fraction of the map's edge length. */
  radius: number;
  /**
   * Set for a step of its subtype's fixed series, counted from 1: see
   * `SubtypeDefinition.stageDiametersM`. Such a region's radius is given, not
   * chosen — it has no resize handle — and it may reach past the map's edge,
   * since its size is the game's and not something to fit. Only its centre
   * is kept on the map.
   */
  stage?: number;
}

export interface TextObject extends ObjectBase {
  kind: 'text';
  at: Coord;
  content: string;
}

export type StrategyObject = PointObject | PathObject | RegionObject | TextObject;

/** What an edit may change. Identity and geometry have their own paths. */
export type ObjectPatch = Partial<
  Pick<ObjectBase, 'style' | 'label' | 'layer' | 'z' | 'locked'>
>;

/**
 * How a path is laid down: `vertices` is one click per corner, `stroke` is
 * a single press-drag-release.
 */
export type PathInput = 'vertices' | 'stroke';

/**
 * The headings the tool rail groups its tools under. The last two hold
 * view aids rather than subtypes, but they are headings of the same panel.
 */
export type ToolCategory =
  | 'select'
  | 'markers'
  | 'routes'
  | 'drawing'
  | 'overlays'
  | 'measurement';

/** One tool: everything that separates it from the others of its kind. */
export interface SubtypeDefinition {
  kind: ObjectKind;
  displayName: string;
  /** Which group of the tool rail its button sits in. Says nothing of its geometry. */
  category: ToolCategory;
  /**
   * The single key that picks the tool, as an upper-case letter. Pressed
   * bare — never with Ctrl, Cmd or Alt — and never while typing. Must be
   * unique across the rail; `constants/tools.ts` warns in development when
   * two tools claim one key.
   */
  shortcut?: string;
  /**
   * Set for a subtype that exists in documents but is not offered as a
   * tool: it gets no button and no shortcut.
   */
  internal?: boolean;
  /**
   * What the properties panel offers for a selected object of this subtype,
   * in the order shown. Every object's label is editable besides; a subtype
   * that lists nothing has only that.
   */
  properties?: ObjectProperty[];
  defaultStyle: ObjectStyle;
  /**
   * SVG path data on a 16×16 box, drawn stroke-only. The same glyph is the
   * tool's button and, for point kinds, the marker on the map.
   */
  icon: string;
  /**
   * Point kinds: set for a tool whose objects are offered a name as they
   * are placed. The click itself adds the marker to the plan; the tool then
   * asks for its label under this prompt, and the answer may be left blank.
   * Nothing waits on it: the tool stays armed, so the next click simply
   * places another, until the tool is put down or its `maxCount` is reached.
   */
  labelPrompt?: string;
  /**
   * The most objects of this subtype a document holds. At the limit the tool
   * cannot be picked and nothing more is placed until one is deleted.
   * Unlimited when absent.
   */
  maxCount?: number;
  /**
   * Region kinds: set for a tool that places the steps of one fixed series
   * rather than circles of any size. Each entry is a stage's DIAMETER in
   * METRES on the ground, first stage first; the tool places one object per
   * stage, by a click on its centre, and each shows its stage number.
   *
   * A stage's centre must lie within half the previous stage's radius of
   * the previous stage's centre, so a stage cannot be placed before the one
   * before it. The rules are in `lib/stages.ts`.
   */
  stageDiametersM?: number[];
  /** Path kinds only; `vertices` when absent. */
  input?: PathInput;
  /**
   * Path kinds drawn by `vertices` only: the vertex that completes the path.
   * Placing it finishes the path at once, so it can never take another, and
   * spends the tool: each further path needs the tool picked again.
   * Unlimited when absent.
   */
  maxPoints?: number;
  /**
   * Set for a tool whose colour and stroke width are the user's to choose.
   * The panel shows the width setting while the tool is active and takes the
   * colour from its shared colour; `defaultStyle` is only where both start.
   */
  styleControls?: boolean;
  /**
   * Set for a tool that draws in the panel's shared colour but has no other
   * style of its own to choose. `defaultStyle.color` is what it draws in
   * until a shared colour is picked. Implied by `styleControls`.
   */
  sharedColor?: boolean;
  /**
   * Text kinds: set for a tool whose lettering size is the user's to choose.
   * The panel shows the size setting while the tool is active, and
   * `defaultStyle.fontSize` is only where it starts.
   */
  fontSizeControl?: boolean;
  /**
   * Set for a tool whose objects may be named but need not be. The panel
   * shows a field under this caption while the tool is active, and the next
   * object takes whatever is in it — unlike `labelPrompt`, which asks after.
   *
   * The name is read at the moment the object is finished, so it may be
   * typed before drawing or while drawing. That moment is the only one: an
   * object finished with the field empty stays unnamed, and what is typed
   * afterwards belongs to the next object.
   */
  labelField?: string;
}

/**
 * A grouping an object's `layer` names. The document's `layers` array is in
 * draw order, bottom first, so a layer has no z of its own. Both flags are
 * part of the document: a strategy opens looking the way its author left it.
 */
export interface StrategyLayer {
  id: string;
  name: string;
  /** Hidden, its objects are neither drawn nor hit by a click. */
  visible: boolean;
  /** Locked, its objects are drawn but cannot be selected, moved or edited. */
  locked: boolean;
}

/**
 * Where the map was being looked at, free of any screen: the normalized map
 * point at the middle of the view, and how far in the view was zoomed, as a
 * multiple of the zoom that fits the whole map (1 is the whole map). A
 * stored `Viewport` would be screen pixels, which mean nothing on another
 * window size.
 */
export interface StrategyView {
  x: number;
  y: number;
  zoom: number;
}

/** The only schema there is. A document saying otherwise is not opened. */
export const SCHEMA_VERSION = 1;

/**
 * A strategy as it is saved: one versioned document, opaque to whatever
 * stores it. `objects` are the store's own, unchanged — positions stay
 * normalized — so saving and loading again gives back the same canvas.
 *
 * Not in here, on purpose: the undo history, the selection, the tool in
 * hand and its settings. Those belong to a sitting, not to the plan.
 */
export interface StrategyDocument {
  schemaVersion: typeof SCHEMA_VERSION;
  /** A key of the map registry. */
  map: string;
  view: StrategyView;
  layers: StrategyLayer[];
  objects: StrategyObject[];
}
