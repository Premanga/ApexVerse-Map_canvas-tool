# ApexVerse Map Canvas

A tactical planning workspace for BGMI. Draw a plan on the Erangel map —
drops, rotations, the flight path, the safe zone's eight stages, notes —
organise it in layers, and it saves itself as you go.

It runs entirely in the browser. There is no backend yet: strategies are
kept in the browser's own storage (see [Saving](#saving-and-opening)).

## Contents

- [Download, install and run](#download-install-and-run)
- [Using the editor](#using-the-editor)
- [Tools](#tools)
- [The safe zone](#the-safe-zone)
- [Layers](#layers)
- [Properties panel](#properties-panel)
- [Saving and opening](#saving-and-opening)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [On a phone](#on-a-phone)
- [For developers](#for-developers)

## Download, install and run

### What you need

- **Node.js 20.9 or newer** — <https://nodejs.org> (the LTS download is fine).
  Check with `node -v`.
- **Git**, to download the project — <https://git-scm.com>. Or use the
  green **Code → Download ZIP** button on GitHub and unzip it instead.

### Steps

```bash
# 1. Download
git clone https://github.com/Premanga/ApexVerse-Map_canvas-tool.git
cd ApexVerse-Map_canvas-tool

# 2. Install (once; takes a minute or two)
npm install

# 3. Run
npm run dev
```

Then open <http://localhost:3000> in a browser. Stop the server with
`Ctrl+C` in the terminal.

The Erangel map image ships with the project
(`public/maps/bgmi/Erangel.png`), so there is nothing else to fetch.

### Other commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server with live reload, on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Serves the production build (run `build` first) |
| `npm run lint` | Lints the code |
| `npx tsc --noEmit` | Type-checks without building |

### Opening it on a phone or another device

1. Put the phone on the same Wi-Fi as the computer.
2. `npm run dev` prints a **Network** address, for example
   `http://192.168.0.107:3000`. Open that on the phone.
3. The development server only accepts devices it has been told about. Open
   `next.config.ts` and put your computer's own address in
   `allowedDevOrigins` — it is currently set to `192.168.0.107`, which will
   not be right on another network — then restart `npm run dev`.

### If something goes wrong

- **`npm` is not recognised** — Node.js is not installed, or the terminal
  was opened before it was. Install it and open a new terminal.
- **Port 3000 is in use** — run on another port: `npm run dev -- -p 3001`.
- **The map is a grey square** — the image did not load. Check that
  `public/maps/bgmi/Erangel.png` exists.
- **Nothing is saved after a reload** — the browser is blocking storage
  (a private window, or cleared site data).

## Using the editor

| Part | Where | What it is for |
|---|---|---|
| **Top bar** | Top | Strategy name, map, undo/redo, New / Open / Save, save status, Layers, Hide interface |
| **Tool rail** | Left, vertically centred | Every tool, the grid, measure, delete-everything and zoom. Collapsible |
| **Tool settings** | Right | Appears while a tool is active: its colour, size, stage or name |
| **Properties** | Right | Appears while an object is selected |
| **Layers** | Right | Appears when toggled from the top bar |

The right-hand panels are contextual: with no tool, no selection and the
layers panel closed, that side of the map is clear.

### Moving around the map

- **Pan** — drag the map. With a drawing tool active, hold `Space` and
  drag, or drag with the middle mouse button.
- **Zoom** — scroll wheel or trackpad pinch, or the `+` / `−` buttons in
  the rail. **Fit to view** resets it.

### Selecting and editing

- **Select** — click an object (pick **Select / Pan**, `V`, first if a tool
  is active).
- **Move** — drag a selected object.
- **Delete** — select it and press `Delete`, or use **Delete** in the
  properties panel. Double-clicking an object also deletes it; for a note,
  double-click reopens it for editing instead.
- **Delete everything** — the red bin in the rail. It asks for a second tap.
- **Undo / redo** — top bar, or `Ctrl+Z` / `Ctrl+Y`.
- **Hide interface** — clears every bar and panel off the map. A
  **Show interface** button stays in the top-right corner.

## Tools

Tools are grouped in the rail. Each has a single-key shortcut, shown in its
tooltip and beside its name when the rail is open.

### Team & player markers

| Tool | Key | Notes |
|---|---|---|
| Team drop | `D` | Up to 25. Offers an optional team name after each one |
| Teammate tag | `T` | Up to 5. Offers an optional player name |
| Enemy tag | `E` | |
| Pin | `P` | |

Click the map to place one. The tool stays active, so keep clicking to
place more; each is saved the moment it is placed. A small prompt offers a
name — type one, or ignore it and carry on.

### Rotations & flight paths

| Tool | Key | Notes |
|---|---|---|
| Rotation | `R` | Click each corner; finish with `Enter` or by clicking the last point again. Optional name, typed before or while drawing |
| Flight path | `F` | Two clicks: where the plane enters and where it leaves. Drawn as flowing dashes ending in a plane; drag either end to adjust |

### Drawing & annotation

| Tool | Key | Notes |
|---|---|---|
| Freehand | `B` | Press and drag. Brush size is in its settings |
| Circle | `C` | Press at the centre and drag out. A selected circle has one handle on its edge for resizing |
| Note | `N` | Click, type, `Enter` to keep. `Shift+Enter` is a new line, `Esc` cancels. Font size (4–20 px) is in its settings |

Notes are the one thing that scales with the map: a note is a fixed size on
the ground, so it grows as you zoom in and shrinks away as you zoom out.

### Map overlays

| Tool | Key | Notes |
|---|---|---|
| Zone | `Z` | The eight-stage safe zone — see below |
| Grid | `G` | Toggles the grid |

### Measurement

| Tool | Key | Notes |
|---|---|---|
| Measure | `M` | Click up to four points for a route; distances are in metres. `Enter` finishes, `Backspace` removes the last point, `Esc` leaves |

### Colour

Freehand, Rotation, Circle and Note draw in one shared colour. It is the
colour strip at the top of the tool settings: click it and the picker drops
down. It sets the colour of what is drawn **next**; to recolour something
already on the map, select it and use the properties panel.

## The safe zone

The Zone tool places the play zone's eight stages. Their sizes are the
game's and cannot be changed:

| Stage | Diameter |
|---|---:|
| 1 | 4,564.7 m |
| 2 | 2,510.6 m |
| 3 | 1,506.4 m |
| 4 | 828.5 m |
| 5 | 579.9 m |
| 6 | 348 m |
| 7 | 174 m |
| 8 | 87 m |

**To place them:** pick Zone, and the settings show stages 1–8. Click the
map to place the selected stage's centre; the selector then moves on to the
next stage.

**The rules:**

- Stage 1 can go anywhere.
- A stage cannot be placed until the one before it is on the map.
- Each stage must lie **wholly inside the previous stage** — it may touch
  its edge, not cross it.
- Each stage's centre must be within **half the previous stage's radius** of
  that stage's centre.

A dashed amber guide shows where the next centre may go. A click outside it
is not refused: it lands on the nearest point that is allowed. The same
rules hold when you drag a stage afterwards, in both directions — a stage
cannot be dragged to where the one inside it would stick out.

**Deleting a stage deletes every later stage too**, since each is only
valid relative to the one before. It is one undo step. The selector then
goes back to the first stage that is missing.

Placement is entirely manual. Nothing here predicts where a zone will be.

## Layers

Toggle the panel with **Layers** in the top bar. Layers are listed top
first, the way they are stacked on the map.

- **Active layer** — click a row. New objects go on the active layer.
- **Rename** — double-click the name.
- **Reorder** — drag the grip at the left of a row. Order is draw order.
- **Hide** (eye) — the layer's objects are not drawn and cannot be clicked.
- **Lock** (padlock) — the layer's objects are drawn but cannot be selected,
  moved or edited; clicks pass through them to whatever is underneath.
- **Delete** — removes the layer **and its objects**, after confirming with
  the count. The last layer cannot be deleted.
- Each row shows how many objects are on it.

Hiding and locking are saved with the strategy, so it opens looking the way
you left it. If the active layer is hidden or locked, nothing can be drawn
on it; a notice at the bottom of the map says so.

To move an object to another layer, select it and use **Layer** in the
properties panel.

## Properties panel

Select an object and the panel shows what can be changed about it:

| Kind | Properties |
|---|---|
| Markers | Label, layer, colour, size |
| Rotations, flight paths, freehand | Label, layer, colour, stroke width, dashed on/off |
| Circles | Label, layer, colour, fill opacity, radius |
| Zone stages | Label, layer, colour, fill opacity (the radius is fixed) |
| Notes | Label, layer, text, colour, font size |

Changes apply as you make them. Dragging a slider is one undo step, not one
per frame. **Duplicate** and **Delete** are at the bottom.

## Saving and opening

- **Autosave** — a strategy saves itself about a second after you stop
  changing it. The top bar shows **Saved**, **Saving…**, **Unsaved changes**,
  **Conflict** or **Save failed**.
- **Save now** — the disk icon, if you do not want to wait.
- **New** — starts an empty strategy. It is stored once you draw on it.
- **Open** — lists saved strategies, newest first, with duplicate and
  delete. Opening one replaces what is on the map.
- **Rename** — edit the name in the top bar.
- Reloading the page reopens the strategy you were last on.
- The browser warns before you leave with unsaved changes.

**Where strategies live.** In this browser's local storage, on this device.
They do not sync to other browsers or devices, and clearing site data
deletes them. This is a development stand-in for a server that has not been
built yet.

**Conflicts.** If the same strategy is changed somewhere else — another tab,
for now — saving stops and a banner offers **Reload saved version** or
**Keep mine as a copy**. Nothing is merged automatically.

Undo history is not saved. Opening a strategy starts it empty.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `V` | Select / Pan |
| `D` `T` `E` `P` | Team drop, Teammate tag, Enemy tag, Pin |
| `R` `F` | Rotation, Flight path |
| `B` `C` `N` | Freehand, Circle, Note |
| `Z` `G` `M` | Zone, Grid, Measure |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` or `Ctrl+Shift+Z` | Redo |
| `Delete` / `Backspace` | Delete the selected object |
| `Enter` | Finish the rotation or measurement in progress |
| `Esc` | Cancel what is in progress, then put the tool down |
| `Space` + drag | Pan, whatever tool is active |

Tool keys do nothing while you are typing in a field or holding
`Ctrl` / `Cmd` / `Alt`. Pressing a tool's key again puts it down.

## On a phone

- **Two fingers** pan and zoom the map, whatever tool is active.
- One finger uses the active tool, or pans when none is.
- Panels and the top bar are see-through, and the collapsed tool rail is a
  single column of icons.

The layout is desktop-first; it works on a phone but is not designed for
one.

## For developers

Next.js 16, React 19, TypeScript, Tailwind 4, Konva (`react-konva`) for
rendering and Zustand for state.

### Decisions that are not up for revisiting

- **Normalized coordinates.** Every position is `[0, 1]` on both axes from
  the map's top-left. Nothing is stored or passed in screen pixels. The
  Konva stage's coordinate space *is* normalized map space: the raster is a
  1×1 rect and the stage transform does the zooming.
- Anything that must stay a constant size on screen multiplies by
  `screenUnit(viewport)`, and Konva shapes set `strokeScaleEnabled={false}`.
  Notes are the deliberate exception.
- Konva cannot server-render. The canvas sits behind `MapCanvasShell`
  (`dynamic(..., { ssr: false })`); never import `MapCanvas` from a page.

### Object model

Four kinds, one renderer each. A tool is a **registry entry**, never a new
renderer:

| Kind | Geometry | Subtypes |
|---|---|---|
| `point` | `at` | team drop, teammate tag, enemy tag, pin |
| `path` | `points` | rotation, flight path, freehand |
| `region` | `at`, `radius` | circle, zone |
| `text` | `at`, `content` | note |

`constants/subtypes.ts` is the registry. An entry declares its kind, name,
icon, rail group, shortcut, default style, and which properties the panel
offers. The tool rail, the shortcuts and the properties panel are all
generated from it — registering a subtype is all it takes for it to appear.

### Persistence

A strategy is one versioned document:

```ts
{
  schemaVersion: 1,
  map: 'erangel',
  view: { x, y, zoom },   // map point at the centre of the view; zoom as a multiple of fit
  layers: [{ id, name, visible, locked }],
  objects: [...]          // the store's objects, unchanged
}
```

`persistence/repository.ts` defines `StrategyRepository` — `list`, `get`,
`create`, `update`, `duplicate`, `remove`. `update` takes the version the
client last saw and throws `StrategyConflictError`, carrying the current
version and document, when it is stale. `list` returns metadata only.

`persistence/localRepository.ts` implements it against `localStorage`.
`persistence/index.ts` is the single factory: swapping in an HTTP
implementation is a change to that one file.

### Layout

```
app/                        Next.js entry; renders MapCanvasShell full-screen
components/
  MapCanvas.tsx             the Konva stage and all pointer/touch handling
  objects/                  one renderer per kind, plus hit-testing
  ToolRail.tsx              left rail, built from the registry
  TopBar.tsx                name, undo/redo, New/Open/Save, layers, hide
  SettingsPanel.tsx         the active tool's settings
  PropertiesPanel.tsx       the selected object's properties
  PropertyControls.tsx      one control per editable property
  LayersPanel.tsx
  StrategyBrowser.tsx       the Open dialog
constants/
  maps.ts                   map registry
  subtypes.ts               tool registry
  tools.ts                  rail contents, derived from the registry
lib/
  coords.ts                 viewport math, distances
  objects.ts                pure operations on objects
  stages.ts                 safe-zone rules
  layers.ts                 layer rules
  history.ts                undo/redo stacks
  strategySession.ts        save, open, autosave, conflicts
persistence/                document shape, repository interface, local adapter
store/
  canvasStore.ts            the plan, viewport, tools, history
  strategyStore.ts          which strategy is open and its save state
types.ts                    shared types
index.ts                    public exports
```

### Not built, deliberately

AI, computer vision, automatic or predictive zones, opponent intelligence,
heatmaps, real-time collaborative editing, and a backend. The repository
interface is the extension point for the last one.
