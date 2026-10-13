'use client';

import { useState } from 'react';

import { hexToHsv, hsvToHex, parseHex, type Hsv } from '../lib/color';
import { clamp01 } from '../lib/objects';

/** Shortcuts only — the square and the strip reach every other colour. */
const PRESETS = [
  '#f472b6',
  '#ef4444',
  '#fb923c',
  '#facc15',
  '#4ade80',
  '#3b82f6',
  '#ffffff',
  '#0a0a0a',
];

/** One arrow-key press on the shade square, as a fraction of its edge. */
const KEY_STEP = 0.02;

const HUE_STRIP =
  'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)';

/**
 * A range input with its own track painted as the element's background, so
 * the hue strip can be a real slider — keyboard and screen reader included —
 * rather than a drawn imitation of one.
 */
const STRIP_INPUT =
  'h-3 w-full cursor-pointer appearance-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 ' +
  '[&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-track]:bg-transparent ' +
  '[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-transparent [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_rgba(0,0,0,0.6)] ' +
  '[&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-transparent';

/**
 * For any container of fields inside the floating controls, spread onto it.
 *
 * `FloatingControls` cancels every mouse-down so a clicked button does not
 * keep focus. For a field that default is the control itself: it is what
 * starts a slider's drag and puts the caret in a text box. Kept from reaching
 * it here, for fields only — swatches are buttons.
 *
 * A slider is done with once the mouse lets go; handing focus back keeps the
 * space bar panning, which is what the cancelling is for.
 */
export const FIELD_GUARDS = {
  onMouseDown: (event: React.MouseEvent) => {
    if (event.target instanceof HTMLInputElement) event.stopPropagation();
  },
  onPointerUp: (event: React.PointerEvent) => {
    if (
      event.pointerType === 'mouse' &&
      event.target instanceof HTMLInputElement &&
      event.target.type === 'range'
    ) {
      event.target.blur();
    }
  },
};

interface ColorPickerProps {
  /** The colour in force, as lowercase `#rrggbb`. */
  color: string;
  onPick: (hex: string) => void;
}

/** Diameter of the dot the chosen colour is previewed in, in screen pixels. */
const PREVIEW_PX = 20;

/**
 * A shade square, a hue strip, a hex field and a row of shortcuts. It owns
 * no colour: it shows the one it is given and reports the one picked.
 */
export function ColorPicker({ color, onPick }: ColorPickerProps) {
  /**
   * The picker's own position. Kept here rather than derived from `color`
   * because hex cannot carry it: black has no hue or saturation, so deriving
   * would snap the handles home the moment the shade reached the bottom.
   */
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(color));
  /** The hex field as typed, which is not always a colour yet. */
  const [hexText, setHexText] = useState(color);
  /**
   * The colour can also change from outside — another picker setting the
   * same tool. Only then do the handles follow it; a colour this picker
   * produced itself leaves them where the hand put them.
   */
  const [seen, setSeen] = useState(color);
  if (color !== seen) {
    setSeen(color);
    if (color !== hsvToHex(hsv)) {
      setHsv(hexToHsv(color));
      setHexText(color);
    }
  }

  const pick = (next: Hsv) => {
    const hex = hsvToHex(next);
    setHsv(next);
    setHexText(hex);
    onPick(hex);
  };

  const pickHex = (hex: string) => {
    setHsv(hexToHsv(hex));
    setHexText(hex);
    onPick(hex);
  };

  const shadeAt = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    pick({
      ...hsv,
      s: clamp01((event.clientX - bounds.left) / bounds.width),
      v: clamp01(1 - (event.clientY - bounds.top) / bounds.height),
    });
  };

  return (
    <div className="space-y-2" {...FIELD_GUARDS}>
      {/* Saturation across, brightness up, over the strip's hue. */}
      <div
        role="slider"
        tabIndex={0}
        aria-label="Colour saturation and brightness"
        aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
        aria-valuenow={Math.round(hsv.s * 100)}
        className="relative h-24 w-full cursor-crosshair touch-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
        style={{
          backgroundColor: `hsl(${hsv.h} 100% 50%)`,
          backgroundImage:
            'linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgba(255,255,255,0))',
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          shadeAt(event);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) shadeAt(event);
        }}
        onKeyDown={(event) => {
          const dx = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
          const dy = event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0;
          if (dx === 0 && dy === 0) return;
          // Arrows would otherwise scroll the panel.
          event.preventDefault();
          pick({
            ...hsv,
            s: clamp01(hsv.s + dx * KEY_STEP),
            v: clamp01(hsv.v + dy * KEY_STEP),
          });
        }}
      >
        <span
          className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
        />
      </div>

      <input
        type="range"
        aria-label="Colour hue"
        min={0}
        max={360}
        step={1}
        value={Math.round(hsv.h)}
        onChange={(event) => pick({ ...hsv, h: Number(event.target.value) })}
        className={STRIP_INPUT}
        style={{ backgroundImage: HUE_STRIP }}
      />

      <div className="flex items-center gap-2">
        <div
          title="Colour preview"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-white/10 bg-neutral-700"
        >
          <span
            className="block rounded-full"
            style={{ width: PREVIEW_PX, height: PREVIEW_PX, backgroundColor: color }}
          />
        </div>
        <input
          aria-label="Hex colour"
          value={hexText}
          spellCheck={false}
          maxLength={7}
          onChange={(event) => {
            const text = event.target.value;
            setHexText(text);
            // Only a full six digits applies while typing: `#abc` is also the
            // first half of a longer colour.
            const hex = text.replace('#', '').length === 6 ? parseHex(text) : null;
            if (hex) {
              setHsv(hexToHsv(hex));
              onPick(hex);
            }
          }}
          onBlur={() => pickHex(parseHex(hexText) ?? color)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          className="h-9 w-full min-w-0 rounded-md border border-white/10 bg-black/40 px-2 font-mono text-xs uppercase text-white outline-none focus:border-amber-300/60"
        />
      </div>

      <div className="grid grid-cols-8 gap-1">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            title={preset.toUpperCase()}
            aria-label={`Use ${preset.toUpperCase()}`}
            aria-pressed={preset === color}
            onClick={() => pickHex(preset)}
            className={`h-5 rounded border outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-amber-300/60 ${
              preset === color ? 'border-amber-300' : 'border-white/20'
            }`}
            style={{ backgroundColor: preset }}
          />
        ))}
      </div>
    </div>
  );
}
