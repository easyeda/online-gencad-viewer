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

1. **Parser** (`src/parser/`) — reads GenCAD text into a `GenCADData` structure (types in `parser/types.ts`). Handles sections: HEADER, BOARD, PADS, PADSTACKS, ARTWORKS, SHAPES, COMPONENTS, DEVICES, SIGNALS, TRACKS, ROUTES.
2. **Renderer** (`src/renderer/`) — converts parsed data into LeaferJS scene graph elements (Group, Line, Path, Ellipse, Rect, Text). Split into `board-renderer`, `route-renderer`, `component-renderer`, `colors`, and shared `primitives` helpers. Y coordinates are negated during rendering (`canvasY = -genCADY`).
3. **UI** (`src/ui/`) — layout shell, file picker (drag-and-drop + button), layer/filter controls, left panel (component/net lists with search), and property panel.
4. **Main** (`src/main.ts`) — orchestrates loading, wires UI events, manages highlight/dim state for component and net selection. Viewport (zoom/pan) uses LeaferJS built-in zoomLayer.

### Coordinate system

GenCAD uses Y-up coordinates. The renderer negates Y during element creation (`y = -genCADY`). Rotation angles are also negated (`rotation = -genCADRot`). Text rotation follows the same rule.

### Key conventions

- LeaferJS elements use custom properties (`_component`, `_signal`, `_pin`, `_padLayer`) for identification in highlight/interaction logic.
- The UI supports Chinese/English via a simple `t()` translation function in `ui/layout.ts`.
- Runtime dependency: `leafer-ui` (with `@leafer-in/view` and `@leafer-in/viewport` for zoom/pan).
- `forceSyncRender()`: set `renderer.totalTimes = 0` then call `renderer.render()` to force immediate Canvas redraw after opacity changes.
- Layer groups are stored in a `Map<string, Group>` keyed by layer names (e.g., `BOARD`, `ROUTES_TOP`, `PADS_BOTTOM`, `VIAS_TOP`, `LABELS`).
- Global styles are in `src/style.css` (imported by main.ts), not in index.html inline `<style>`.
