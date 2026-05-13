import { t } from './layout';
import { Group, Leafer } from 'leafer-ui';

function getLeafer(layers: Map<string, Group>): Leafer | null {
  const g = layers.values().next().value;
  return g ? (g as any).leafer : null;
}

function forceSyncRender(lf: Leafer | null) {
  if (!lf) return;
  const r = (lf as any).renderer;
  if (r) {
    r.totalTimes = 0;
    r.render();
  }
}

function setGroupVis(g: Group, v: boolean) {
  g.visible = v;
  updateOpacityRecursive(g);
}

function updateOpacityRecursive(node: any) {
  node.__updateWorldOpacity?.();
  if (node.isBranch && node.children) {
    for (const child of node.children) {
      updateOpacityRecursive(child);
    }
  }
}

export function initLayerControls(panel: HTMLElement, layers: Map<string, Group>) {
  panel.innerHTML = `<div style="color:var(--gc-fg2);margin-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">${t('layers')}</div>`;

  const layerDefs: { key: string; name: string; type: string }[] = [];

  // Discover route layers
  for (const [key, group] of layers) {
    if (key.startsWith('ROUTE_') && !key.startsWith('ROUTES_')) {
      const layerName = key.replace('ROUTE_', '');
      layerDefs.push({ key, name: formatLayerName(layerName), type: 'route' });
    }
  }

  // Silkscreen layers (outlines)
  if (layers.has('SILK_OUTLINE_TOP')) layerDefs.push({ key: 'SILK_OUTLINE_TOP', name: formatLayerName('SILKSCREEN_TOP'), type: 'silk' });
  if (layers.has('SILK_OUTLINE_BOTTOM')) layerDefs.push({ key: 'SILK_OUTLINE_BOTTOM', name: formatLayerName('SILKSCREEN_BOTTOM'), type: 'silk' });

  // Board
  if (layers.has('BOARD')) layerDefs.push({ key: 'BOARD', name: formatLayerName('BOARD'), type: 'board' });

  // TH Drills
  if (layers.has('TH_DRILLS')) layerDefs.push({ key: 'TH_DRILLS', name: t('drills'), type: 'drill' });

  if (layerDefs.length === 0) {
    const msg = document.createElement('div');
    msg.style.cssText = 'color:var(--gc-fg2);font-size:11px;';
    msg.textContent = t('noLayers');
    panel.appendChild(msg);
    return;
  }

  layerDefs.sort((a, b) => layerSortKey(a.key) - layerSortKey(b.key));

  // "All layers" toggle
  const allRow = document.createElement('div');
  allRow.style.cssText = 'display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer;font-size:11px;user-select:none;border-bottom:1px solid var(--gc-border);margin-bottom:4px;padding-bottom:6px;';

  const allEye = document.createElement('span');
  allEye.textContent = '\u{1F441}';
  allEye.style.cssText = 'font-size:13px;opacity:1;';

  const allLabel = document.createElement('span');
  allLabel.textContent = t('allLayers');
  allLabel.style.color = 'var(--gc-fg)';

  allRow.append(allEye, allLabel);

  let allVisible = true;
  const layerToggles: { setVisible: (v: boolean) => void }[] = [];

  allRow.onclick = () => {
    allVisible = !allVisible;
    allEye.style.opacity = allVisible ? '1' : '0.3';
    allLabel.style.color = allVisible ? 'var(--gc-fg)' : 'var(--gc-fg2)';
    for (const lt of layerToggles) lt.setVisible(allVisible);
  };
  panel.appendChild(allRow);

  for (const layerDef of layerDefs) {
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer;font-size:11px;user-select:none;';

    const eye = document.createElement('span');
    eye.textContent = '\u{1F441}';
    eye.style.cssText = 'font-size:13px;opacity:1;';

    const label = document.createElement('span');
    label.textContent = layerDef.name;
    label.style.color = 'var(--gc-fg)';

    el.append(eye, label);

    let visible = true;
    function updateUI() {
      const lf = getLeafer(layers);
      const group = layers.get(layerDef.key);
      if (group) setGroupVis(group, visible);

      eye.style.opacity = visible ? '1' : '0.3';
      label.style.color = visible ? 'var(--gc-fg)' : 'var(--gc-fg2)';

      // Route layer also toggles corresponding pad group and via group
      if (layerDef.type === 'route') {
        const routeLayer = layerDef.key.replace('ROUTE_', '');
        const padKey = `PADS_${routeLayer}`;
        const padGroup = layers.get(padKey);
        if (padGroup) setGroupVis(padGroup, visible);
        const viaKey = `VIAS_${routeLayer}`;
        const viaGroup = layers.get(viaKey);
        if (viaGroup) setGroupVis(viaGroup, visible);
      }
      // Silk outline also toggles silk text
      if (layerDef.key === 'SILK_OUTLINE_TOP') {
        const textGroup = layers.get('SILK_TEXT_TOP');
        if (textGroup) setGroupVis(textGroup, visible);
        const valueGroup = layers.get('VALUE_TEXT_TOP');
        if (valueGroup) setGroupVis(valueGroup, visible);
      }
      if (layerDef.key === 'SILK_OUTLINE_BOTTOM') {
        const textGroup = layers.get('SILK_TEXT_BOTTOM');
        if (textGroup) setGroupVis(textGroup, visible);
        const valueGroup = layers.get('VALUE_TEXT_BOTTOM');
        if (valueGroup) setGroupVis(valueGroup, visible);
      }
      // Drill layer also toggles via drills
      if (layerDef.key === 'TH_DRILLS') {
        const viaDrills = layers.get('VIA_DRILLS');
        if (viaDrills) setGroupVis(viaDrills, visible);
      }
      forceSyncRender(lf);
    }
    el.onclick = () => { visible = !visible; updateUI(); };
    layerToggles.push({ setVisible: (v: boolean) => { visible = v; updateUI(); } });

    panel.appendChild(el);
  }
}

function formatLayerName(layer: string): string {
  const map: Record<string, string> = {
    ROUTE_TOP: '顶层', ROUTE_BOTTOM: '底层',
    SILKSCREEN_TOP: '顶层丝印层', SILKSCREEN_BOTTOM: '底层丝印层',
    SILK_OUTLINE_TOP: '顶层丝印层', SILK_OUTLINE_BOTTOM: '底层丝印层',
    BOARD: '板框层', TOP: '顶层', BOTTOM: '底层',
  };
  if (map[layer]) return map[layer];
  if (layer.startsWith('ROUTE_INNER')) return '内层 ' + layer.replace('ROUTE_INNER', '').replace('-', '');
  if (layer.startsWith('INNER')) return '内层 ' + layer.replace('INNER', '').replace('-', '');
  return layer;
}

function layerSortKey(key: string): number {
  if (key === 'ROUTE_TOP') return 1;
  if (key === 'ROUTE_BOTTOM') return 8000;
  if (key === 'SILK_OUTLINE_TOP' || key === 'SILKSCREEN_TOP' || key === 'ROUTE_SILKSCREEN_TOP') return 8500;
  if (key === 'SILK_OUTLINE_BOTTOM' || key === 'SILKSCREEN_BOTTOM' || key === 'ROUTE_SILKSCREEN_BOTTOM') return 8600;
  if (key === 'TH_DRILLS') return 9000;
  if (key === 'BOARD') return 9999;
  if (key.includes('INNER')) {
    const n = parseInt(key.replace(/.*INNER-?/, ''), 10);
    return isNaN(n) ? 4000 : 100 + n;
  }
  return 4000;
}

export function initFilterControls(panel: HTMLElement, layers: Map<string, Group>) {
  panel.innerHTML = `<div style="color:var(--gc-fg2);margin-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">${t('filters')}</div>`;

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';

  const FILTER_DEFS = [
    { key: 'all', targets: ['all'], defaultActive: true },
    { key: 'routes', targets: ['ROUTES_BOTTOM', ...[...layers.keys()].filter(k => k.startsWith('ROUTE_INNER')), 'ROUTES_TOP'], defaultActive: true },
    { key: 'vias', targets: ['VIA_DRILLS', ...[...layers.keys()].filter(k => k.startsWith('VIAS_'))], defaultActive: true },
    { key: 'compFilter', targets: [
      'SILK_OUTLINE_TOP', 'SILK_OUTLINE_BOTTOM',
      'PADS_TOP', 'PADS_BOTTOM',
      'TH_DRILLS',
      ...[...layers.keys()].filter(k => k.startsWith('PADS_INNER')),
    ], defaultActive: true },
    { key: 'ref', targets: ['SILK_TEXT_TOP', 'SILK_TEXT_BOTTOM'], defaultActive: true },
    { key: 'value', targets: ['VALUE_TEXT_TOP', 'VALUE_TEXT_BOTTOM'], defaultActive: true },
    { key: 'labels', targets: ['TH_PAD_LABELS', ...[...layers.keys()].filter(k => k.startsWith('LABELS_') || k.startsWith('PAD_LABELS_'))], defaultActive: true },
  ];

  const states = new Map<string, boolean>();
  const lf = getLeafer(layers);

  function setGroupVisible(g: Group, v: boolean) {
    setGroupVis(g, v);
  }

  function applyFilter(targets: string[], visible: boolean) {
    if (targets[0] === 'all') {
      for (const f of FILTER_DEFS) {
        if (f.targets[0] !== 'all') {
          states.set(f.key, visible);
          for (const t of f.targets) {
            const g = layers.get(t);
            if (g) setGroupVisible(g, visible);
          }
        }
      }
      row.querySelectorAll('button').forEach(b => {
        const btn = b as HTMLButtonElement;
        btn.style.background = visible ? 'var(--gc-accent)' : 'var(--gc-btn)';
        btn.style.borderColor = visible ? 'var(--gc-accent-b)' : 'var(--gc-border2)';
        btn.style.color = visible ? '#fff' : 'var(--gc-fg2)';
      });
    } else {
      for (const target of targets) {
        const g = layers.get(target);
        if (g) setGroupVisible(g, visible);
      }
    }
    forceSyncRender(lf);
  }

  for (const filter of FILTER_DEFS) {
    const btn = document.createElement('button');
    btn.textContent = t(filter.key);
    btn.dataset.i18n = filter.key;
    btn.style.cssText = 'padding:3px 8px;background:var(--gc-accent);color:#fff;border:1px solid var(--gc-accent-b);border-radius:3px;cursor:pointer;font-size:12px;font-family:inherit;';
    let active = filter.defaultActive;
    states.set(filter.key, active);

    btn.onclick = () => {
      active = !active;
      states.set(filter.key, active);
      applyFilter(filter.targets, active);
      btn.style.background = active ? 'var(--gc-accent)' : 'var(--gc-btn)';
      btn.style.borderColor = active ? 'var(--gc-accent-b)' : 'var(--gc-border2)';
      btn.style.color = active ? '#fff' : 'var(--gc-fg2)';
    };

    row.appendChild(btn);
  }

  panel.appendChild(row);
}
