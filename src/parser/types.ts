// GenCAD Geometry Primitives

export interface PrimitiveLine {
  type: 'LINE';
  x1: number; y1: number;
  x2: number; y2: number;
}

export interface PrimitiveArc {
  type: 'ARC';
  xs: number; ys: number;
  xe: number; ye: number;
  xc: number; yc: number;
}

export interface PrimitiveCircle {
  type: 'CIRCLE';
  xc: number; yc: number;
  r: number;
}

export interface PrimitiveRectangle {
  type: 'RECTANGLE';
  x: number; y: number;
  w: number; h: number;
}

export type GenCADPrimitive = PrimitiveLine | PrimitiveArc | PrimitiveCircle | PrimitiveRectangle;

export type PadType = 'ROUND' | 'RECTANGULAR' | 'OCTAGONAL' | 'BULLET' | 'FINGER' | 'POLYGON' | string;

export interface PadDef {
  name: string;
  type: PadType;
  drillSize: number;
  primitives: GenCADPrimitive[];
  attributes: Record<string, string>;
}

export interface PadstackPad {
  padName: string;
  layer: string;
  rot: number;
  mirror: string;
}

export interface PadstackDef {
  name: string;
  drillSize: number;
  pads: PadstackPad[];
  attributes: Record<string, string>;
}

export interface ShapePin {
  pinName: string;
  padName: string;
  x: number; y: number;
  layer: string;
  rot: number;
  mirror: string;
}

export interface ShapeFiducial {
  name: string;
  padName: string;
  x: number; y: number;
  layer: string;
  rot: number;
  mirror: string;
}

export interface ShapeArtwork {
  artworkName: string;
  x: number; y: number;
  rot: number;
  mirror: string;
}

export interface ShapeDef {
  name: string;
  primitives: GenCADPrimitive[];
  pins: ShapePin[];
  fiducials: ShapeFiducial[];
  artworks: ShapeArtwork[];
  insert?: string;
  height?: number;
  attributes: Record<string, string>;
}

export interface ComponentArtwork {
  artworkName: string;
  x: number; y: number;
  rot: number;
  mirror: string;
  flip: boolean;
}

export interface ComponentDef {
  name: string;
  device: string;
  x: number; y: number;
  layer: string;
  rotation: number;
  shapeName: string;
  shapeMirror: string;
  shapeFlip: boolean;
  artworks: ComponentArtwork[];
  texts: GenCADText[];
  attributes: Record<string, string>;
}

export interface DeviceDef {
  name: string;
  part?: string;
  type?: string;
  style?: string;
  package?: string;
  pinDesc: Record<string, string>;
  pinFunct: Record<string, string>;
  pinCount?: number;
  value?: string;
  desc?: string;
  attributes: Record<string, string>;
}

export interface RouteSegment {
  primitives: GenCADPrimitive[];
  trackName: string;
  layer: string;
  width: number;
}

export interface ViaDef {
  padName: string;
  x: number; y: number;
  layer: string;
  drillSize: number;
  name: string;
}

export interface RouteDef {
  signalName: string;
  segments: RouteSegment[];
  vias: ViaDef[];
  texts: GenCADText[];
  attributes: Record<string, string>;
}

export interface GenCADText {
  x: number; y: number; size: number; rot: number;
  mirror: string; layer: string; str: string;
  bw: number; bh: number; bx: number; by: number;
}

export interface BoardCutout {
  primitives: GenCADPrimitive[];
  name: string;
  attributes: Record<string, string>;
}

export interface BoardDef {
  thickness?: number;
  outline: GenCADPrimitive[];
  cutouts: BoardCutout[];
  texts: GenCADText[];
  attributes: Record<string, string>;
}

export interface SignalNode {
  componentName: string;
  pinName: string;
}

export interface SignalDef {
  name: string;
  nodes: SignalNode[];
  attributes: Record<string, string>;
}

export interface TrackDef {
  name: string;
  width: number;
}

export interface ArtworkDef {
  name: string;
  layer: string;
  primitives: GenCADPrimitive[];
  filled: boolean;
  attributes: Record<string, string>;
}

export interface HeaderInfo {
  gencadVersion: string;
  user?: string;
  drawing?: string;
  revision?: string;
  units: string;
  unitsPerInch: number;
  origin: { x: number; y: number };
}

export interface GenCADData {
  header: HeaderInfo;
  board: BoardDef;
  pads: Map<string, PadDef>;
  padstacks: Map<string, PadstackDef>;
  artworks: Map<string, ArtworkDef>;
  shapes: Map<string, ShapeDef>;
  components: ComponentDef[];
  devices: Map<string, DeviceDef>;
  signals: Map<string, SignalDef>;
  tracks: Map<string, TrackDef>;
  routes: RouteDef[];
}

export interface RenderStyle {
  lineWidth: number;
  labelFontSize: number;
}
