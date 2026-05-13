import type { BoardDef, RenderStyle } from '../parser/types';
import { Group, Text } from 'leafer-ui';
import { primitiveToUI } from './primitives';
import { getLayerColor } from './colors';

export function renderBoard(board: BoardDef, parent: Group, style: RenderStyle): Group {
  const color = getLayerColor('BOARD');
  const sw = style.lineWidth;

  for (const p of board.outline) {
    const el = primitiveToUI(p, color, sw);
    parent.add(el);
  }

  for (const cutout of board.cutouts) {
    for (const p of cutout.primitives) {
      const el = primitiveToUI(p, '#ff000088', sw * 0.75);
      parent.add(el);
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
