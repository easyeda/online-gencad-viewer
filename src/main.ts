import './style.css';
import { createLayout, t, onLangChange } from './ui/layout';
import { setupFilePicker } from './ui/file-picker';
import { showProperties, clearProperties } from './ui/property-panel';
import { populateComponentList, populateNetList } from './ui/left-panel';
import { initLayerControls, initFilterControls } from './ui/layer-controls';
import { parseGenCAD } from './parser';
import { renderAll, RenderResult } from './renderer';
import type { GenCADData } from './parser/types';
import { Group, UI, Leafer } from 'leafer-ui';
import sampleCad from '../docs/lckfb.cad?raw';

const layout = createLayout();
let renderResult: RenderResult | null = null;
let currentData: GenCADData | null = null;
let refreshProps: (() => void) | null = null;

onLangChange(() => refreshProps?.());

function forceSyncRender(lf: Leafer | null) {
  if (!lf) return;
  const r = (lf as any).renderer;
  if (r) {
    r.totalTimes = 0;
    r.render();
  }
}

function loadFile(text: string, fileName: string) {
  layout.welcomeOverlay.style.display = 'none';
  layout.fileNameEl.textContent = fileName;

  try {
    currentData = parseGenCAD(text);
    renderResult = renderAll(layout.canvasDiv, currentData);

    refreshProps = null;
    clearProperties(layout.propertyContent);
    unhighlight();
    initLayerControls(layout.layerPanel, renderResult.layers);
    initFilterControls(layout.filterPanel, renderResult.layers);
    populatePanels();
  } catch (err) {
    console.error('Parse error:', err);
    layout.propertyContent.textContent = `解析错误: ${err}`;
  }
}

let compListHandle: { clearSelection: () => void } | null = null;
let netListHandle: { clearSelection: () => void } | null = null;

function populatePanels() {
  if (!currentData || !renderResult) return;

  compListHandle = populateComponentList(layout.compList, layout.compSearch, currentData.components, (comp) => {
    unhighlight();
    netListHandle?.clearSelection();
    if (renderResult) {
      // Pan to component position
      const leafer = renderResult.leafer;
      const zl = leafer.zoomLayer;
      const scale = zl.scaleX || 1;
      const viewW = leafer.width! / scale;
      const viewH = leafer.height! / scale;
      const targetX = comp.x - viewW / 2;
      const targetY = -comp.y - viewH / 2;
      zl.x = -targetX * scale;
      zl.y = -targetY * scale;
    }
    highlightComponent(comp.name);
  });

  const routeMap = new Map<string, { vias: unknown[] }>();
  for (const route of currentData.routes) {
    routeMap.set(route.signalName, { vias: route.vias });
  }

  netListHandle = populateNetList(layout.netList, layout.netSearch, currentData.signals, routeMap, (name) => {
    unhighlight();
    compListHandle?.clearSelection();
    panToNetIfNeeded(name);
    highlightNet(name);
  });
}

// File picker
setupFilePicker(layout.btnOpen, layout.canvasContainer, loadFile, layout.welcomeOverlay);

// Sample file button
layout.sampleBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  loadFile(sampleCad, 'lckfb.cad');
});

// Click canvas to exit highlight mode
let pointerDownPos: { x: number; y: number } | null = null;
layout.canvasContainer.addEventListener('pointerdown', (e: PointerEvent) => {
  pointerDownPos = { x: e.clientX, y: e.clientY };
});
layout.canvasContainer.addEventListener('pointerup', (e: PointerEvent) => {
  if (!pointerDownPos) return;
  const dx = e.clientX - pointerDownPos.x;
  const dy = e.clientY - pointerDownPos.y;
  pointerDownPos = null;
  if (Math.abs(dx) < 5 && Math.abs(dy) < 5 && dimmedGroups.length > 0) {
    unhighlight();
    compListHandle?.clearSelection();
    netListHandle?.clearSelection();
  }
});

// Zoom / fit buttons
layout.btnZoomIn.addEventListener('click', () => {
  if (renderResult) {
    const l = renderResult.leafer;
    const zl = l.zoomLayer;
    const cur = zl.scaleX || 1;
    const next = cur * 1.5;
    const ratio = next / cur;
    const cx = l.width! / 2, cy = l.height! / 2;
    const newX = cx - (cx - (zl.x || 0)) * ratio;
    const newY = cy - (cy - (zl.y || 0)) * ratio;
    zl.x = newX;
    zl.y = newY;
    zl.scaleX = next;
    zl.scaleY = next;
  }
});
layout.btnZoomOut.addEventListener('click', () => {
  if (renderResult) {
    const l = renderResult.leafer;
    const zl = l.zoomLayer;
    const cur = zl.scaleX || 1;
    const next = Math.max(cur / 1.5, 0.01);
    const ratio = next / cur;
    const cx = l.width! / 2, cy = l.height! / 2;
    const newX = cx - (cx - (zl.x || 0)) * ratio;
    const newY = cy - (cy - (zl.y || 0)) * ratio;
    zl.x = newX;
    zl.y = newY;
    zl.scaleX = next;
    zl.scaleY = next;
  }
});
layout.btnFit.addEventListener('click', () => {
  if (renderResult) renderResult.leafer.zoom('fit');
});

// Highlight state
let dimmedGroups: { group: Group | UI; origOpacity: number | undefined }[] = [];

function unhighlight() {
  for (const item of dimmedGroups) {
    item.group.opacity = item.origOpacity ?? 1;
  }
  dimmedGroups = [];
  clearProperties(layout.propertyContent);
  refreshProps = null;
  if (renderResult) forceSyncRender(renderResult.leafer);
}

function dimGroup(group: Group | UI) {
  dimmedGroups.push({ group, origOpacity: group.opacity });
  group.opacity = 0.15;
}

function dimChildrenExcept(layer: Group, matchFn: (node: any) => boolean) {
  if (!layer.children) return;
  for (const child of layer.children) {
    if (!matchFn(child)) {
      dimGroup(child as Group);
    }
  }
}

function highlightComponent(name: string) {
  if (!renderResult) return;

  for (const [key, g] of renderResult.layers) {
    if (key === 'BOARD') continue;
    if (key.startsWith('PADS_') || key === 'TH_DRILLS') {
      dimChildrenExcept(g, (node: any) => node._component === name);
    } else if (key.startsWith('SILK_TEXT_') || key.startsWith('VALUE_TEXT_')) {
      dimChildrenExcept(g, (node: any) => node._component === name);
    } else if (key.startsWith('SILK_OUTLINE_')) {
      dimGroup(g);
    } else if (key.startsWith('ROUTE') || key === 'ROUTES_BOTTOM' || key === 'ROUTES' || key === 'ROUTES_TOP') {
      dimGroup(g);
    } else if (key === 'VIA_DRILLS' || key.startsWith('VIAS_')) {
      dimGroup(g);
    } else if (key.startsWith('LABELS_') || key.startsWith('PAD_LABELS_') || key === 'BOARD_TEXTS' || key === 'ROUTE_TEXTS') {
      dimGroup(g);
    } else {
      dimGroup(g);
    }
  }

  // Show properties
  if (currentData) {
    const comp = currentData.components.find(c => c.name === name);
    if (comp) {
      refreshProps = () => {
        showProperties(layout.propertyContent, {
          [t('propComp')]: comp.name,
          [t('propDevice')]: comp.device,
          [t('propPackage')]: comp.shapeName,
          [t('propLayer')]: comp.layer,
          [t('propRotation')]: comp.rotation + '°',
          [t('propPosition')]: `(${comp.x.toFixed(4)}, ${comp.y.toFixed(4)})`,
        });
      };
      refreshProps();
    }
  }
  forceSyncRender(renderResult.leafer);
}

function highlightNet(signalName: string) {
  if (!renderResult) return;

  // Build set of "comp.pin" keys connected to this net
  const connectedPins = new Set<string>();
  if (currentData) {
    const sig = currentData.signals.get(signalName);
    if (sig) {
      for (const node of sig.nodes) connectedPins.add(`${node.componentName}.${node.pinName}`);
    }
  }

  for (const [key, g] of renderResult.layers) {
    if (key === 'BOARD') continue;
    // Skip container groups — their children are processed via ROUTE_ keys
    if (key === 'ROUTES_BOTTOM' || key === 'ROUTES' || key === 'ROUTES_TOP') continue;
    if (key.startsWith('ROUTE_')) {
      dimChildrenExcept(g, (node: any) => node._signal === signalName);
    } else if (key.startsWith('VIAS_') || key === 'VIA_DRILLS') {
      dimChildrenExcept(g, (node: any) => node._signal === signalName);
    } else if (key.startsWith('PADS_')) {
      dimChildrenExcept(g, (node: any) => {
        const pinKey = `${node._component}.${node._pin}`;
        return connectedPins.has(pinKey);
      });
    } else if (key.startsWith('LABELS_')) {
      // keep route net name labels visible
    } else if (key.startsWith('PAD_LABELS_') || key === 'BOARD_TEXTS' || key === 'ROUTE_TEXTS') {
      dimGroup(g);
    } else {
      dimGroup(g);
    }
  }

  // Show net properties
  if (currentData) {
    const sig = currentData.signals.get(signalName);
    if (sig) {
      refreshProps = () => {
        const nodes = sig.nodes.map(n => `${n.componentName}.${n.pinName}`).join(', ');
        showProperties(layout.propertyContent, {
          [t('propSignal')]: signalName,
          [t('propNodeCount')]: sig.nodes.length,
          [t('propNodes')]: nodes.length > 100 ? nodes.substring(0, 100) + '...' : nodes,
        });
      };
      refreshProps();
    }
  }
  forceSyncRender(renderResult.leafer);
}

function panToNetIfNeeded(signalName: string) {
  if (!renderResult || !currentData) return;

  // Compute bounding box of the net in world coordinates
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  function expand(x: number, y: number) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }

  // Route segments
  const route = currentData.routes.find(r => r.signalName === signalName);
  if (route) {
    for (const seg of route.segments) {
      for (const p of seg.primitives) {
        if (p.type === 'LINE') { expand(p.x1, -p.y1); expand(p.x2, -p.y2); }
        else if (p.type === 'ARC') { expand(p.xs, -p.ys); expand(p.xe, -p.ye); }
        else if (p.type === 'CIRCLE') { expand(p.xc - p.r, -(p.yc + p.r)); expand(p.xc + p.r, -(p.yc - p.r)); }
      }
    }
    for (const via of route.vias) {
      expand(via.x, -via.y);
    }
  }

  // Connected component pins
  const sig = currentData.signals.get(signalName);
  if (sig) {
    for (const node of sig.nodes) {
      const comp = currentData.components.find(c => c.name === node.componentName);
      if (comp) {
        expand(comp.x, -comp.y);
      }
    }
  }

  if (!isFinite(minX)) return;

  // Check if center of net bbox is in visible area
  const leafer = renderResult.leafer;
  const zl = leafer.zoomLayer;
  const scale = zl.scaleX || 1;
  const viewW = leafer.width! / scale;
  const viewH = leafer.height! / scale;
  const viewLeft = -(zl.x || 0) / scale;
  const viewTop = -(zl.y || 0) / scale;
  const viewRight = viewLeft + viewW;
  const viewBottom = viewTop + viewH;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  if (cx >= viewLeft && cx <= viewRight && cy >= viewTop && cy <= viewBottom) return;

  // Pan to center the net bbox
  zl.x = -(cx - viewW / 2) * scale;
  zl.y = -(cy - viewH / 2) * scale;
}

export function refreshProperties() {
  refreshProps?.();
}
