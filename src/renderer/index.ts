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

  const { layerGroups: routeLayerGroups, viaPadGroups, viaDrillGroup, labelGroups, routeTextGroup } = renderRoutes(data.routes, data.pads, style, data.padstacks);

  const { compGroup, padGroups, padLabelGroups, silkOutlineGroups, silkTextGroups, valueTextGroups, thDrillGroup, thPadLabelGroup } = renderComponents(
    data.components, data.shapes, data.pads, data.padstacks, style, data.signals, data.artworks
  );

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

  // Fit view to board bounds
  const pad = Math.max(bw, bh) * 0.05;
  leafer.zoom({
    x: minX - pad,
    y: -(maxY + pad),
    width: bw + pad * 2,
    height: bh + pad * 2,
  });

  // Performance: throttle wheel zoom with requestAnimationFrame
  let rafId: number | null = null;
  let pendingWheel: WheelEvent | null = null;

  container.addEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault();
    pendingWheel = e;
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      const we = pendingWheel!;
      pendingWheel = null;
      const factor = we.deltaY < 0 ? 1.35 : 1 / 1.35;
      const zl = leafer.zoomLayer;
      const cur = zl.scaleX || 1;
      const next = Math.max(cur * factor, 0.01);
      if (next === cur) return;
      const rect = container.getBoundingClientRect();
      const sx = we.clientX - rect.left;
      const sy = we.clientY - rect.top;
      const ratio = next / cur;
      const newX = sx - (sx - (zl.x || 0)) * ratio;
      const newY = sy - (sy - (zl.y || 0)) * ratio;
      zl.x = newX;
      zl.y = newY;
      zl.scaleX = next;
      zl.scaleY = next;
    });
  }, { passive: false });

  // Prevent right-click context menu
  container.addEventListener('contextmenu', (e: MouseEvent) => e.preventDefault());

  // Performance: throttle drag-to-pan with requestAnimationFrame
  let dragging = false;
  let lastX = 0, lastY = 0;
  let panRafId: number | null = null;
  let pendingDx = 0, pendingDy = 0;

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
    pendingDx += e.clientX - lastX;
    pendingDy += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    if (panRafId) return;
    panRafId = requestAnimationFrame(() => {
      panRafId = null;
      const zl = leafer.zoomLayer;
      zl.x = (zl.x || 0) + pendingDx;
      zl.y = (zl.y || 0) + pendingDy;
      pendingDx = 0;
      pendingDy = 0;
    });
  });
  const stopDrag = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    if (panRafId) { cancelAnimationFrame(panRafId); panRafId = null; }
    pendingDx = 0;
    pendingDy = 0;
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
