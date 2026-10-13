/**
 * Colour conversion for the style picker. A colour is stored and passed
 * around as a lowercase `#rrggbb` string; HSV exists only while it is being
 * picked, because that is the space a hue strip and a shade square work in.
 */

export interface Hsv {
  /** Degrees, [0, 360]. */
  h: number;
  /** [0, 1]. */
  s: number;
  /** [0, 1]. */
  v: number;
}

/** `#rgb` or `#rrggbb`, hash optional, as lowercase `#rrggbb` — else null. */
export function parseHex(input: string): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
  if (!match) return null;
  const digits = match[1].toLowerCase();
  return `#${digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits}`;
}

/** `hex` — `#rrggbb` — as a CSS colour let through by `alpha`, 0 to 1. */
export function withAlpha(hex: string, alpha: number): string {
  const channel = (from: number) => parseInt(hex.slice(from, from + 2), 16) || 0;
  const a = Math.min(1, Math.max(0, alpha));
  return `rgba(${channel(1)},${channel(3)},${channel(5)},${a})`;
}

export function hsvToHex({ h, s, v }: Hsv): string {
  // The standard closed form: each channel is the same curve, a third of a
  // turn apart.
  const channel = (n: number) => {
    const k = (n + h / 60) % 6;
    const value = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(5)}${channel(3)}${channel(1)}`;
}

/** `hex` must already be `#rrggbb`, as `parseHex` returns it. */
export function hexToHsv(hex: string): Hsv {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let h = 0;
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : delta / max, v: max };
}
