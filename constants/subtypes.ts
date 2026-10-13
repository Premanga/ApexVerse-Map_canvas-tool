import type {
  ObjectProperty,
  PathInput,
  SubtypeDefinition,
  ToolCategory,
} from '../types';

/**
 * What the properties panel offers, by what a subtype is drawn as. Written
 * once so the tools of a kind agree; an entry is free to list its own.
 */
const POINT_PROPERTIES: ObjectProperty[] = ['color', 'size'];
const PATH_PROPERTIES: ObjectProperty[] = ['color', 'strokeWidth', 'dash'];
const REGION_PROPERTIES: ObjectProperty[] = ['color', 'fillOpacity', 'radius'];
const TEXT_PROPERTIES: ObjectProperty[] = ['content', 'color', 'fontSize'];

/**
 * Subtype registry — the only place a tool is defined.
 *
 * Adding a tool is an entry here. The renderer for its `kind` already knows
 * how to draw it, and the controls build their buttons from this map. If a
 * new tool seems to need its own component, the missing piece is a field on
 * `SubtypeDefinition`, not a renderer.
 */
export const SUBTYPES = {
  team_drop: {
    kind: 'point',
    displayName: 'Team drop',
    category: 'markers',
    shortcut: 'D',
    defaultStyle: { color: '#38bdf8', strokeWidth: 2 },
    // Parachute: canopy, two cords and a centre line meeting at the load.
    icon: 'M2.5 7a5.5 5.5 0 0 1 11 0zM2.5 7 8 13.5 13.5 7M8 7v6.5',
    properties: POINT_PROPERTIES,
    labelPrompt: 'Team name (optional)',
    // A full lobby: 100 players in squads of four.
    maxCount: 25,
  },
  // The two tags are told apart by glyph first — a figure against a
  // reticle — and by colour second: lime and red also differ in brightness,
  // so they stay apart for a red-green colour-blind reader.
  teammate_tag: {
    kind: 'point',
    displayName: 'Teammate tag',
    category: 'markers',
    shortcut: 'T',
    defaultStyle: { color: '#a3e635', strokeWidth: 2 },
    // Figure: head and shoulders.
    icon: 'M8 2.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5zM3 13.5a5 5 0 0 1 10 0z',
    properties: POINT_PROPERTIES,
    labelPrompt: 'Player name (optional)',
    // Tags for one squad, with a spare for a substitute.
    maxCount: 5,
  },
  enemy_tag: {
    kind: 'point',
    displayName: 'Enemy tag',
    category: 'markers',
    shortcut: 'E',
    defaultStyle: { color: '#f87171', strokeWidth: 2 },
    // Reticle: a ring with four ticks crossing it.
    icon: 'M8 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM8 1.5v4M8 10.5v4M1.5 8h4M10.5 8h4',
    properties: POINT_PROPERTIES,
  },
  pin: {
    kind: 'point',
    displayName: 'Pin',
    category: 'markers',
    shortcut: 'P',
    defaultStyle: { color: '#e5e5e5', strokeWidth: 2 },
    // Map pin: a teardrop with its eye.
    icon: 'M8 14.5S3.5 10 3.5 6.5a4.5 4.5 0 0 1 9 0C12.5 10 8 14.5 8 14.5zM8 5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z',
    properties: POINT_PROPERTIES,
  },
  team_rotation: {
    kind: 'path',
    displayName: 'Rotation',
    category: 'routes',
    shortcut: 'R',
    // Thin, with a small head: several rotations share a map, and broad
    // lines would hide the ground they cross.
    defaultStyle: {
      color: '#ff8c42',
      strokeWidth: 2,
      arrowEnd: true,
      arrowSize: 7,
      casing: true,
    },
    // A route with two bends, ending in an arrowhead.
    icon: 'M2 13l4-6 4 3 4-7M10.5 3H14v3.5',
    properties: PATH_PROPERTIES,
    // One colour per squad or plan, picked between rotations.
    sharedColor: true,
    labelField: 'Rotation name (optional)',
  },
  flight_path: {
    kind: 'path',
    displayName: 'Flight path',
    category: 'routes',
    shortcut: 'F',
    // Broad and cased: there is one flight path, and everything else on the
    // map is planned around it. The dashes run the way the plane flies.
    defaultStyle: {
      color: '#f8fafc',
      strokeWidth: 3,
      dash: [12, 10],
      casing: true,
      flow: 30,
      // An aircraft seen from above, nose to the right.
      endGlyph:
        'M15 8 11 7H7.5L5 1.5H3.5L5 7H2.5L1.5 5H.5L1.2 8 .5 11H1.5L2.5 9H5L3.5 14.5H5L7.5 9H11Z',
      endMarkers: true,
    },
    // Paper plane.
    icon: 'M14 2 2 7l5 2 2 5zM7 9l7-7',
    properties: PATH_PROPERTIES,
    // The plane flies one straight line: where it enters and where it leaves.
    maxPoints: 2,
  },
  freehand: {
    kind: 'path',
    displayName: 'Freehand',
    category: 'drawing',
    // B for brush.
    shortcut: 'B',
    defaultStyle: { color: '#f472b6', strokeWidth: 2 },
    // Pencil.
    icon: 'M2.5 13.5l.8-3.3 7.5-7.5 2.5 2.5-7.5 7.5zM9.5 4l2.5 2.5',
    properties: PATH_PROPERTIES,
    input: 'stroke',
    styleControls: true,
  },
  circle: {
    kind: 'region',
    displayName: 'Circle',
    category: 'drawing',
    shortcut: 'C',
    // Dashed and clear inside: a ring round something, not an area.
    defaultStyle: { color: '#facc15', strokeWidth: 2, dash: [8, 6] },
    // A ring.
    icon: 'M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11z',
    properties: REGION_PROPERTIES,
    sharedColor: true,
  },
  note: {
    kind: 'text',
    displayName: 'Note',
    category: 'drawing',
    shortcut: 'N',
    // No stroke of its own: the lettering's dark edge is sized from the
    // lettering. About 15 px tall with the whole map in a 600 px view.
    defaultStyle: { color: '#ffffff', strokeWidth: 0, fontSize: 0.025 },
    // A capital T.
    icon: 'M3.5 4.5V3h9v1.5M8 3v10M6.5 13h3',
    properties: TEXT_PROPERTIES,
    sharedColor: true,
    fontSizeControl: true,
  },
  zone: {
    kind: 'region',
    displayName: 'Zone',
    category: 'overlays',
    // Bare Z only: with Ctrl or Cmd it is still undo.
    shortcut: 'Z',
    // The play zone as the game draws it: a white ring, cased so it reads
    // over any ground. The tint is faint because eight of them stack.
    defaultStyle: {
      color: '#ffffff',
      strokeWidth: 2,
      casing: true,
      fillOpacity: 0.03,
    },
    // A ring within a ring: the zone and the one it closes to.
    icon: 'M8 2a6 6 0 1 0 0 12a6 6 0 1 0 0-12zM8 5.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z',
    // No radius: a stage's size is the game's, not a property to edit.
    properties: ['color', 'fillOpacity'],
    // The safe zone's eight circles: how far ACROSS each is, in metres — the
    // first is a little over half the 8 km map. The game's own numbers: not
    // settings, and not to be rounded to suit the screen.
    stageDiametersM: [4564.7, 2510.6, 1506.4, 828.5, 579.9, 348, 174, 87],
  },
} satisfies Record<string, SubtypeDefinition>;

export type SubtypeKey = keyof typeof SUBTYPES;

/**
 * The tool rail's group headings, in the order it shows them. A tool lands under
 * one by naming it in its registry entry; within a heading, tools keep the
 * registry's order.
 */
export const TOOL_CATEGORIES: { key: ToolCategory; title: string }[] = [
  { key: 'select', title: 'Select' },
  { key: 'markers', title: 'Team & Player Markers' },
  { key: 'routes', title: 'Rotations & Flight Paths' },
  { key: 'drawing', title: 'Drawing & Annotation' },
  { key: 'overlays', title: 'Map Overlays' },
  { key: 'measurement', title: 'Measurement & Analysis' },
];

/** Undefined for a subtype this build does not know. */
export function getSubtype(key: string): SubtypeDefinition | undefined {
  return (SUBTYPES as Record<string, SubtypeDefinition>)[key];
}

export function listSubtypes(): [SubtypeKey, SubtypeDefinition][] {
  return Object.entries(SUBTYPES) as [SubtypeKey, SubtypeDefinition][];
}

/** Whether `objects` already holds as many of `key` as its subtype allows. */
export function atSubtypeLimit(key: string, objects: { subtype: string }[]): boolean {
  const { maxCount } = getSubtype(key) ?? {};
  return (
    maxCount !== undefined &&
    objects.filter((o) => o.subtype === key).length >= maxCount
  );
}

/**
 * Whether `key` is a tool that draws with the press itself — a path's
 * vertices or stroke, a region's drag. Such a tool owns the map while it is
 * armed: its presses land on the map even on top of an object, so a route
 * can cross a marker and a circle can be drawn inside another. A staged
 * region is placed by a click, like a marker, and is not one of these.
 */
export function drawsOnMap(key: string | null): boolean {
  const definition = key === null ? undefined : getSubtype(key);
  return (
    definition?.kind === 'path' ||
    (definition?.kind === 'region' && definition.stageDiametersM === undefined)
  );
}

/**
 * Whether `key` is a tool whose every click on the map puts an object down,
 * whatever is under it: a marker, or a stage of a staged region.
 */
export function placesByClick(key: string | null): boolean {
  const definition = key === null ? undefined : getSubtype(key);
  return (
    definition?.kind === 'point' ||
    (definition?.kind === 'region' && definition.stageDiametersM !== undefined)
  );
}

/** How `key` draws a path, or null when it is not a path tool at all. */
export function pathInputOf(key: string | null): PathInput | null {
  const definition = key === null ? undefined : getSubtype(key);
  return definition?.kind === 'path' ? (definition.input ?? 'vertices') : null;
}
