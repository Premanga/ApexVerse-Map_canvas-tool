/**
 * How a note's lettering is set. Shared by the canvas renderer and the HTML
 * editor laid over it: the editor has to put each letter where the renderer
 * will, or the text would jump as it opens and closes.
 */

export const NOTE_FONT_FAMILY = 'Arial, Helvetica, sans-serif';
export const NOTE_FONT_WEIGHT = 'bold';
/** Line height, as a multiple of the font size. */
export const NOTE_LINE_HEIGHT = 1.2;
/** Space between the lettering and the note's box, in ems. */
export const NOTE_PADDING_EM = 0.2;

/** Used when a text object's style carries no size of its own. */
export const DEFAULT_NOTE_FONT_SIZE = 0.025;

/**
 * A note's size is stored normalized, but nobody thinks of type as a
 * fraction of a map. The setting speaks in pixels instead: how tall the
 * lettering is with the whole map shown this many pixels across. Zoomed in,
 * it is drawn larger than the number says — that is the point of it.
 */
const REFERENCE_VIEW_PX = 600;

/** The sizes the setting can choose between, in reference pixels. */
export const MIN_NOTE_FONT_PX = 4;
export const MAX_NOTE_FONT_PX = 20;

export const notePxToFontSize = (px: number) => px / REFERENCE_VIEW_PX;

export const noteFontSizeToPx = (fontSize: number) =>
  Math.round(fontSize * REFERENCE_VIEW_PX);
