'use client';

import { useEffect, useRef } from 'react';

import { mapToScreen } from '../lib/coords';
import { MAX_NOTE_LENGTH } from '../lib/objects';
import {
  DEFAULT_NOTE_FONT_SIZE,
  NOTE_FONT_FAMILY,
  NOTE_FONT_WEIGHT,
  NOTE_LINE_HEIGHT,
  NOTE_PADDING_EM,
} from '../lib/text';
import { useCanvasStore } from '../store/canvasStore';
import type { TextObject } from '../types';

interface TextEditorProps {
  /** The note being edited: the store's `textDraft`. */
  note: TextObject;
}

/**
 * The field a note is typed in. Konva has no text input of its own, so this
 * is an HTML textarea laid over the canvas on the note's screen position and
 * set in the note's own type, where the renderer will draw the same letters
 * once it closes. The viewport is locked while it is open — the store sees
 * to that — so it cannot drift off its anchor.
 *
 * Mounted outside the canvas surface, so a press in it never reaches the
 * map; and its keys never reach the canvas shortcuts, which all stand down
 * for a field. Keyed by the note where it is mounted.
 */
export function TextEditor({ note }: TextEditorProps) {
  const viewport = useCanvasStore((s) => s.viewport);
  const setTextContent = useCanvasStore((s) => s.setTextContent);
  const commitText = useCanvasStore((s) => s.commitText);
  const cancelText = useCanvasStore((s) => s.cancelText);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Reopening a note carries on from the end of it.
    const field = fieldRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, []);

  const screen = mapToScreen(viewport, { x: note.at[0], y: note.at[1] });
  // Normalized size times pixels per map edge: the size it is drawn at now.
  const fontPx = (note.style.fontSize ?? DEFAULT_NOTE_FONT_SIZE) * viewport.scale;

  return (
    // The two children share one grid cell. The hidden copy of the text is
    // what gives the cell its size, so the field grows with what is typed
    // and never needs to scroll.
    <div
      className="absolute inline-grid rounded bg-black/60 outline outline-2 outline-amber-300/70"
      style={{
        left: screen.x,
        top: screen.y,
        minWidth: '3em',
        fontSize: fontPx,
        fontFamily: NOTE_FONT_FAMILY,
        fontWeight: NOTE_FONT_WEIGHT,
        lineHeight: NOTE_LINE_HEIGHT,
        color: note.style.color,
      }}
    >
      <span
        aria-hidden
        className="invisible col-start-1 row-start-1 whitespace-pre"
        style={{ padding: `${NOTE_PADDING_EM}em` }}
      >
        {/* A trailing newline has no height of its own until something follows it. */}
        {`${note.content} `}
      </span>
      <textarea
        ref={fieldRef}
        aria-label="Note text"
        value={note.content}
        maxLength={MAX_NOTE_LENGTH}
        spellCheck={false}
        onChange={(event) => setTextContent(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            cancelText();
          } else if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            // Enter that picks a candidate from an input method is not ours.
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            commitText(note.id);
          }
        }}
        // Clicking away keeps the note, as it would in any editor. By id:
        // this may fire after another note has taken the editor's place.
        onBlur={() => commitText(note.id)}
        className="col-start-1 row-start-1 resize-none overflow-hidden whitespace-pre border-0 bg-transparent outline-none"
        style={{
          padding: `${NOTE_PADDING_EM}em`,
          font: 'inherit',
          color: 'inherit',
          caretColor: note.style.color,
        }}
      />
    </div>
  );
}
