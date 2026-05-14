import type { BoardDef, RenderStyle } from '../parser/types';
import { Group, Text } from 'leafer-ui';
import { primitiveToUI, primitivesToStrokePath } from './primitives';
import { getLayerColor } from './colors';

export function renderBoard(board: BoardDef, parent: Group, style: RenderStyle): Group {
  const color = getLayerColor('BOARD');
  const sw = style.lineWidth;

  // Batch outline primitives into single stroke path for performance
  const outlineLineArc = board.outline.filter(p => p.type === 'LINE' || p.type === 'ARC');
  if (outlineLineArc.length > 0) {
    const pathEl = primitivesToStrokePath(outlineLineArc, color, sw);
    parent.add(pathEl);
  }
  // Circles and rectangles rendered individually
  for (const p of board.outline) {
    if (p.type === 'CIRCLE' || p.type === 'RECTANGLE') {
      const el = primitiveToUI(p, color, sw);
      parent.add(el);
    }
  }

  for (const cutout of board.cutouts) {
    const cutLineArc = cutout.primitives.filter(p => p.type === 'LINE' || p.type === 'ARC');
    if (cutLineArc.length > 0) {
      const pathEl = primitivesToStrokePath(cutLineArc, '#ff000088', sw * 0.75);
      parent.add(pathEl);
    }
    for (const p of cutout.primitives) {
      if (p.type === 'CIRCLE' || p.type === 'RECTANGLE') {
        const el = primitiveToUI(p, '#ff000088', sw * 0.75);
        parent.add(el);
      }
    }
  }

  // Board-level TEXT
  const textGroup = new Group();
  for (const txt of board.texts) {
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
    textGroup.add(textEl);
  }

  return textGroup;
}
