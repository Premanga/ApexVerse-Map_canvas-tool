'use client';

import { getSubtype } from '../constants/subtypes';
import { MAX_LABEL_LENGTH } from '../lib/objects';
import { useCanvasStore } from '../store/canvasStore';
import { ENTER_FROM_TOP } from './styles';

interface ToolLabelPromptProps {
  /** The subtype of the point being named. */
  subtype: string;
}

/**
 * Offers a name for the point just put down. The point is already in the
 * plan, so typing names it in place and nothing here has to be answered.
 * Keyed by that point where it is mounted, so each new one takes the focus
 * for its own name.
 */
export function ToolLabelPrompt({ subtype }: ToolLabelPromptProps) {
  const label = useCanvasStore(
    (s) => s.objects.find((o) => o.id === s.namingId)?.label ?? '',
  );
  const namingId = useCanvasStore((s) => s.namingId);
  const nameObject = useCanvasStore((s) => s.nameObject);
  const settleNaming = useCanvasStore((s) => s.settleNaming);
  const endNaming = useCanvasStore((s) => s.endNaming);
  const deleteObject = useCanvasStore((s) => s.deleteObject);
  const setTool = useCanvasStore((s) => s.setTool);

  const prompt = getSubtype(subtype)?.labelPrompt ?? 'Label';

  return (
    <form
      className={`absolute left-1/2 top-4 w-52 max-md:top-16 -translate-x-1/2 rounded-lg border border-white/10 bg-neutral-900/85 max-md:bg-neutral-900/40 p-3 text-xs text-neutral-200 shadow-lg backdrop-blur ${ENTER_FROM_TOP}`}
      onSubmit={(event) => {
        event.preventDefault();
        endNaming();
      }}
      onKeyDown={(event) => {
        // Puts the tool down. The point, already saved, stays.
        if (event.key === 'Escape') setTool(null);
      }}
    >
      <label className="block text-neutral-400">
        {prompt}
        <input
          autoFocus
          value={label}
          onChange={(event) => nameObject(event.target.value)}
          // Leaving the field is the name being finished, for undo's sake.
          onBlur={settleNaming}
          maxLength={MAX_LABEL_LENGTH}
          className="mt-1 w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-sm text-white outline-none focus:border-amber-300/60"
        />
      </label>
      <p className="mt-1 text-[10px] leading-snug text-neutral-500">
        Already saved. Click the map to place the next.
      </p>
      <div className="mt-2 flex gap-1 border-t border-white/10 pt-2">
        <button
          type="button"
          onClick={() => namingId && deleteObject(namingId)}
          className="flex-1 rounded px-2 py-1 text-neutral-200 transition-colors hover:bg-white/10"
        >
          Remove
        </button>
        <button
          type="submit"
          className="flex-1 rounded px-2 py-1 text-neutral-200 transition-colors hover:bg-white/10"
        >
          Done
        </button>
      </div>
    </form>
  );
}
