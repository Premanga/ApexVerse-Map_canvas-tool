'use client';

import { useId } from 'react';

interface SliderProps {
  label: string;
  /** The value as shown beside the label, with its unit. */
  display: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

/** A labelled range: its name and current value over the track. */
export function Slider({ label, display, value, min, max, step, onChange }: SliderProps) {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <label htmlFor={id} className="text-neutral-400">
          {label}
        </label>
        <span className="font-mono text-neutral-100">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full cursor-pointer accent-amber-400"
      />
    </div>
  );
}
