import type { GenCADData, RenderStyle } from '../parser/types';
import { Leafer, Group } from 'leafer-ui';
import '@leafer-in/view';
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

  // Layer groups in stacking order (back to front)
  const layers = new Map<string, Group>();

  const boardGroup = new Group();
  layers.set('BOARD', boardGroup);
  leafer.add(boardGroup);

  // Render board
  const boardTextGroup = renderBoard(data.board, boardGroup, style);

  // Render routes
  const { layerGroups: routeLayerGroups, viaPadGroups, viaDrillGroup, labelsGroup, routeTextGroup } = renderRoutes(data.routes, data.pads, style, data.padstacks);

  // Render components
  const { compGroup, padGroups, silkOutlineGroups, silkTextGroups, valueTextGroups, thDrillGroup, padLabelsGroup } = renderComponents(
    data.components, data.shapes, data.pads, data.padstacks, style, data.signals, data.artworks
  );

  // Assemble in visual stacking order (back → front)
  // 1. Board (backmost)
  // Already added above

  // Board texts
  if (boardTextGroup.children && boardTextGroup.children.length > 0) {
    layers.set('BOARD_TEXTS', boardTextGroup);
    leafer.add(boardTextGroup);
  }

  // 2. Bottom routes
  const routesBottom = new Group();
  layers.set('ROUTES_BOTTOM', routesBottom);
  const botRoute = routeLayerGroups.get('BOTTOM');
  if (botRoute) { routesBottom.add(botRoute); layers.set('ROUTE_BOTTOM', botRoute); }
  leafer.add(routesBottom);

  // 3. Bottom pads
  const padsBottom = padGroups.get('BOTTOM');
  if (padsBottom) { layers.set('PADS_BOTTOM', padsBottom); leafer.add(padsBottom); }

  // 4. Bottom silkscreen
  const silkOutlineBottom = silkOutlineGroups.get('SILKSCREEN_BOTTOM');
  if (silkOutlineBottom) { layers.set('SILK_OUTLINE_BOTTOM', silkOutlineBottom); leafer.add(silkOutlineBottom); }
  const silkTextBottom = silkTextGroups.get('SILKSCREEN_BOTTOM');
  if (silkTextBottom) { layers.set('SILK_TEXT_BOTTOM', silkTextBottom); leafer.add(silkTextBottom); }
  const valueTextBottom = valueTextGroups.get('SILKSCREEN_BOTTOM');
  if (valueTextBottom) { layers.set('VALUE_TEXT_BOTTOM', valueTextBottom); leafer.add(valueTextBottom); }

  // 5. Inner routes
  const routeContainer = new Group();
  layers.set('ROUTES', routeContainer);
  const innerRouteEntries = [...routeLayerGroups.entries()]
    .filter(([name]) => name.startsWith('INNER'))
    .sort((a, b) => routeLayerOrder(a[0]) - routeLayerOrder(b[0]));
  for (const [name, group] of innerRouteEntries) {
    routeContainer.add(group);
    layers.set(`ROUTE_${name}`, group);
  }
  leafer.add(routeContainer);

  // Inner pads
  const innerPadKeys = [...padGroups.keys()].filter(k => k.startsWith('INNER')).sort();
  for (const key of innerPadKeys) {
    const pg = padGroups.get(key)!;
    layers.set(`PADS_${key}`, pg);
    leafer.add(pg);
  }

  // 6. Top routes
  const routesTop = new Group();
  layers.set('ROUTES_TOP', routesTop);
  const topRoute = routeLayerGroups.get('TOP');
  if (topRoute) { routesTop.add(topRoute); layers.set('ROUTE_TOP', topRoute); }
  leafer.add(routesTop);

  // 7. Top pads
  const padsTop = padGroups.get('TOP');
  if (padsTop) { layers.set('PADS_TOP', padsTop); leafer.add(padsTop); }

  // Component outlines
  layers.set('COMPONENTS', compGroup);
  leafer.add(compGroup);

  // 8. Top silkscreen
  const silkOutlineTop = silkOutlineGroups.get('SILKSCREEN_TOP');
  if (silkOutlineTop) { layers.set('SILK_OUTLINE_TOP', silkOutlineTop); leafer.add(silkOutlineTop); }
  const silkTextTop = silkTextGroups.get('SILKSCREEN_TOP');
  if (silkTextTop) { layers.set('SILK_TEXT_TOP', silkTextTop); leafer.add(silkTextTop); }
  const valueTextTop = valueTextGroups.get('SILKSCREEN_TOP');
  if (valueTextTop) { layers.set('VALUE_TEXT_TOP', valueTextTop); leafer.add(valueTextTop); }

  // 9. TH drills
  layers.set('TH_DRILLS', thDrillGroup);
  leafer.add(thDrillGroup);

  // Via pads (per-layer, follows layer visibility)
  for (const [viaLayer, viaGroup] of viaPadGroups) {
    const key = `VIAS_${viaLayer}`;
    layers.set(key, viaGroup);
    leafer.add(viaGroup);
  }

  // Via drills
  layers.set('VIA_DRILLS', viaDrillGroup);
  leafer.add(viaDrillGroup);

  // 10. Labels (frontmost, above drills)
  // Route texts
  if (routeTextGroup.children && routeTextGroup.children.length > 0) {
    layers.set('ROUTE_TEXTS', routeTextGroup);
    leafer.add(routeTextGroup);
  }

  layers.set('LABELS', labelsGroup);
  leafer.add(labelsGroup);

  // Pad labels (pin net names)
  layers.set('PAD_LABELS', padLabelsGroup);
  leafer.add(padLabelsGroup);

  // Fit view to board bounds
  const pad = Math.max(bw, bh) * 0.05;
  leafer.zoom({
    x: minX - pad,
    y: -(maxY + pad),
    width: bw + pad * 2,
    height: bh + pad * 2,
  });

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
