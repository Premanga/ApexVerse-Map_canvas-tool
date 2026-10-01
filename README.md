# Map Canvas

Tactical planning workspace for BGMI. Self-contained module — drop the
`map-canvas/` folder into the app and import from `map-canvas`.

## Install

```bash
npm install konva react-konva zustand
```

Place the Erangel raster at `public/maps/bgmi/erangel.jpg`, or change
`imageUrl` in `constants/maps.ts`.

## Use

```tsx
import { MapCanvasShell } from '@/map-canvas';

export default function StrategyPage() {
  return (
    <div className="h-screen w-screen">
      <MapCanvasShell />
    </div>
  );
}
```

The canvas fills its parent, so the parent needs a real height. It is
client-only by construction — `MapCanvasShell` wraps the Konva tree in a
`dynamic(..., { ssr: false })` import. Do not import `MapCanvas` directly.

## Coordinates

Every position in this module is normalized to `[0, 1]` on both axes from
the map's top-left corner. Nothing is stored in pixels.

The Konva stage's coordinate space *is* normalized map space: the raster is
drawn as a 1×1 rect and the stage transform does the zooming. A point saved
as `[0.412, 0.318]` renders at those exact numbers, so there is no
conversion layer between the persisted document and the render tree, and no
drift across repeated save/load cycles.

The consequence to remember when drawing: anything that should stay a
constant size on screen — stroke widths, marker radii, text — must be
multiplied by `screenUnit(viewport)`, and Konva shapes need
`strokeScaleEnabled={false}`.

Scale is uniform on both axes, which assumes a square raster. Every BGMI
battle-royale map is square; `assertSquare` in `lib/coords.ts` fails loudly
if that changes.

## Layout

```
map-canvas/
  types.ts                  shared types, coordinate convention
  constants/maps.ts         map registry (frontend constant, not a table)
  lib/coords.ts             viewport math, clamping, zoom, distance
  store/canvasStore.ts      zustand store
  hooks/                    container measurement, raster loading
  components/               Konva tree + client-only wrapper
  index.ts                  public exports
```

## Status

Step 1 of 7 — map shell. Pan, zoom, clamped viewport, map registry.

Next: grid overlay and measure mode, then the object model.

Not built, deliberately: AI, computer vision, automatic or predictive
zones, opponent intelligence, heatmaps.
