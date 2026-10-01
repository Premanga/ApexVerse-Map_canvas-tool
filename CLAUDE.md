# Map Canvas

Tactical planning workspace for BGMI. Self-contained module. Nothing outside
`map-canvas/` should be modified without saying so explicitly.

## Locked decisions — do not revisit

- **Normalized coordinates.** Every position is `[0,1]` on both axes from the
  map's top-left. Never store or pass screen pixels. The Konva stage's own
  coordinate space IS normalized map space: the raster is drawn as a 1×1 rect
  and the stage transform does the zooming.
- **Konva** is the renderer (`react-konva`). Not SVG, not raw canvas.
- **Zustand** for state, **Tailwind** for styles, **TypeScript** throughout.
- Anything that must stay a constant size on screen (stroke widths, marker
  radii, fonts) multiplies by `1 / viewport.scale`, and Konva shapes set
  `strokeScaleEnabled={false}`.
- Konva cannot server-render. The Konva tree stays behind
  `MapCanvasShell` (`dynamic(..., { ssr: false })`). Never import
  `MapCanvas` directly from a page.

## Object model

Eleven planned tools reduce to four types. Each object is one geometry
primitive plus a `subtype` string carrying the tactical meaning:

- `point` — team drop, enemy tag, teammate tag, pin
- `path` — team rotation, flight path, freehand
- `region` — zone, circle
- `text` — note

A rotation and a flight path are the same renderer with different style and
label. Adding a tool later must be a registry entry, never a new renderer,
table, column or endpoint.

## Persistence

One versioned `jsonb` strategy document, opaque to the server. Versioned
autosave — stale writes are rejected with 409, never last-write-wins.
Backend is Express-only; no Python. The frontend does not design the schema.

## Out of scope — do not build

AI, computer vision, automatic or predictive zones, opponent intelligence,
heatmaps, real-time collaborative editing. Leave extension points, not
implementations.

## Conventions

- Explain non-obvious decisions in a comment; skip narrating what the code
  already says.
- Prefer small files with one responsibility.
- Run `npx tsc --noEmit` before reporting done.