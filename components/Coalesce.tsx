'use client';

import { useEffect, type ReactNode } from 'react';

import { useCanvasStore } from '../store/canvasStore';

/** A field text is typed into, as against one that is pressed or dragged. */
const isTextField = (target: EventTarget) =>
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLInputElement && (target.type === 'text' || target.type === ''));

interface CoalesceProps {
  children: ReactNode;
}

/**
 * Makes each continuous edit to the controls inside it ONE undo step, using
 * the store's gesture: a slider dragged across its range, a colour dragged
 * round the picker, or a word typed into a field, each undo in one go rather
 * than once per frame or per letter.
 *
 * A gesture opens when a control is pressed, keyed or focused, and closes
 * when the pointer or the key lets go, or the control loses focus. Typing is
 * the exception: a text field's edit runs until it is left, not until each
 * key comes up. Opening is idempotent and closing an unopened gesture does
 * nothing, so the overlapping events are harmless.
 */
export function Coalesce({ children }: CoalesceProps) {
  const begin = useCanvasStore((s) => s.beginGesture);
  const end = useCanvasStore((s) => s.endGesture);

  // A control can vanish mid-edit — its object deselected or deleted — with
  // no blur to say so. A gesture left open would swallow every later step.
  useEffect(() => end, [end]);

  return (
    <div
      onPointerDownCapture={begin}
      onKeyDownCapture={begin}
      onFocusCapture={begin}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyUp={(event) => {
        if (!isTextField(event.target)) end();
      }}
      onBlur={end}
    >
      {children}
    </div>
  );
}
