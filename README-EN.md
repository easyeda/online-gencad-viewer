# Online GenCAD Viewer

English | [中文](./README.md)

A free online interactive viewer for GenCAD (.cad) PCB files, supporting multi-layer layout, routing, pads, vias, silkscreen, and more.

you can use it directly at: https://pcbtool.net/tools/online-gencad-viewer.html

or you can download the built html and open at browser: [online-gencad-viewer.html](./dist/online-gencad-viewer.html)

## Features

- Parse and render GenCAD format PCB files
- Multi-layer visualization: top, bottom, inner layers, silkscreen, drill, board outline
- Independent layer show/hide control
- Element filtering: routes, vias, components, reference designators, values, net labels
- Component and net lists with search
- Click to highlight component/net with auto-pan to visible area
- Wheel zoom (cursor-centered) and drag-to-pan
- Fit view, zoom in, zoom out
- Chinese/English UI toggle
- Builds to a single HTML file — no server required

## Tech Stack

- **Render Engine**: [LeaferJS](https://www.leaferjs.com) (HTML5 Canvas)
- **Build Tool**: [Vite](https://vitejs.dev) + [vite-plugin-singlefile](https://github.com/nickreese/vite-plugin-singlefile)
- **Language**: TypeScript
- **Output**: Single self-contained HTML file

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production (outputs to dist/online-gencad-viewer.html)
npm run build

# Preview production build
npm run preview
```

## Usage

1. Open the page and click "Open File" or drag-and-drop a `.cad` file onto the page
2. Use the right-side layer panel to show/hide individual layers
3. Use the top filter buttons to toggle element types
4. Search and click components or nets in the left panel to highlight and locate them
5. Click on the canvas to exit highlight mode
6. Scroll to zoom, left/right-click drag to pan

## Project Structure

```
src/
├── parser/          # GenCAD file parser
│   ├── index.ts     # Main parsing logic
│   ├── types.ts     # Data type definitions
│   └── units.ts     # Unit conversion
├── renderer/        # LeaferJS renderer
│   ├── index.ts     # Render entry, layer assembly
│   ├── board-renderer.ts      # Board outline rendering
│   ├── route-renderer.ts      # Route/via rendering
│   ├── component-renderer.ts  # Component/pad/silkscreen rendering
│   ├── primitives.ts          # Primitive conversion utilities
│   └── colors.ts              # Layer color definitions
├── ui/              # User interface
│   ├── layout.ts    # Layout, toolbar, i18n
│   ├── file-picker.ts         # File loading
│   ├── layer-controls.ts      # Layer/filter controls
│   ├── left-panel.ts          # Component/net lists
│   └── property-panel.ts      # Property panel
└── main.ts          # App entry, interaction logic
```

## Author

[EasyEDA](https://easyeda.com)

## License

MIT
