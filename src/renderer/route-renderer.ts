import type { RouteDef, PadDef, PadstackDef, RenderStyle } from '../parser/types';
import { Group, Ellipse, Text, Path } from 'leafer-ui';
import { primitiveToUI } from './primitives';
import { getLayerColor } from './colors';

export function renderRoutes(
  routes: RouteDef[],
  pads: Map<string, PadDef>,
  style: RenderStyle,
  padstacks?: Map<string, PadstackDef>
): { layerGroups: Map<string, Group>; viaPadGroups: Map<string, Group>; viaDrillGroup: Group; labelsGroup: Group; routeTextGroup: Group } {
  const sw = style.lineWidth;

  const viaPadGroups = new Map<string, Group>();
  const viaDrillGroup = new Group();
  const labelsGroup = new Group();
  const routeTextGroup = new Group();

  function getViaPadGroup(layer: string): Group {
    if (!viaPadGroups.has(layer)) {
      const g = new Group();
      (g as any)._layerName = layer;
      (g as any)._type = 'via-pad-layer';
      viaPadGroups.set(layer, g);
    }
    return viaPadGroups.get(layer)!;
  }

  // Collect unique layers
  const layerSet = new Set<string>();
  for (const route of routes) {
    for (const seg of route.segments) {
      if (seg.layer && seg.primitives.length > 0) layerSet.add(seg.layer);
    }
  }

  const layerGroups = new Map<string, Group>();
  for (const layer of layerSet) {
    const lg = new Group();
    (lg as any)._layerName = layer;
    (lg as any)._type = 'route-layer';
    layerGroups.set(layer, lg);
  }

  for (const route of routes) {
    for (const seg of route.segments) {
      if (seg.primitives.length === 0) continue;

      const color = getLayerColor(seg.layer);
      const trackSw = seg.width > 0 ? seg.width : sw;
      const segGroup = new Group();
      (segGroup as any)._type = 'route';
      (segGroup as any)._signal = route.signalName;
      (segGroup as any)._layer = seg.layer;

      for (const p of seg.primitives) {
        const el = primitiveToUI(p, color, trackSw);
        segGroup.add(el);
      }

      const targetGroup = layerGroups.get(seg.layer);
      if (targetGroup) targetGroup.add(segGroup);

      // Add net name label on longest LINE segment
      const lines = seg.primitives.filter(p => p.type === 'LINE') as { type: 'LINE'; x1: number; y1: number; x2: number; y2: number }[];
      if (lines.length > 0 && route.signalName) {
        let longest = lines[0];
        let maxLen = 0;
        for (const l of lines) {
          const len = Math.sqrt((l.x2 - l.x1) ** 2 + (l.y2 - l.y1) ** 2);
          if (len > maxLen) { maxLen = len; longest = l; }
        }
        const fontSize = trackSw * 0.95;
        if (maxLen > fontSize * route.signalName.length * 0.6) {
          const mx = (longest.x1 + longest.x2) / 2;
          const my = -(longest.y1 + longest.y2) / 2;
          let angle = Math.atan2(-(longest.y2 - longest.y1), longest.x2 - longest.x1) * 180 / Math.PI;
          if (angle > 90) angle -= 180;
          else if (angle < -90) angle += 180;
          const textEl = new Text({
            x: mx,
            y: my,
            text: route.signalName,
            fontSize,
            fill: '#ffffff',
            textAlign: 'center',
            verticalAlign: 'middle',
            rotation: angle,
          });
          (textEl as any)._class = 'route-label';
          labelsGroup.add(textEl);
        }
      }
    }

    // Vias
    for (const via of route.vias) {
      const pad = pads.get(via.padName);
      const viaR = pad ? getMaxRadius(pad) : via.drillSize * 0.8;

      let viaLayers: string[] = [];
      if (padstacks) {
        const ps = padstacks.get(via.padName);
        if (ps) viaLayers = ps.pads.map(p => p.layer);
      }
      if (viaLayers.length === 0) viaLayers = ['TOP', 'BOTTOM'];

      for (const viaLayer of viaLayers) {
        const layerColor = getLayerColor(viaLayer);

        const viaEl = new Ellipse({
          x: via.x - viaR,
          y: -via.y - viaR,
          width: viaR * 2,
          height: viaR * 2,
          fill: layerColor,
        });
        (viaEl as any)._type = 'via';
        (viaEl as any)._signal = route.signalName;
        getViaPadGroup(viaLayer).add(viaEl);
      }

      // Drill hole
      if (via.drillSize > 0) {
        const drillR = via.drillSize / 2;
        const hole = new Ellipse({
          x: via.x - drillR,
          y: -via.y - drillR,
          width: via.drillSize,
          height: via.drillSize,
          fill: '#1a1a2e',
        });
        (hole as any)._type = 'via';
        (hole as any)._signal = route.signalName;
        viaDrillGroup.add(hole);
      }
    }
  }

  // Route-level TEXT
  for (const route of routes) {
    for (const txt of route.texts) {
      const textEl = new Text({
        x: txt.x,
        y: -txt.y,
        text: txt.str,
        fontSize: txt.size,
        fill: '#ffffff',
        textAlign: 'center',
        verticalAlign: 'middle',
        rotation: txt.rot ? -txt.rot : 0,
      });
      routeTextGroup.add(textEl);
    }
  }

  return { layerGroups, viaPadGroups, viaDrillGroup, labelsGroup, routeTextGroup };
}

function getMaxRadius(pad: PadDef): number {
  let maxR = 0;
  for (const p of pad.primitives) {
    if (p.type === 'CIRCLE') maxR = Math.max(maxR, p.r);
    else if (p.type === 'RECTANGLE') maxR = Math.max(maxR, Math.sqrt(p.w * p.w + p.h * p.h) / 2);
  }
  return maxR > 0 ? maxR : 0.15;
}
