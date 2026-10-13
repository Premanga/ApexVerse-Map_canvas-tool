'use client';

import type { ReactNode } from 'react';

import { ControlIcon } from './ControlIcon';
import { ENTER_FADE } from './styles';

interface RailButtonProps {
  /** The tool's name: its label when the rail is open, always its tooltip. */
  label: string;
  /** Shown after the name in the tooltip, and beside it when the rail is open. */
  shortcut?: string;
  /** Replaces the default tooltip — to say why a tool cannot be picked. */
  title?: string;
  /** Undefined for a plain action, which is never "on". */
  pressed?: boolean;
  disabled?: boolean;
  /** A destructive action: drawn in red so it cannot be taken for the others. */
  danger?: boolean;
  /** The danger is armed and the next press carries it out. */
  armed?: boolean;
  /** Whether the name is written out beside the icon. */
  showLabel: boolean;
  onClick: () => void;
  /** Icon content, as for `ControlIcon`. */
  children: ReactNode;
}

/**
 * The one button of the tool rail: every tool, switch and action in it is
 * this, so sizes, spacing and states cannot differ between them.
 */
export function RailButton({
  label,
  shortcut,
  title,
  pressed,
  disabled = false,
  danger = false,
  armed = false,
  showLabel,
  onClick,
  children,
}: RailButtonProps) {
  const tone = armed
    ? 'bg-red-500 text-white hover:bg-red-400'
    : danger
      ? 'bg-red-500/15 text-red-300 hover:bg-red-500/25 hover:text-red-200'
      : pressed
        ? 'bg-amber-400/20 text-amber-300'
        : 'text-neutral-300 hover:bg-white/10 hover:text-white';

  return (
    <button
      type="button"
      title={title ?? (shortcut ? `${label} (${shortcut})` : label)}
      aria-label={label}
      aria-pressed={pressed}
      aria-keyshortcuts={shortcut}
      // Not the `disabled` attribute: that would swallow the hover, and the
      // tooltip is what says why the button cannot be used.
      aria-disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={`flex h-8 min-w-0 items-center gap-2 rounded-md text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-300/70 ${
        showLabel ? 'w-full px-2' : 'w-full justify-center'
      } ${disabled ? 'cursor-not-allowed text-neutral-300 opacity-35' : tone}`}
    >
      <ControlIcon>{children}</ControlIcon>
      {showLabel && (
        <>
          <span className={`min-w-0 flex-1 truncate text-left ${ENTER_FADE}`}>{label}</span>
          {shortcut && (
            <kbd className="shrink-0 font-mono text-[10px] text-neutral-500">{shortcut}</kbd>
          )}
        </>
      )}
    </button>
  );
}
