# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — type-check with tsc, then bundle into a single self-contained HTML file at `dist/online-gencad-viewer.html`
- `npm run preview` — preview the production build

No test framework or linter is configured.

## Architecture

This is a browser-based viewer for GenCAD files (an EDA board interchange format). It parses `.cad` files and renders them as interactive SVG. The build produces a single HTML file (via vite-plugin-singlefile) with all assets inlined.

### Data flow

1. **Parser** (`src/parser/`) — reads GenCAD text into a `GenCADData` structure (types in `parser/types.ts`). Handles sections: HEADER, BOARD, PADS, PADSTACKS, ARTWORKS, SHAPES, COMPONENTS, DEVICES, SIGNALS, TRACKS, ROUTES.
2. **Renderer** (`src/renderer/`) — converts parsed data into SVG DOM elements. Split into `board-renderer`, `route-renderer`, `component-renderer`, and shared `primitives` helpers. The world group uses `scale(1, -1)` to flip Y-axis from GenCAD's Y-up to SVG's Y-down.
3. **UI** (`src/ui/`) — layout shell, file picker (drag-and-drop + button), layer/filter controls, left panel (component/net lists with search), and property panel.
4. **Viewport** (`src/viewport.ts`) — pan, zoom (wheel + buttons), fit-to-view, and animated pan-to-rect.
5. **Main** (`src/main.ts`) — orchestrates loading, wires UI events, manages highlight/dim state for component and net selection.

### Coordinate system

GenCAD uses Y-up coordinates. The renderer negates Y when setting the SVG viewBox and applies `scale(1,-1)` on the world group. Line widths and font sizes are computed adaptively from the board bounding box.

### Key conventions

- All SVG elements use `data-*` attributes for identification (`data-type`, `data-name`, `data-signal`, `data-component`, `data-pad-layer`).
- The UI supports Chinese/English via a simple `t()` translation function in `ui/layout.ts`.
- No external runtime dependencies — only Vite, TypeScript, and vite-plugin-singlefile as dev deps.
