export const LAYER_COLORS: Record<string, string> = {
  TOP: '#ff4444',
  BOTTOM: '#4488ff',
  SILKSCREEN_TOP: '#ffdd00',
  SILKSCREEN_BOTTOM: '#aa6633',
  SOLDERMASK_TOP: '#006633',
  SOLDERMASK_BOTTOM: '#003366',
  BOARD: '#8899aa',
  VIA: '#ffaa00',
  PAD_TOP: '#ffdd44',
  PAD_BOTTOM: '#44aaff',
  PAD: '#ffdd44',
  COMPONENT_OUTLINE: '#cc8844',
  COMPONENT_PIN: '#ff6600',
};

const INNER_LAYER_COLORS = [
  '#44dd44',   // INNER1 - 绿
  '#ff8800',   // INNER2 - 橙
  '#dd44dd',   // INNER3 - 紫
  '#00cccc',   // INNER4 - 青
  '#ffcc00',   // INNER5 - 黄
  '#ff44aa',   // INNER6 - 粉
  '#88dd00',   // INNER7 - 黄绿
  '#44aaff',   // INNER8 - 天蓝
  '#ff6644',   // INNER9 - 橙红
  '#aa88ff',   // INNER10 - 淡紫
  '#00ddaa',   // INNER11 - 青绿
  '#ffaa44',   // INNER12 - 金橙
  '#66ff66',   // INNER13 - 亮绿
  '#ff5577',   // INNER14 - 玫红
  '#33ddff',   // INNER15 - 亮蓝
  '#ddaa00',   // INNER16 - 深黄
  '#cc66ff',   // INNER17 - 亮紫
  '#00ff88',   // INNER18 - 翠绿
  '#ff9966',   // INNER19 - 浅橙
  '#6688ff',   // INNER20 - 蓝紫
  '#aaff00',   // INNER21 - 荧光绿
  '#ff77cc',   // INNER22 - 浅粉
  '#00aadd',   // INNER23 - 深蓝
  '#ffdd66',   // INNER24 - 浅黄
  '#bb44ff',   // INNER25 - 深紫
  '#44ffcc',   // INNER26 - 薄荷
  '#ff4400',   // INNER27 - 红橙
  '#77ccff',   // INNER28 - 粉蓝
  '#ddff44',   // INNER29 - 柠檬
  '#ff66ff',   // INNER30 - 品红
  '#44ddaa',   // INNER31 - 碧绿
  '#ffbb88',   // INNER32 - 杏色
];

export function getLayerColor(layer: string): string {
  if (LAYER_COLORS[layer]) return LAYER_COLORS[layer];
  // Inner layer color by number
  const innerMatch = layer.match(/INNER-?(\d+)/);
  if (innerMatch) {
    const idx = (parseInt(innerMatch[1], 10) - 1) % INNER_LAYER_COLORS.length;
    return INNER_LAYER_COLORS[idx >= 0 ? idx : 0];
  }
  if (layer.startsWith('INNER')) return INNER_LAYER_COLORS[0];
  return '#888888';
}
