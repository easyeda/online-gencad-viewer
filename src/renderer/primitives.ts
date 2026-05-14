import type { GenCADPrimitive } from '../parser/types';
import { Line, Path, Ellipse, Rect, UI, Group } from 'leafer-ui';

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
      const d = `M ${p.xs} ${-p.ys} ` + arcSVGSegment(p);
      const el = new Path({
        path: d,
        fill: undefined,
        stroke: color,
        strokeWidth,
        strokeCap: 'round',
        strokeJoin: 'round',
      });
      return el;
    }
  }
}

export function primitivesToPath(prims: GenCADPrimitive[], color: string): UI {
  // Pre-allocate string array and join once for better performance
  const parts: string[] = [];
  let started = false;

  for (const p of prims) {
    switch (p.type) {
      case 'LINE': {
        if (!started) { parts.push(`M ${p.x1} ${-p.y1}`); started = true; }
        else { parts.push(`L ${p.x1} ${-p.y1}`); }
        parts.push(`L ${p.x2} ${-p.y2}`);
        break;
      }
      case 'ARC': {
        if (!started) { parts.push(`M ${p.xs} ${-p.ys}`); started = true; }
        else { parts.push(`L ${p.xs} ${-p.ys}`); }
        parts.push(arcSVGSegment(p));
        break;
      }
      case 'CIRCLE': {
        const { xc, yc, r } = p;
        parts.push(`M ${xc - r} ${-yc} A ${r} ${r} 0 0 0 ${xc + r} ${-yc} A ${r} ${r} 0 0 0 ${xc - r} ${-yc}`);
        started = true;
        break;
      }
      case 'RECTANGLE': {
        const { x, y, w, h } = p;
        parts.push(`M ${x} ${-y} L ${x + w} ${-y} L ${x + w} ${-(y + h)} L ${x} ${-(y + h)} Z`);
        started = true;
        break;
      }
    }
  }

  if (started) parts.push('Z');
  const el = new Path({
    path: parts.join(' '),
    fill: color,
    stroke: undefined,
    windingRule: 'evenodd',
  });
  return el;
}

/**
 * Generate SVG A (arc) path segment for a GenCAD ARC.
 * GenCAD: CCW from (xs,ys) to (xe,ye) center (xc,yc) in Y-up coords.
 * Screen: Y negated, so CCW becomes CW → SVG sweep-flag = 0.
 */
function arcSVGSegment(a: { xs: number; ys: number; xe: number; ye: number; xc: number; yc: number }): string {
  const dx = a.xs - a.xc;
  const dy = a.ys - a.yc;
  const r2 = dx * dx + dy * dy;
  if (r2 < 1e-10) return '';
  const r = Math.sqrt(r2);

  // Use atan2 for sweep calculation
  let sweep = Math.atan2(a.ye - a.yc, a.xe - a.xc) - Math.atan2(dy, dx);
  if (sweep <= 0) sweep += Math.PI * 2;

  const largeArc = sweep > Math.PI ? 1 : 0;
  return `A${r} ${r} 0 ${largeArc} 0 ${a.xe} ${-a.ye}`;
}

