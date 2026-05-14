import type { GenCADData, RenderStyle } from '../parser/types';
import { Leafer, Group } from 'leafer-ui';
import '@leafer-in/view';
import { addViewport, addViewportConfig } from '@leafer-in/viewport';
import { renderBoard } from './board-renderer';
import { renderRoutes } from './route-renderer';
import { renderComponents } from './component-renderer';

export interface RenderResult {
  leafer: Leafer;
  layers: Map<string, Group>;
  style: RenderStyle;
}

export function renderAll(container: HTMLDivElement, data: GenCADData): RenderResult {
  container.innerHTML = '';

  const leafer = new Leafer({
    view: container,
    fill: '#1a1a2e',
    type: 'design',
  });

  // Enable viewport optimization for better zoom/pan performance
  addViewportConfig(leafer, {
    wheel: { preventDefault: false },
    pointer: { preventDefaultMenu: true },
    zoom: { min: 0.01, max: 256 },
  });

  // Compute board bbox for adaptive sizing
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  function expand(x: number, y: number) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  for (const p of data.board.outline) {
    switch (p.type) {
      case 'LINE': expand(p.x1, p.y1); expand(p.x2, p.y2); break;
      case 'ARC': expand(p.xs, p.ys); expand(p.xe, p.ye); break;
      case 'CIRCLE': expand(p.xc - p.r, p.yc - p.r); expand(p.xc + p.r, p.yc + p.r); break;
      case 'RECTANGLE': expand(p.x, p.y); expand(p.x + p.w, p.y + p.h); break;
    }
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 10; maxY = 10; }

  const bw = maxX - minX;
  const bh = maxY - minY;
  const minDim = Math.min(bw, bh) || 1;
  const lineWidth = minDim * 0.002;
  const labelFontSize = minDim * 0.015;
  const style: RenderStyle = { lineWidth, labelFontSize };

  const layers = new Map<string, Group>();

  const boardGroup = new Group();
  layers.set('BOARD', boardGroup);
  leafer.add(boardGroup);

  const boardTextGroup = renderBoard(data.board, boardGroup, style);

  performance.mark('gc:render-routes-start');
  const { layerGroups: routeLayerGroups, viaPadGroups, viaDrillGroup, labelGroups, routeTextGroup } = renderRoutes(data.routes, data.pads, style, data.padstacks);
  performance.mark('gc:render-routes-end');
  performance.measure('gc:render-routes', 'gc:render-routes-start', 'gc:render-routes-end');

  performance.mark('gc:render-comps-start');
  const { compGroup, padGroups, padLabelGroups, silkOutlineGroups, silkTextGroups, valueTextGroups, thDrillGroup, thPadLabelGroup } = renderComponents(
    data.components, data.shapes, data.pads, data.padstacks, style, data.signals, data.artworks
  );
  performance.mark('gc:render-comps-end');
  performance.measure('gc:render-comps', 'gc:render-comps-start', 'gc:render-comps-end');

  // Assemble in visual stacking order (back → front)
  // Board texts
  if (boardTextGroup.children && boardTextGroup.children.length > 0) {
    layers.set('BOARD_TEXTS', boardTextGroup);
    leafer.add(boardTextGroup);
  }

  // Collect all layer names sorted BOTTOM → INNER → TOP
  const allLayerSet = new Set<string>();
  for (const name of routeLayerGroups.keys()) allLayerSet.add(name);
  for (const name of padGroups.keys()) allLayerSet.add(name);
  const allLayerNames = [...allLayerSet].sort((a, b) => routeLayerOrder(a) - routeLayerOrder(b));

  // Per-layer: routes → labels → pads → pad_labels (interleaved so upper-layer content covers lower-layer labels)
  for (const layerName of allLayerNames) {
    // Routes
    const routeGroup = routeLayerGroups.get(layerName);
    if (layerName === 'BOTTOM') {
      const routesBottom = new Group();
      layers.set('ROUTES_BOTTOM', routesBottom);
      if (routeGroup) { routesBottom.add(routeGroup); layers.set('ROUTE_BOTTOM', routeGroup); }
      leafer.add(routesBottom);
    } else if (layerName === 'TOP') {
      const routesTop = new Group();
      layers.set('ROUTES_TOP', routesTop);
      if (routeGroup) { routesTop.add(routeGroup); layers.set('ROUTE_TOP', routeGroup); }
      leafer.add(routesTop);
    } else {
      if (routeGroup) { layers.set(`ROUTE_${layerName}`, routeGroup); leafer.add(routeGroup); }
    }

    // Route labels
    const lbl = labelGroups.get(layerName);
    if (lbl && lbl.children && lbl.children.length > 0) {
      layers.set(`LABELS_${layerName}`, lbl);
      leafer.add(lbl);
    }

    // Pads
    const padGroup = padGroups.get(layerName);
    if (padGroup) { layers.set(`PADS_${layerName}`, padGroup); leafer.add(padGroup); }

    // Pad labels
    const plbl = padLabelGroups.get(layerName);
    if (plbl && plbl.children && plbl.children.length > 0) {
      layers.set(`PAD_LABELS_${layerName}`, plbl);
      leafer.add(plbl);
    }

    // Bottom silk (after bottom pads/labels)
    if (layerName === 'BOTTOM') {
      const silkOutlineBottom = silkOutlineGroups.get('SILKSCREEN_BOTTOM');
      if (silkOutlineBottom) { layers.set('SILK_OUTLINE_BOTTOM', silkOutlineBottom); leafer.add(silkOutlineBottom); }
      const silkTextBottom = silkTextGroups.get('SILKSCREEN_BOTTOM');
      if (silkTextBottom) { layers.set('SILK_TEXT_BOTTOM', silkTextBottom); leafer.add(silkTextBottom); }
      const valueTextBottom = valueTextGroups.get('SILKSCREEN_BOTTOM');
      if (valueTextBottom) { layers.set('VALUE_TEXT_BOTTOM', valueTextBottom); leafer.add(valueTextBottom); }
    }
  }

  // Component outlines
  layers.set('COMPONENTS', compGroup);
  leafer.add(compGroup);

  // Top silkscreen
  const silkOutlineTop = silkOutlineGroups.get('SILKSCREEN_TOP');
  if (silkOutlineTop) { layers.set('SILK_OUTLINE_TOP', silkOutlineTop); leafer.add(silkOutlineTop); }
  const silkTextTop = silkTextGroups.get('SILKSCREEN_TOP');
  if (silkTextTop) { layers.set('SILK_TEXT_TOP', silkTextTop); leafer.add(silkTextTop); }
  const valueTextTop = valueTextGroups.get('SILKSCREEN_TOP');
  if (valueTextTop) { layers.set('VALUE_TEXT_TOP', valueTextTop); leafer.add(valueTextTop); }

  // TH drills (after silk, before vias — visible through all layers)
  layers.set('TH_DRILLS', thDrillGroup);
  leafer.add(thDrillGroup);

  // TH pad labels (above drills so they're not covered)
  if (thPadLabelGroup.children && thPadLabelGroup.children.length > 0) {
    layers.set('TH_PAD_LABELS', thPadLabelGroup);
    leafer.add(thPadLabelGroup);
  }

  // Via pads (per-layer, sorted BOTTOM → INNER → TOP)
  const sortedViaEntries = [...viaPadGroups.entries()].sort((a, b) => routeLayerOrder(a[0]) - routeLayerOrder(b[0]));
  for (const [viaLayer, viaGroup] of sortedViaEntries) {
    const key = `VIAS_${viaLayer}`;
    layers.set(key, viaGroup);
    leafer.add(viaGroup);
  }

  // Via drills
  layers.set('VIA_DRILLS', viaDrillGroup);
  leafer.add(viaDrillGroup);

  // Route texts (frontmost)
  if (routeTextGroup.children && routeTextGroup.children.length > 0) {
    layers.set('ROUTE_TEXTS', routeTextGroup);
    leafer.add(routeTextGroup);
  }

  // Fit view to board bounds - use leafer.zoom for proper coordinate handling
  const pad = Math.max(bw, bh) * 0.05;

  performance.mark('gc:render-assemble-end');
  performance.mark('gc:render-zoom-start');

  // Calculate initial scale
  const scaleX = container.clientWidth / (bw + pad * 2);
  const scaleY = container.clientHeight / (bh + pad * 2);
  const initScale = Math.min(scaleX, scaleY);

  // Store initial bounds for fit view
  (leafer as any).__fitBounds = { x: minX - pad, y: -(maxY + pad), width: bw + pad * 2, height: bh + pad * 2 };
  (leafer as any).__fitScale = initScale;

  // Set transform using zoom() for proper coordinate handling
  leafer.zoom({
    x: minX - pad,
    y: -(maxY + pad),
    width: bw + pad * 2,
    height: bh + pad * 2,
  });
  performance.mark('gc:render-zoom-end');
  performance.measure('gc:render-zoom', 'gc:render-zoom-start', 'gc:render-zoom-end');
  performance.mark('gc:render-all-end');
  performance.measure('gc:render-all', 'gc:render-start', 'gc:render-all-end');

  // Log rendering stats
  const parseMs = performance.getEntriesByName('gc:parse')[0]?.duration || 0;
  const routesMs = performance.getEntriesByName('gc:render-routes')[0]?.duration || 0;
  const compsMs = performance.getEntriesByName('gc:render-comps')[0]?.duration || 0;
  const zoomMs = performance.getEntriesByName('gc:render-zoom')[0]?.duration || 0;
  const totalMs = performance.getEntriesByName('gc:render-all')[0]?.duration || 0;
  console.log(`[GC Perf] 渲染统计: 解析=${parseMs.toFixed(0)}ms, 走线=${routesMs.toFixed(0)}ms, 元件=${compsMs.toFixed(0)}ms, 缩放=${zoomMs.toFixed(0)}ms, 总计=${totalMs.toFixed(0)}ms`);

  // Count elements
  let elemCount = 0;
  for (const g of layers.values()) elemCount += (g.children?.length || 0);
  console.log(`[GC Perf] 图层数=${layers.size}, 图元数=${elemCount}, 走线数=${data.routes.length}`);

  // Manual wheel zoom (directly set zoomLayer transform to zoom around cursor)
  container.addEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.35 : 1 / 1.35;
    const zl = leafer.zoomLayer;
    const cur = zl.scaleX || 1;
    const next = Math.max(cur * factor, 0.01);
    if (next === cur) return;
    const rect = container.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const ratio = next / cur;
    const newX = sx - (sx - (zl.x || 0)) * ratio;
    const newY = sy - (sy - (zl.y || 0)) * ratio;
    zl.x = newX;
    zl.y = newY;
    zl.scaleX = next;
    zl.scaleY = next;
  }, { passive: false });

  // Prevent right-click context menu
  container.addEventListener('contextmenu', (e: MouseEvent) => e.preventDefault());

  // Manual drag-to-pan (left and right button)
  let dragging = false;
  let lastX = 0, lastY = 0;

  container.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button === 0 || e.button === 2) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      container.setPointerCapture(e.pointerId);
      container.style.cursor = 'grabbing';
    }
  });
  container.addEventListener('pointermove', (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    const zl = leafer.zoomLayer;
    zl.x = (zl.x || 0) + dx;
    zl.y = (zl.y || 0) + dy;
  });
  const stopDrag = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    container.releasePointerCapture(e.pointerId);
    container.style.cursor = '';
  };
  container.addEventListener('pointerup', stopDrag);
  container.addEventListener('pointercancel', stopDrag);

  return { leafer, layers, style };
}

function routeLayerOrder(layer: string): number {
  if (layer === 'BOTTOM') return 0;
  if (layer.startsWith('INNER')) return 50 + (parseInt(layer.replace('INNER', '').replace('-', '')) || 0);
  if (layer === 'TOP') return 200;
  return 100;
}
