import type { GenCADPrimitive } from '../parser/types';
import { Line, Path, Ellipse, Rect, UI } from 'leafer-ui';

export function primitiveToUI(p: GenCADPrimitive, color: string, strokeWidth = 0.5, filled = false): UI {
  switch (p.type) {
    case 'LINE': {
      const el = new Line({
        x: p.x1,
        y: -p.y1,
        toPoint: { x: p.x2 - p.x1, y: -(p.y2 - p.y1) },
        stroke: color,
        strokeWidth,
        strokeCap: 'round',
      });
      return el;
    }
    case 'CIRCLE': {
      const el = new Ellipse({
        x: p.xc - p.r,
        y: -(p.yc + p.r),
        width: p.r * 2,
        height: p.r * 2,
        fill: filled ? color : undefined,
        stroke: filled ? undefined : color,
        strokeWidth: filled ? undefined : strokeWidth,
      });
      return el;
    }
    case 'RECTANGLE': {
      const el = new Rect({
        x: p.x,
        y: -(p.y + p.h),
        width: p.w,
        height: p.h,
        fill: filled ? color : undefined,
        stroke: filled ? undefined : color,
        strokeWidth: filled ? undefined : strokeWidth,
      });
      return el;
    }
    case 'ARC': {
      const d = arcToSVGPath(p);
      const el = new Path({
        path: d,
        fill: undefined,
        stroke: color,
        strokeWidth,
      });
      return el;
    }
  }
}

export function primitivesToPath(prims: GenCADPrimitive[], color: string): UI {
  let d = '';
  let started = false;

  for (const p of prims) {
    switch (p.type) {
      case 'LINE': {
        if (!started) { d += `M ${p.x1} ${-p.y1} `; started = true; }
        else { d += `L ${p.x1} ${-p.y1} `; }
        d += `L ${p.x2} ${-p.y2} `;
        break;
      }
      case 'ARC': {
        if (!started) { d += `M ${p.xs} ${-p.ys} `; started = true; }
        else { d += `L ${p.xs} ${-p.ys} `; }
        d += arcToSVGArcSegment(p) + ' ';
        break;
      }
      case 'CIRCLE': {
        const { xc, yc, r } = p;
        d += `M ${xc - r} ${-yc} A ${r} ${r} 0 0 0 ${xc + r} ${-yc} A ${r} ${r} 0 0 0 ${xc - r} ${-yc} `;
        started = true;
        break;
      }
      case 'RECTANGLE': {
        const { x, y, w, h } = p;
        d += `M ${x} ${-y} L ${x + w} ${-y} L ${x + w} ${-(y + h)} L ${x} ${-(y + h)} Z `;
        started = true;
        break;
      }
    }
  }

  if (started) d += 'Z';
  const el = new Path({
    path: d,
    fill: color,
    stroke: undefined,
    windingRule: 'evenodd',
  });
  return el;
}

export function arcToSVGPath(a: { xs: number; ys: number; xe: number; ye: number; xc: number; yc: number }): string {
  return `M ${a.xs} ${-a.ys} ` + arcToSVGArcSegment(a);
}

function arcToSVGArcSegment(a: { xs: number; ys: number; xe: number; ye: number; xc: number; yc: number }): string {
  const dxs = a.xs - a.xc;
  const dys = a.ys - a.yc;
  const dxe = a.xe - a.xc;
  const dye = a.ye - a.yc;

  const r = Math.sqrt(dxs * dxs + dys * dys);
  if (r < 1e-10) return '';

  const startAngle = Math.atan2(dys, dxs);
  const endAngle = Math.atan2(dye, dxe);
  let sweep = endAngle - startAngle;
  while (sweep <= 0) sweep += 2 * Math.PI;

  const largeArc = sweep > Math.PI ? 1 : 0;
  // Y is negated, so CCW in Y-up becomes CW in Y-down → sweep=0
  const svgSweep = 0;

  return `A ${r} ${r} 0 ${largeArc} ${svgSweep} ${a.xe} ${-a.ye}`;
}
