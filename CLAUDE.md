# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — type-check with tsc, then bundle into a single self-contained HTML file at `dist/online-gencad-viewer.html`
- `npm run preview` — preview the production build

No test framework or linter is configured.

## Architecture

This is a browser-based viewer for GenCAD files (an EDA board interchange format). It parses `.cad` files and renders them on an HTML5 Canvas using LeaferJS. The build produces a single HTML file (via vite-plugin-singlefile) with all assets inlined.

### Data flow

1. **Parser** (`src/parser/`) — reads GenCAD text into a `GenCADData` structure (types in `parser/types.ts`). Handles sections: HEADER, BOARD, PADS, PADSTACKS, ARTWORKS, SHAPES, COMPONENTS, DEVICES, SIGNALS, TRACKS, ROUTES. TEXT entries parsed in ARTWORKS, BOARD, COMPONENTS, ROUTES (shared `GenCADText` type).
2. **Renderer** (`src/renderer/`) — converts parsed data into LeaferJS scene graph elements (Group, Line, Path, Ellipse, Rect, Text). Split into `board-renderer`, `route-renderer`, `component-renderer`, `colors`, and shared `primitives` helpers. Y coordinates are negated during rendering (`canvasY = -genCADY`).
3. **UI** (`src/ui/`) — layout shell, file picker (drag-and-drop + button), layer/filter controls, left panel (component/net lists with search), and property panel.
4. **Main** (`src/main.ts`) — orchestrates loading, wires UI events, manages highlight/dim state for component and net selection. Viewport (zoom/pan) uses LeaferJS built-in zoomLayer.

### Coordinate system

GenCAD uses Y-up coordinates. The renderer negates Y during element creation (`y = -genCADY`). Rotation angles are also negated (`rotation = -genCADRot`). Text rotation follows the same rule.

### Layer stacking order (back → front)

BOARD → BOARD_TEXTS → ROUTES_BOTTOM → LABELS_BOTTOM → PADS_BOTTOM → PAD_LABELS_BOTTOM → SILK_OUTLINE_BOTTOM → SILK_TEXT_BOTTOM → VALUE_TEXT_BOTTOM → [per-inner-layer: ROUTE_INNER → LABELS_INNER → PADS_INNER → PAD_LABELS_INNER] → ROUTES_TOP → LABELS_TOP → PADS_TOP → PAD_LABELS_TOP → COMPONENTS → SILK_OUTLINE_TOP → SILK_TEXT_TOP → VALUE_TEXT_TOP → TH_DRILLS → VIAS_* → VIA_DRILLS → ROUTE_TEXTS

Key: both route labels (LABELS_*) and pad labels (PAD_LABELS_*) are per-layer, interleaved with their respective route/pad layers. TH_DRILLS after silk, before vias. No ROUTES container for inner layers — individual ROUTE_INNER groups are added directly.

### Key conventions

- LeaferJS elements use custom properties (`_component`, `_signal`, `_pin`, `_padLayer`) for identification in highlight/interaction logic.
- The UI supports Chinese/English via a simple `t()` translation function in `ui/layout.ts`.
- Runtime dependency: `leafer-ui` (with `@leafer-in/view` for zoom).
- `forceSyncRender()`: set `renderer.totalTimes = 0` then call `renderer.render()` to force immediate Canvas redraw after opacity changes.
- Layer groups stored in `Map<string, Group>` keyed by names like `BOARD`, `ROUTE_TOP`, `PADS_BOTTOM`, `PAD_LABELS_TOP`, `VIAS_TOP`, `LABELS`.
- ARTWORKS section: parsed with primitives + texts, rendered when referenced by SHAPES or COMPONENTS. Artwork graphics go to silk outline groups, artwork text rendered with layer color.
- Global styles in `src/style.css` (imported by main.ts), not in index.html inline `<style>`.
