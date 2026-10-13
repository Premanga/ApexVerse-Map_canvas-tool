'use client';

import { useId } from 'react';

import { atSubtypeLimit, getSubtype } from '../constants/subtypes';
import { MAX_LABEL_LENGTH } from '../lib/objects';
import { useCanvasStore } from '../store/canvasStore';
import type { StrategyObject } from '../types';
import { Coalesce } from './Coalesce';
import { FIELD_GUARDS } from './ColorPicker';
import { ControlIcon } from './ControlIcon';
import { PROPERTY_CONTROLS } from './PropertyControls';
import { DUPLICATE_ICON, TRASH_ICON } from './icons';
import { ENTER_FADE, ENTER_FROM_RIGHT } from './styles';

const ACTION =
  'flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-semibold transition-colors';

interface BodyProps {
  object: StrategyObject;
}

/** Keyed by the object where it is mounted, so nothing carries over to the next. */
function Body({ object }: BodyProps) {
  const objects = useCanvasStore((s) => s.objects);
  const updateObject = useCanvasStore((s) => s.updateObject);
  const duplicateObject = useCanvasStore((s) => s.duplicateObject);
  const deleteObject = useCanvasStore((s) => s.deleteObject);
  const endGesture = useCanvasStore((s) => s.endGesture);
  const layers = useCanvasStore((s) => s.layers);
  const moveObjectToLayer = useCanvasStore((s) => s.moveObjectToLayer);
  const labelId = useId();
  const layerId = useId();

  const definition = getSubtype(object.subtype);
  // An object from a build that knew more subtypes still has a kind, a style
  // and a label; it just has no list of properties to offer.
  const name = definition?.displayName ?? object.subtype;
  const staged = object.kind === 'region' && object.stage !== undefined;
  const copyable = !staged && !atSubtypeLimit(object.subtype, objects);

  return (
    // Keyed by the object, so this fades in for each new selection.
    <div className={`space-y-2.5 ${ENTER_FADE}`}>
      <h3 className="truncate px-0.5 text-sm font-semibold text-white">
        {staged ? `${name} · Stage ${object.stage}` : name}
      </h3>

      {/* Fields inside it are let through `FloatingControls`' mouse-down guard. */}
      <div {...FIELD_GUARDS}>
        <Coalesce>
          <div className="space-y-2.5">
            <div>
              <label htmlFor={labelId} className="block text-xs text-neutral-400">
                Label
              </label>
              <input
                id={labelId}
                value={object.label}
                maxLength={MAX_LABEL_LENGTH}
                placeholder="None"
                onChange={(event) => updateObject(object.id, { label: event.target.value })}
                onKeyDown={(event) => {
                  // Done typing: hand the keys back to the canvas.
                  if (event.key === 'Enter' || event.key === 'Escape') {
                    event.currentTarget.blur();
                  }
                }}
                className="mt-1 h-9 w-full min-w-0 rounded-md border border-white/10 bg-black/40 px-2 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-amber-300/60"
              />
            </div>

            {/*
              Every object is on a layer, so this is not a registry property.
              Moved to a hidden or locked layer, the object can no longer be
              touched and so stops being the selection.
            */}
            <div>
              <label htmlFor={layerId} className="block text-xs text-neutral-400">
                Layer
              </label>
              <select
                id={layerId}
                value={object.layer}
                onChange={(event) => moveObjectToLayer(object.id, event.target.value)}
                // As for a text field: the default `FloatingControls`
                // cancels is what opens the list.
                onMouseDown={(event) => event.stopPropagation()}
                className="mt-1 h-9 w-full min-w-0 cursor-pointer rounded-md border border-white/10 bg-neutral-900 px-2 text-sm text-white outline-none focus:border-amber-300/60"
              >
                {/* Top layer first, as the layers panel lists them. */}
                {[...layers].reverse().map((layer) => (
                  <option key={layer.id} value={layer.id}>
                    {layer.name}
                    {layer.locked ? ' (locked)' : layer.visible ? '' : ' (hidden)'}
                  </option>
                ))}
              </select>
            </div>

            {(definition?.properties ?? []).map((property) => {
              const Control = PROPERTY_CONTROLS[property];
              return <Control key={property} object={object} />;
            })}
          </div>
        </Coalesce>
      </div>

      {/*
        Both close any edit still open first: a button here does not take
        focus, so the field being typed in never blurs, and its edit must not
        be folded into the same undo step as the copy or the delete.
      */}
      <div className="flex gap-1.5 border-t border-white/10 pt-2.5">
        <button
          type="button"
          title={
            staged
              ? 'There is one of each stage'
              : copyable
                ? 'Duplicate'
                : `${name} is at its limit`
          }
          disabled={!copyable}
          onClick={() => {
            endGesture();
            duplicateObject(object.id);
          }}
          className={`${ACTION} bg-white/5 text-neutral-100 hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40`}
        >
          <ControlIcon>
            <path d={DUPLICATE_ICON} />
          </ControlIcon>
          Duplicate
        </button>
        <button
          type="button"
          title="Delete (Del)"
          disabled={object.locked}
          onClick={() => {
            endGesture();
            deleteObject(object.id);
          }}
          className={`${ACTION} bg-red-500/15 text-red-300 hover:bg-red-500/25 hover:text-red-200 disabled:pointer-events-none disabled:opacity-40`}
        >
          <ControlIcon>
            <path d={TRASH_ICON} />
          </ControlIcon>
          Delete
        </button>
      </div>
    </div>
  );
}

/**
 * What the selected object is, and what of it can be changed: its label,
 * then one control per property its subtype lists in the registry. Adding a
 * property to a subtype there is all it takes to offer it here.
 *
 * Contextual on purpose. With nothing selected this renders nothing at all,
 * so it takes no room and the map has the whole width.
 */
export function PropertiesPanel() {
  const object = useCanvasStore((s) => s.objects.find((o) => o.id === s.selectedId));
  if (!object) return null;

  return (
    <div className={`rounded-xl border border-white/10 bg-neutral-900/85 max-md:bg-neutral-900/40 p-2.5 shadow-lg backdrop-blur ${ENTER_FROM_RIGHT}`}>
      <Body key={object.id} object={object} />
    </div>
  );
}
