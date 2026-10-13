import type { ToolCategory } from '../types';
import { TOOL_CATEGORIES, listSubtypes, type SubtypeKey } from './subtypes';

/**
 * The tool rail's contents, derived — never listed by hand.
 *
 * Every user-facing subtype in the registry becomes a tool here, under the
 * group its `category` names and in the order it is registered, so a new
 * subtype gets its button and its shortcut by being registered and nothing
 * else. The only entries written out are the three that are not subtypes at
 * all — they make no object — and so have no registry entry to come from.
 */

/** What a tool does when picked. Only `subtype` tools place objects. */
export type ToolAction = 'subtype' | 'select' | 'grid' | 'measure';

export interface ToolDefinition {
  /** Unique across the rail. A subtype tool's id is its subtype key. */
  id: string;
  label: string;
  group: ToolCategory;
  /** SVG path data on a 16×16 box, drawn stroke-only. */
  icon: string;
  /** Upper-case letter, or undefined for a tool with no key. */
  shortcut?: string;
  action: ToolAction;
  /** Set when `action` is `subtype`. */
  subtype?: SubtypeKey;
}

/** A plain square: shown for an entry that names no icon. */
const FALLBACK_ICON = 'M3 3h10v10H3z';

/** Modes and view aids. Each sits after the subtypes of its group. */
const AIDS: ToolDefinition[] = [
  {
    id: 'select',
    label: 'Select / Pan',
    group: 'select',
    // A pointer arrow.
    icon: 'M3.5 2.5v10l2.8-2.6 1.9 4 1.6-.8-1.9-3.9h3.6z',
    shortcut: 'V',
    action: 'select',
  },
  {
    id: 'grid',
    label: 'Grid',
    group: 'overlays',
    icon: 'M2 2h12v12H2zM6 2v12M10 2v12M2 6h12M2 10h12',
    shortcut: 'G',
    action: 'grid',
  },
  {
    id: 'measure',
    label: 'Measure',
    group: 'measurement',
    // A ruler.
    icon: 'M10.5 1.5l4 4-9 9-4-4zM8.5 3.5l1.5 1.5M6.5 5.5l1.5 1.5M4.5 7.5l1.5 1.5',
    shortcut: 'M',
    action: 'measure',
  },
];

const warn = (message: string) => {
  if (process.env.NODE_ENV !== 'production') console.warn(`[map-canvas] ${message}`);
};

function build(): ToolDefinition[] {
  const fromRegistry = listSubtypes()
    .filter(([, subtype]) => !subtype.internal)
    .map(([key, subtype]): ToolDefinition => {
      // The registry's type insists on both, but an entry can still arrive
      // with an empty string; the rail must not show a blank button for it.
      if (!subtype.icon) warn(`Subtype "${key}" has no icon; using a placeholder.`);
      if (!subtype.displayName) warn(`Subtype "${key}" has no displayName; using its key.`);
      return {
        id: key,
        label: subtype.displayName || key,
        group: subtype.category,
        icon: subtype.icon || FALLBACK_ICON,
        shortcut: subtype.shortcut?.toUpperCase(),
        action: 'subtype',
        subtype: key,
      };
    });
  const tools = [...fromRegistry, ...AIDS];

  const known = new Set(TOOL_CATEGORIES.map((category) => category.key));
  const keys = new Map<string, string>();
  for (const tool of tools) {
    if (!known.has(tool.group)) {
      warn(`Tool "${tool.id}" is in unknown group "${tool.group}" and will not be shown.`);
    }
    if (!tool.shortcut) continue;
    const taken = keys.get(tool.shortcut);
    if (taken) {
      warn(`Shortcut ${tool.shortcut} is claimed by "${taken}" and "${tool.id}"; the first wins.`);
    } else {
      keys.set(tool.shortcut, tool.id);
    }
  }
  return tools;
}

const TOOLS = build();

/** The rail's groups in display order, each with its tools. Empty ones are left out. */
export function listToolGroups(): { key: ToolCategory; title: string; tools: ToolDefinition[] }[] {
  return TOOL_CATEGORIES.map((category) => ({
    ...category,
    tools: TOOLS.filter((tool) => tool.group === category.key),
  })).filter((group) => group.tools.length > 0);
}

/** The tool `key` picks, or undefined. `key` is a `KeyboardEvent.key`. */
export function toolForKey(key: string): ToolDefinition | undefined {
  const wanted = key.toUpperCase();
  return TOOLS.find((tool) => tool.shortcut === wanted);
}
