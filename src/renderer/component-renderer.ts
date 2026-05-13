import type { ComponentDef, ShapeDef, PadDef, PadstackDef, SignalDef, RenderStyle, GenCADPrimitive, ArtworkDef } from '../parser/types';
import { Group, Ellipse, Text } from 'leafer-ui';
import { primitiveToUI, primitivesToPath } from './primitives';
import { getLayerColor } from './colors';

export interface ComponentRenderResult {
  compGroup: Group;
  padGroups: Map<string, Group>;
  padLabelGroups: Map<string, Group>;
  silkOutlineGroups: Map<string, Group>;
  silkTextGroups: Map<string, Group>;
  valueTextGroups: Map<string, Group>;
  thDrillGroup: Group;
}

export function renderComponents(
  components: ComponentDef[],
  shapes: Map<string, ShapeDef>,
  pads: Map<string, PadDef>,
  padstacks: Map<string, PadstackDef>,
  style: RenderStyle,
  signals?: Map<string, SignalDef>,
  artworks?: Map<string, ArtworkDef>
): ComponentRenderResult {
  const compGroup = new Group();
  const sw = style.lineWidth;

  const pinSignalMap = new Map<string, string>();
  if (signals) {
    for (const [sigName, sig] of signals) {
      for (const node of sig.nodes) {
        pinSignalMap.set(`${node.componentName}.${node.pinName}`, sigName);
      }
    }
  }

  const thDrillGroup = new Group();
  const padLabelGroups = new Map<string, Group>();
  const padGroups = new Map<string, Group>();
  const silkOutlineGroups = new Map<string, Group>();
  const silkTextGroups = new Map<string, Group>();
  const valueTextGroups = new Map<string, Group>();

  function getPadGroup(layer: string): Group {
    if (!padGroups.has(layer)) {
      const pg = new Group();
      (pg as any)._layerName = layer;
      (pg as any)._type = 'pad-layer';
      padGroups.set(layer, pg);
    }
    return padGroups.get(layer)!;
  }

  function getPadLabelGroup(layer: string): Group {
    if (!padLabelGroups.has(layer)) {
      const lg = new Group();
      padLabelGroups.set(layer, lg);
    }
    return padLabelGroups.get(layer)!;
  }

  function getSilkOutlineGroup(layer: string): Group {
    if (!silkOutlineGroups.has(layer)) {
      const sg = new Group();
      (sg as any)._layerName = layer;
      (sg as any)._type = 'silk-outline';
      silkOutlineGroups.set(layer, sg);
    }
    return silkOutlineGroups.get(layer)!;
  }

  function getSilkTextGroup(layer: string): Group {
    if (!silkTextGroups.has(layer)) {
      const sg = new Group();
      (sg as any)._layerName = layer;
      (sg as any)._type = 'silk-text';
      silkTextGroups.set(layer, sg);
    }
    return silkTextGroups.get(layer)!;
  }

  function getValueTextGroup(layer: string): Group {
    if (!valueTextGroups.has(layer)) {
      const vg = new Group();
      (vg as any)._layerName = layer;
      (vg as any)._type = 'value-text';
      valueTextGroups.set(layer, vg);
    }
    return valueTextGroups.get(layer)!;
  }

  for (const comp of components) {
    const shape = shapes.get(comp.shapeName);
    if (!shape) continue;

    const padColor = getLayerColor(comp.layer);
    const silkLayer = comp.layer === 'BOTTOM' ? 'SILKSCREEN_BOTTOM' : 'SILKSCREEN_TOP';
    const outlineColor = getLayerColor(silkLayer);

    const compG = new Group();
    (compG as any)._type = 'component';
    (compG as any)._name = comp.name;
    (compG as any)._device = comp.device;
    (compG as any)._layer = comp.layer;

    // Component transform values
    const cx = comp.x;
    const cy = -comp.y;
    const rot = -comp.rotation;
    const mirrorX = comp.shapeMirror === 'MIRRORY';
    const mirrorY = comp.shapeMirror === 'MIRRORX';

    // Shape outline → silkscreen layer
    for (const p of shape.primitives) {
      const el = primitiveToUI(p, outlineColor, sw);
      const oWrap = new Group({
        x: cx,
        y: cy,
        rotation: rot,
        scaleX: mirrorX ? -1 : 1,
        scaleY: mirrorY ? -1 : 1,
      });
      oWrap.add(el);
      getSilkOutlineGroup(silkLayer).add(oWrap);
    }

    // Shape artwork references
    for (const awRef of shape.artworks) {
      const aw = artworks?.get(awRef.artworkName);
      if (!aw) continue;
      const awLayer = aw.layer || silkLayer;
      const awColor = getLayerColor(awLayer);
      const awWrap = new Group({
        x: cx,
        y: cy,
        rotation: rot,
        scaleX: mirrorX ? -1 : 1,
        scaleY: mirrorY ? -1 : 1,
      });
      const awInner = new Group({
        x: awRef.x,
        y: -awRef.y,
        rotation: awRef.rot ? -awRef.rot : 0,
        scaleX: awRef.mirror === 'MIRRORY' ? -1 : 1,
        scaleY: awRef.mirror === 'MIRRORX' ? -1 : 1,
      });
      for (const p of aw.primitives) {
        awInner.add(primitiveToUI(p, awColor, sw));
      }
      for (const txt of aw.texts) {
        const txtEl = new Text({
          x: txt.x,
          y: -txt.y,
          text: txt.str,
          fontSize: txt.size,
          fill: getLayerColor(txt.layer),
          textAlign: 'center',
          verticalAlign: 'middle',
          rotation: txt.rot ? -txt.rot : 0,
        });
        awInner.add(txtEl);
      }
      awWrap.add(awInner);
      getSilkOutlineGroup(awLayer).add(awWrap);
    }

    // Component-level artwork references
    for (const awRef of comp.artworks) {
      const aw = artworks?.get(awRef.artworkName);
      if (!aw) continue;
      const awLayer = aw.layer || silkLayer;
      const awColor = getLayerColor(awLayer);
      const awWrap = new Group({
        x: cx,
        y: cy,
        rotation: rot,
        scaleX: mirrorX ? -1 : 1,
        scaleY: mirrorY ? -1 : 1,
      });
      const awInner = new Group({
        x: awRef.x,
        y: -awRef.y,
        rotation: awRef.rot ? -awRef.rot : 0,
        scaleX: awRef.mirror === 'MIRRORY' ? -1 : 1,
        scaleY: awRef.mirror === 'MIRRORX' ? -1 : 1,
      });
      for (const p of aw.primitives) {
        awInner.add(primitiveToUI(p, awColor, sw));
      }
      for (const txt of aw.texts) {
        const txtEl = new Text({
          x: txt.x,
          y: -txt.y,
          text: txt.str,
          fontSize: txt.size,
          fill: getLayerColor(txt.layer),
          textAlign: 'center',
          verticalAlign: 'middle',
          rotation: txt.rot ? -txt.rot : 0,
        });
        awInner.add(txtEl);
      }
      awWrap.add(awInner);
      getSilkOutlineGroup(awLayer).add(awWrap);
    }

    // Pins
    for (const pin of shape.pins) {
      const ps = findPadstack(padstacks, pin.padName);
      const pinHasDrill = getDrillSize(pin.padName, pads, padstacks) > 0;
      const pinIsTH = pinHasDrill && ps && ps.pads.length > 1;

      if (pinIsTH && ps && ps.pads.length > 0) {
        for (const psPad of ps.pads) {
          const linkedPad = findPad(pads, psPad.padName);
          if (!linkedPad || linkedPad.primitives.length === 0) continue;

          let layerName = psPad.layer;
          if (comp.layer === 'BOTTOM') {
            if (layerName === 'TOP') layerName = 'BOTTOM';
            else if (layerName === 'BOTTOM') layerName = 'TOP';
          }

          const layerPadColor = getLayerColor(layerName);
          const hasLineArc = linkedPad.primitives.some(p => p.type === 'LINE' || p.type === 'ARC');

          let padEl;
          if (hasLineArc) {
            padEl = primitivesToPath(linkedPad.primitives, layerPadColor);
          } else {
            padEl = new Group();
            for (const pr of linkedPad.primitives) {
              (padEl as Group).add(primitiveToUI(pr, layerPadColor, sw * 0.3, true));
            }
          }

          const pinWrap = new Group({
            x: cx,
            y: cy,
            rotation: rot,
            scaleX: mirrorX ? -1 : 1,
            scaleY: mirrorY ? -1 : 1,
          });
          const pinInner = new Group({
            x: pin.x,
            y: -pin.y,
            rotation: pin.rot ? -pin.rot : 0,
          });
          if (psPad.rot) {
            const padWrap = new Group({ rotation: -psPad.rot });
            padWrap.add(padEl);
            pinInner.add(padWrap);
          } else {
            pinInner.add(padEl);
          }
          pinWrap.add(pinInner);
          (pinWrap as any)._type = 'pin';
          (pinWrap as any)._component = comp.name;
          (pinWrap as any)._pin = pin.pinName;
          getPadGroup(layerName).add(pinWrap);

          // Pin label on top layer only
          if (psPad === ps.pads[ps.pads.length - 1]) {
            const sigName = pinSignalMap.get(`${comp.name}.${pin.pinName}`) || '';
            const labelText = sigName ? `${pin.pinName}:${sigName}` : pin.pinName;
            const padSize = getPadSizeFromPrims(linkedPad.primitives);
            const padLong = getPadLongDim(linkedPad.primitives);
            const fontSize = Math.min(padLong, Math.max(Math.min(padSize * 0.8, padLong / Math.max(labelText.length * 0.6, 1)), padSize * 0.3));
            if (fontSize > 0) {
              const padAngle = getPadOrientation(linkedPad.primitives);
              const pos = toWorldPos(comp, pin.x, pin.y);
              const lblRot = toWorldRot(comp, padAngle + (pin.rot || 0));
              const lbl = new Text({
                x: pos.x,
                y: pos.y,
                text: labelText,
                fontSize,
                fill: '#fff',
                textAlign: 'center',
                verticalAlign: 'middle',
                rotation: lblRot,
              });
              getPadLabelGroup(layerName).add(lbl);
            }
          }
        }

        // TH drill holes
        const drill = getDrillSize(pin.padName, pads, padstacks);
        if (drill > 0) {
          const drillR = drill / 2;
          const holeWrap = new Group({
            x: cx,
            y: cy,
            rotation: rot,
            scaleX: mirrorX ? -1 : 1,
            scaleY: mirrorY ? -1 : 1,
          });
          const hole = new Ellipse({
            x: pin.x - drillR,
            y: -pin.y - drillR,
            width: drill,
            height: drill,
            fill: '#1a1a2e',
          });
          holeWrap.add(hole);
          (holeWrap as any)._component = comp.name;
          thDrillGroup.add(holeWrap);
        }
      } else {
        // SMD pad
        const resolvedPrims = resolvePadPrimitives(pin.padName, pads, padstacks);
        const pinWrap = new Group({
          x: cx,
          y: cy,
          rotation: rot,
          scaleX: mirrorX ? -1 : 1,
          scaleY: mirrorY ? -1 : 1,
        });
        const pinInner = new Group({
          x: pin.x,
          y: -pin.y,
          rotation: pin.rot ? -pin.rot : 0,
        });

        if (resolvedPrims.length > 0) {
          const groups = new Map<string, { rot: number; mirror: string; prims: GenCADPrimitive[] }>();
          for (const pp of resolvedPrims) {
            const key = `${pp.psRot}|${pp.psMirror}`;
            if (!groups.has(key)) groups.set(key, { rot: pp.psRot, mirror: pp.psMirror, prims: [] });
            groups.get(key)!.prims.push(pp.primitive);
          }
          for (const [, group] of groups) {
            const hasLineArc = group.prims.some(p => p.type === 'LINE' || p.type === 'ARC');
            let padEl;
            if (hasLineArc) {
              padEl = primitivesToPath(group.prims, padColor);
            } else {
              padEl = new Group();
              for (const pr of group.prims) {
                (padEl as Group).add(primitiveToUI(pr, padColor, sw * 0.3, true));
              }
            }
            if (group.rot) {
              const rWrap = new Group({ rotation: -group.rot });
              rWrap.add(padEl);
              pinInner.add(rWrap);
            } else {
              pinInner.add(padEl);
            }
          }
        } else {
          const dot = new Ellipse({
            x: -sw * 3,
            y: -sw * 3,
            width: sw * 6,
            height: sw * 6,
            fill: padColor,
          });
          pinInner.add(dot);
        }

        pinWrap.add(pinInner);
        (pinWrap as any)._type = 'pin';
        (pinWrap as any)._component = comp.name;
        (pinWrap as any)._pin = pin.pinName;

        getPadGroup(comp.layer).add(pinWrap);

        // SMD pad label
        const sigName = pinSignalMap.get(`${comp.name}.${pin.pinName}`) || '';
        const labelText = sigName ? `${pin.pinName}:${sigName}` : pin.pinName;
        const smdPrims = resolvedPrims.map(r => r.primitive);
        const padSizeForLabel = smdPrims.length > 0 ? getPadSizeFromPrims(smdPrims) : sw * 6;
        const padLongForLabel = smdPrims.length > 0 ? getPadLongDim(smdPrims) : sw * 6;
        const padAngleForLabel = smdPrims.length > 0 ? getPadOrientation(smdPrims) : 0;
        const fontSize = Math.min(padLongForLabel, Math.max(Math.min(padSizeForLabel * 0.8, padLongForLabel / Math.max(labelText.length * 0.6, 1)), padSizeForLabel * 0.3));
        if (fontSize > 0) {
          const pos = toWorldPos(comp, pin.x, pin.y);
          const lblRot = toWorldRot(comp, padAngleForLabel + (pin.rot || 0));
          const lbl = new Text({
            x: pos.x,
            y: pos.y,
            text: labelText,
            fontSize,
            fill: '#fff',
            textAlign: 'center',
            verticalAlign: 'middle',
            rotation: lblRot,
          });
          getPadLabelGroup(comp.layer).add(lbl);
        }

        // SMD pin may still have a drill (e.g. connectors marked as SMD)
        const drill = getDrillSize(pin.padName, pads, padstacks);
        if (drill > 0) {
          const drillR = drill / 2;
          const holeWrap = new Group({
            x: cx,
            y: cy,
            rotation: rot,
            scaleX: mirrorX ? -1 : 1,
            scaleY: mirrorY ? -1 : 1,
          });
          const hole = new Ellipse({
            x: pin.x - drillR,
            y: -pin.y - drillR,
            width: drill,
            height: drill,
            fill: '#1a1a2e',
          });
          holeWrap.add(hole);
          (holeWrap as any)._component = comp.name;
          thDrillGroup.add(holeWrap);
        }
      }
    }

    compGroup.add(compG);
  }

  // Silkscreen TEXT entries and centered ref labels
  for (const comp of components) {
    const shape = shapes.get(comp.shapeName);
    if (!shape) continue;

    const silkLayer = comp.layer === 'BOTTOM' ? 'SILKSCREEN_BOTTOM' : 'SILKSCREEN_TOP';
    const cx = comp.x;
    const cy = -comp.y;
    const rot = -comp.rotation;
    const mirrorX = comp.shapeMirror === 'MIRRORY';
    const mirrorY = comp.shapeMirror === 'MIRRORX';

    // Silkscreen TEXT entries
    for (const txt of comp.texts) {
      const isRef = txt.str === comp.name;
      const sg = isRef ? getSilkTextGroup(txt.layer) : getValueTextGroup(txt.layer);

      const tg = new Group({
        x: cx,
        y: cy,
        rotation: rot,
        scaleX: mirrorX ? -1 : 1,
        scaleY: mirrorY ? -1 : 1,
      });
      (tg as any)._component = comp.name;

      const textEl = new Text({
        x: txt.x,
        y: -txt.y,
        text: txt.str,
        fontSize: txt.size,
        fill: getLayerColor(txt.layer),
        textAlign: 'center',
        verticalAlign: 'middle',
        rotation: txt.rot ? -txt.rot : 0,
      });
      (textEl as any)._textType = isRef ? 'ref' : 'value';
      tg.add(textEl);
      sg.add(tg);
    }

    // Centered ref label
    const bbox = computeShapeBBox(shape);
    let bcx = (bbox.minX + bbox.maxX) / 2;
    let bcy = (bbox.minY + bbox.maxY) / 2;

    if (comp.shapeMirror === 'MIRRORX') bcy = -bcy;
    else if (comp.shapeMirror === 'MIRRORY') bcx = -bcx;

    if (comp.rotation) {
      const rad = comp.rotation * Math.PI / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const rx = bcx * cos - bcy * sin;
      const ry = bcx * sin + bcy * cos;
      bcx = rx;
      bcy = ry;
    }

    const worldX = comp.x + bcx;
    const worldY = -(comp.y + bcy);
    const fontSize = style.labelFontSize * 0.35;

    const rfg = new Text({
      x: worldX,
      y: worldY,
      text: comp.name,
      fontSize,
      fill: '#aaaaaa',
      textAlign: 'center',
      verticalAlign: 'middle',
    });
    (rfg as any)._component = comp.name;
    (rfg as any)._textType = 'ref';
    getSilkTextGroup(silkLayer).add(rfg);
  }

  return { compGroup, padGroups, padLabelGroups, silkOutlineGroups, silkTextGroups, valueTextGroups, thDrillGroup };
}

function computeShapeBBox(shape: ShapeDef): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  function expand(x: number, y: number) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  for (const p of shape.primitives) {
    switch (p.type) {
      case 'LINE': expand(p.x1, p.y1); expand(p.x2, p.y2); break;
      case 'ARC': expand(p.xs, p.ys); expand(p.xe, p.ye); break;
      case 'CIRCLE': expand(p.xc - p.r, p.yc - p.r); expand(p.xc + p.r, p.yc + p.r); break;
      case 'RECTANGLE': expand(p.x, p.y); expand(p.x + p.w, p.y + p.h); break;
    }
  }
  for (const pin of shape.pins) expand(pin.x, pin.y);
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

interface ResolvedPrim {
  primitive: GenCADPrimitive;
  psRot: number;
  psMirror: string;
}

function resolvePadPrimitives(padName: string, pads: Map<string, PadDef>, padstacks: Map<string, PadstackDef>): ResolvedPrim[] {
  const pad = findPad(pads, padName);
  if (pad && pad.primitives.length > 0) return pad.primitives.map(p => ({ primitive: p, psRot: 0, psMirror: '0' }));
  const ps = findPadstack(padstacks, padName);
  if (ps && ps.pads.length > 0) {
    const result: ResolvedPrim[] = [];
    for (const psPad of ps.pads) {
      const linkedPad = findPad(pads, psPad.padName);
      if (linkedPad) {
        for (const p of linkedPad.primitives) result.push({ primitive: p, psRot: psPad.rot, psMirror: psPad.mirror });
      }
    }
    if (result.length > 0) return result;
  }
  return [];
}

function findPad(pads: Map<string, PadDef>, name: string): PadDef | undefined {
  return pads.get(name) ?? pads.get(normalizePadName(name)) ?? findByNameCI(pads, name);
}

function findPadstack(padstacks: Map<string, PadstackDef>, name: string): PadstackDef | undefined {
  return padstacks.get(name) ?? padstacks.get(normalizePadName(name)) ?? findByNameCI(padstacks, name);
}

function normalizePadName(name: string): string {
  if (name.startsWith('PAD') && !isNaN(Number(name.slice(3)))) return 'P' + name.slice(3);
  if (name.startsWith('P') && !name.startsWith('PAD') && !isNaN(Number(name.slice(1)))) return 'PAD' + name.slice(1);
  return name;
}

function findByNameCI<V>(map: Map<string, V>, name: string): V | undefined {
  const upper = name.toUpperCase();
  for (const [k, v] of map) { if (k.toUpperCase() === upper) return v; }
  return undefined;
}

function getDrillSize(padName: string, pads: Map<string, PadDef>, padstacks: Map<string, PadstackDef>): number {
  const ps = findPadstack(padstacks, padName);
  if (ps && ps.drillSize > 0) return ps.drillSize;
  if (ps && ps.drillSize === -2 && ps.pads.length > 0) {
    const firstPad = findPad(pads, ps.pads[0].padName);
    if (firstPad && firstPad.drillSize > 0) return firstPad.drillSize;
  }
  const pad = findPad(pads, padName);
  if (pad && pad.drillSize > 0) return pad.drillSize;
  return 0;
}

function getPadSizeFromPrims(prims: GenCADPrimitive[]): number {
  let maxDim = 0;
  for (const p of prims) {
    switch (p.type) {
      case 'CIRCLE': maxDim = Math.max(maxDim, p.r * 2); break;
      case 'RECTANGLE': maxDim = Math.max(maxDim, Math.min(p.w, p.h)); break;
      case 'LINE': maxDim = Math.max(maxDim, Math.sqrt((p.x2 - p.x1) ** 2 + (p.y2 - p.y1) ** 2)); break;
    }
  }
  return maxDim;
}

function getPadLongDim(prims: GenCADPrimitive[]): number {
  let maxDim = 0;
  for (const p of prims) {
    switch (p.type) {
      case 'CIRCLE': maxDim = Math.max(maxDim, p.r * 2); break;
      case 'RECTANGLE': maxDim = Math.max(maxDim, Math.max(p.w, p.h)); break;
      case 'LINE': maxDim = Math.max(maxDim, Math.sqrt((p.x2 - p.x1) ** 2 + (p.y2 - p.y1) ** 2)); break;
    }
  }
  return maxDim;
}

function getPadOrientation(prims: GenCADPrimitive[]): number {
  for (const p of prims) {
    if (p.type === 'RECTANGLE') return p.h > p.w ? 90 : 0;
  }
  let maxLen = 0, angle = 0;
  for (const p of prims) {
    if (p.type === 'LINE') {
      const len = Math.sqrt((p.x2 - p.x1) ** 2 + (p.y2 - p.y1) ** 2);
      if (len > maxLen) { maxLen = len; angle = Math.atan2(p.y2 - p.y1, p.x2 - p.x1) * 180 / Math.PI; }
    }
  }
  return angle;
}

function toWorldPos(comp: ComponentDef, localX: number, localY: number): { x: number; y: number } {
  let lx = localX, ly = localY;
  if (comp.shapeMirror === 'MIRRORX') ly = -ly;
  else if (comp.shapeMirror === 'MIRRORY') lx = -lx;
  const rad = comp.rotation * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: comp.x + lx * cos - ly * sin,
    y: -(comp.y + lx * sin + ly * cos),
  };
}

function toWorldRot(comp: ComponentDef, localRot: number): number {
  let rot = -(comp.rotation + localRot);
  if (comp.shapeMirror === 'MIRRORY') rot = -rot;
  if (rot > 90) rot -= 180;
  else if (rot < -90) rot += 180;
  return rot;
}
