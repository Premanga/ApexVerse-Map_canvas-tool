'use client';

import { useId, type ReactNode } from 'react';

import { getMap } from '../constants/maps';
import { getSubtype } from '../constants/subtypes';
import {
  MAX_NOTE_LENGTH,
  MAX_STROKE_PX,
  MIN_STROKE_PX,
} from '../lib/objects';
import {
  DEFAULT_NOTE_FONT_SIZE,
  MAX_NOTE_FONT_PX,
  MIN_NOTE_FONT_PX,
  noteFontSizeToPx,
  notePxToFontSize,
} from '../lib/text';
import { useCanvasStore } from '../store/canvasStore';
import type { ObjectProperty, StrategyObject } from '../types';
import { ColorStrip } from './ColorStrip';
import { Slider } from './Slider';
import { DEFAULT_BADGE_RADIUS_PX } from './objects/PointRenderer';

/**
 * One control per editable property. The properties panel looks a subtype's
 * list up in `PROPERTY_CONTROLS` and draws what it finds, so nothing in here
 * or there asks which subtype an object is — a control reads only the
 * object's own geometry and style.
 *
 * Every control writes straight to the store, so an edit shows on the map as
 * it is made. Folding a drag into one undo step is the panel's `Coalesce`.
 */

interface ControlProps {
  object: StrategyObject;
}

/** The dash a line gets when it is switched to dashed and has none of its own. */
const FALLBACK_DASH = [8, 6];

const MIN_BADGE_PX = 7;
const MAX_BADGE_PX = 20;

/** The strongest tint on offer: beyond it the ground under a region is lost. */
const MAX_FILL_PERCENT = 60;

/** The smallest radius the slider reaches, and its step, in metres. */
const MIN_RADIUS_M = 20;
const RADIUS_STEP_M = 10;

function ColorControl({ object }: ControlProps) {
  const setObjectStyle = useCanvasStore((s) => s.setObjectStyle);
  return (
    <div>
      <p className="mb-1 text-xs text-neutral-400">Colour</p>
      <ColorStrip
        color={object.style.color}
        onPick={(color) => setObjectStyle(object.id, { color })}
        label="Colour"
      />
    </div>
  );
}

function SizeControl({ object }: ControlProps) {
  const setObjectStyle = useCanvasStore((s) => s.setObjectStyle);
  const size = object.style.size ?? DEFAULT_BADGE_RADIUS_PX;
  return (
    <Slider
      label="Size"
      display={`${size} px`}
      value={size}
      min={MIN_BADGE_PX}
      max={MAX_BADGE_PX}
      step={1}
      onChange={(next) => setObjectStyle(object.id, { size: next })}
    />
  );
}

function StrokeWidthControl({ object }: ControlProps) {
  const setObjectStyle = useCanvasStore((s) => s.setObjectStyle);
  return (
    <Slider
      label="Stroke width"
      display={`${object.style.strokeWidth} px`}
      value={object.style.strokeWidth}
      min={MIN_STROKE_PX}
      max={MAX_STROKE_PX}
      step={1}
      onChange={(strokeWidth) => setObjectStyle(object.id, { strokeWidth })}
    />
  );
}

function DashControl({ object }: ControlProps) {
  const setObjectStyle = useCanvasStore((s) => s.setObjectStyle);
  const id = useId();
  const dashed = (object.style.dash?.length ?? 0) > 0;
  return (
    <div className="flex items-center justify-between text-xs">
      <label htmlFor={id} className="text-neutral-400">
        Dashed
      </label>
      <input
        id={id}
        type="checkbox"
        checked={dashed}
        onChange={(event) =>
          setObjectStyle(object.id, {
            // Switched on, a line takes the dash its tool draws with.
            dash: event.target.checked
              ? (getSubtype(object.subtype)?.defaultStyle.dash ?? FALLBACK_DASH)
              : undefined,
          })
        }
        className="h-4 w-4 cursor-pointer accent-amber-400"
      />
    </div>
  );
}

function FillOpacityControl({ object }: ControlProps) {
  const setObjectStyle = useCanvasStore((s) => s.setObjectStyle);
  const percent = Math.round((object.style.fillOpacity ?? 0) * 100);
  return (
    <Slider
      label="Fill opacity"
      display={`${percent}%`}
      value={percent}
      min={0}
      max={MAX_FILL_PERCENT}
      step={1}
      onChange={(next) => setObjectStyle(object.id, { fillOpacity: next / 100 })}
    />
  );
}

function RadiusControl({ object }: ControlProps) {
  const resizeObject = useCanvasStore((s) => s.resizeObject);
  const worldSizeM = useCanvasStore((s) => getMap(s.mapKey).worldSizeM);
  // A stage's radius is fixed; its subtype should not list this, but an
  // object decides for itself.
  if (object.kind !== 'region' || object.stage !== undefined) return null;
  const metres = Math.round(object.radius * worldSizeM);
  return (
    <Slider
      label="Radius"
      display={`${metres.toLocaleString('en-US')} m`}
      value={metres}
      min={MIN_RADIUS_M}
      // No circle is wider than the map. Near an edge it stops sooner: the
      // store holds the radius to what keeps the circle on the map.
      max={worldSizeM / 2}
      step={RADIUS_STEP_M}
      onChange={(next) => resizeObject(object.id, next / worldSizeM)}
    />
  );
}

function ContentControl({ object }: ControlProps) {
  const updateText = useCanvasStore((s) => s.updateText);
  const deleteObject = useCanvasStore((s) => s.deleteObject);
  const id = useId();
  if (object.kind !== 'text') return null;
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-neutral-400">
        Text
      </label>
      <textarea
        id={id}
        value={object.content}
        rows={3}
        maxLength={MAX_NOTE_LENGTH}
        onChange={(event) => updateText(object.id, event.target.value)}
        // `FloatingControls` cancels every mouse-down so a clicked button
        // does not keep focus; for a text field that default is what puts
        // the caret in it.
        onMouseDown={(event) => event.stopPropagation()}
        // A note left with nothing in it draws nothing and could never be
        // found again, so it goes — as it does from the on-map editor.
        onBlur={() => {
          if (object.content.trim() === '') deleteObject(object.id);
        }}
        className="mt-1 w-full resize-none rounded-md border border-white/10 bg-black/40 px-2 py-1 text-sm text-white outline-none focus:border-amber-300/60"
      />
    </div>
  );
}

function FontSizeControl({ object }: ControlProps) {
  const setObjectStyle = useCanvasStore((s) => s.setObjectStyle);
  const px = noteFontSizeToPx(object.style.fontSize ?? DEFAULT_NOTE_FONT_SIZE);
  return (
    <Slider
      label="Font size"
      display={`${px} px`}
      value={px}
      min={MIN_NOTE_FONT_PX}
      max={MAX_NOTE_FONT_PX}
      step={1}
      onChange={(next) => setObjectStyle(object.id, { fontSize: notePxToFontSize(next) })}
    />
  );
}

/** The whole dispatch from property to control. */
export const PROPERTY_CONTROLS: Record<ObjectProperty, (props: ControlProps) => ReactNode> = {
  color: ColorControl,
  size: SizeControl,
  strokeWidth: StrokeWidthControl,
  dash: DashControl,
  fillOpacity: FillOpacityControl,
  radius: RadiusControl,
  content: ContentControl,
  fontSize: FontSizeControl,
};
