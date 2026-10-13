'use client';

import { useId, useState, type ReactNode } from 'react';

import { ColorPicker } from './ColorPicker';
import { ControlIcon } from './ControlIcon';
import { panelMotion } from './styles';

interface ColorStripProps {
  color: string;
  onPick: (hex: string) => void;
  /** What the colour is of, for the strip's tooltip and its accessible name. */
  label: string;
  /** Shown under the picker when it is down. */
  children?: ReactNode;
}

/**
 * A colour as a strip in that colour; the picker drops down out of the strip
 * when it is clicked. The picker is tall, and most of the time a colour is
 * only being looked at.
 */
export function ColorStrip({ color, onPick, label, children }: ColorStripProps) {
  // Whether the picker is down is a matter for this view alone.
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  // The panels' own timing, so every drop-down moves alike.
  const motion = panelMotion(open);

  return (
    <div className="rounded-md bg-white/5">
      <button
        type="button"
        title={open ? 'Hide colour picker' : label}
        // The strip carries no word, so the name is given here instead.
        aria-label={label}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(!open)}
        className="flex h-10 w-full items-center gap-2 rounded-md px-2.5 transition-colors hover:bg-white/10"
      >
        {/* Bordered, so a colour near the panel's own still reads as a strip. */}
        <span
          className="h-3 min-w-0 flex-1 rounded-full border border-white/20"
          style={{ backgroundColor: color }}
        />
        {/* Down while closed, turned to point up while open. */}
        <ControlIcon
          className={`text-neutral-400 transition-transform ${motion} ${open ? 'rotate-180' : ''}`}
        >
          <path d="M4 6l4 4 4-4" />
        </ControlIcon>
      </button>

      {/* A grid row between 0fr and 1fr animates to the picker's real height. */}
      <div
        className={`grid transition-[grid-template-rows] ${motion} ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div
          id={bodyId}
          // Closed, the picker is still mounted — it keeps its handles — but
          // stays out of the tab order and away from assistive tech.
          inert={!open}
          className="min-h-0 overflow-hidden"
        >
          <div
            className={`space-y-2 p-2 pt-1 transition-[opacity,translate] ${motion} ${
              open ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
            }`}
          >
            <ColorPicker color={color} onPick={onPick} />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
