'use client';

import { getSubtype, type SubtypeKey } from '../constants/subtypes';
import { stageOf } from '../lib/stages';
import { useCanvasStore } from '../store/canvasStore';
import { CAPTION } from './styles';

interface ToolStageSettingsProps {
  tool: SubtypeKey;
}

/** One decimal always: the sizes are given to the tenth of a metre. */
const formatMetres = (metres: number) =>
  `${metres.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} m`;

/**
 * Which stage a staged tool places next, and what stands in its way.
 * Mounted only while that tool is active. The sizes shown are the registry's
 * and are not editable here or anywhere.
 */
export function ToolStageSettings({ tool }: ToolStageSettingsProps) {
  const objects = useCanvasStore((s) => s.objects);
  const toolStage = useCanvasStore((s) => s.toolStage);
  const setToolStage = useCanvasStore((s) => s.setToolStage);

  const definition = getSubtype(tool);
  const diameters = definition?.stageDiametersM ?? [];
  const placed = (stage: number) => stageOf(objects, tool, stage) !== null;
  // A stage can only be placed once the one before it is on the map.
  const blocked = toolStage > 1 && !placed(toolStage - 1);

  return (
    <div className="space-y-2 rounded-md bg-white/5 p-2">
      <h4 className={CAPTION}>
        {definition?.displayName ?? 'Tool'} settings
      </h4>

      <div role="group" aria-label="Stage" className="grid grid-cols-4 gap-1">
        {diameters.map((diameterM, index) => {
          const stage = index + 1;
          const chosen = stage === toolStage;
          const there = placed(stage);
          const waiting = stage > 1 && !placed(stage - 1);
          return (
            <button
              key={stage}
              type="button"
              title={`Stage ${stage} — ${formatMetres(diameterM)} across${
                there ? ' (placed)' : waiting ? ` (place Stage ${stage - 1} first)` : ''
              }`}
              aria-label={`Stage ${stage}`}
              aria-pressed={chosen}
              onClick={() => setToolStage(stage)}
              // Three things to tell apart: the one chosen, the ones already
              // on the map, and the ones that cannot go down yet.
              className={`h-8 rounded text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-300/60 ${
                chosen
                  ? 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-300/60'
                  : there
                    ? 'bg-white/15 text-white hover:bg-white/20'
                    : waiting
                      ? 'bg-white/5 text-neutral-600 hover:bg-white/10'
                      : 'bg-white/5 text-neutral-300 hover:bg-white/10'
              }`}
            >
              {stage}
            </button>
          );
        })}
      </div>

      <div className="flex items-baseline justify-between text-xs">
        <span className="text-neutral-400">Stage {toolStage} diameter</span>
        <span className="font-mono text-neutral-100">
          {formatMetres(diameters[toolStage - 1] ?? 0)}
        </span>
      </div>

      {blocked ? (
        <p role="alert" className="text-[11px] leading-snug text-amber-300">
          Place Stage {toolStage - 1} first. Stage {toolStage} is positioned from it.
        </p>
      ) : (
        <p className="text-[10px] leading-snug text-neutral-500">
          {placed(toolStage)
            ? 'Already placed. Click the map to move it.'
            : toolStage === 1
              ? 'Click the map to place its centre.'
              : `Click inside the dashed guide to place its centre. It must be within half of Stage ${toolStage - 1}'s radius of that stage's centre, and the whole circle must stay inside Stage ${toolStage - 1}; a click outside lands on the nearest point allowed.`}
        </p>
      )}
    </div>
  );
}
