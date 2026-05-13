import type { BoardDef, RenderStyle } from '../parser/types';
import { Group } from 'leafer-ui';
import { primitiveToUI } from './primitives';
import { getLayerColor } from './colors';

export function renderBoard(board: BoardDef, parent: Group, style: RenderStyle): void {
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
}
