import type {
  GenCADData, HeaderInfo, BoardDef, BoardCutout, PadDef, PadstackDef,
  ArtworkDef, ShapeDef, ComponentDef, DeviceDef, SignalDef, TrackDef,
  RouteDef, RouteSegment, GenCADPrimitive,
} from './types';
import { resolveUnits } from './unit-converter';

export function parseGenCAD(text: string): GenCADData {
  const lines = text.split(/\r?\n/);
  const data: GenCADData = {
    header: { gencadVersion: '', units: 'INCH', unitsPerInch: 1, origin: { x: 0, y: 0 } },
    board: { outline: [], cutouts: [], texts: [], attributes: {} },
    pads: new Map(),
    padstacks: new Map(),
    artworks: new Map(),
    shapes: new Map(),
    components: [],
    devices: new Map(),
    signals: new Map(),
    tracks: new Map(),
    routes: [],
  };

  let section: string | null = null;

  // Current entity references for inline keyword attachment
  let curPad: PadDef | null = null;
  let curPadstack: PadstackDef | null = null;
  let curArtwork: ArtworkDef | null = null;
  let curShape: ShapeDef | null = null;
  let curComponent: ComponentDef | null = null;
  let curDevice: DeviceDef | null = null;
  let curSignal: SignalDef | null = null;
  let curRoute: RouteDef | null = null;
  let curRouteSegment: RouteSegment | null = null;
  // Board target wrapper: BoardDef uses 'outline' not 'primitives'
  let curBoardTarget: { primitives: GenCADPrimitive[]; attributes: Record<string, string> } =
    { primitives: data.board.outline, attributes: data.board.attributes };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;

    // Section start/end
    if (line.startsWith('$')) {
      if (line.startsWith('$END')) {
        section = null;
        curPad = null; curPadstack = null; curArtwork = null; curShape = null;
        curComponent = null; curDevice = null; curSignal = null; curRoute = null;
        curRouteSegment = null; curBoardTarget = { primitives: data.board.outline, attributes: data.board.attributes };
        continue;
      }
      section = line.substring(1);
      continue;
    }
    if (!section) continue;

    const tokens = tokenize(line);
    if (tokens.length === 0) continue;
    const kw = tokens[0].toUpperCase();
    const a = tokens.slice(1);

    // --- HEADER ---
    if (section === 'HEADER') {
      switch (kw) {
        case 'GENCAD': data.header.gencadVersion = a[0] ?? ''; break;
        case 'USER': data.header.user = a.join(' '); break;
        case 'DRAWING': data.header.drawing = a.join(' '); break;
        case 'REVISION': data.header.revision = a.join(' '); break;
        case 'UNITS': data.header.units = a[0] ?? 'INCH'; data.header.unitsPerInch = resolveUnits(a[0], a[1] ? +a[1] : undefined); break;
        case 'ORIGIN': if (a.length >= 2) data.header.origin = { x: +a[0], y: +a[1] }; break;
      }
      continue;
    }

    // --- BOARD ---
    if (section === 'BOARD') {
      switch (kw) {
        case 'THICKNESS': data.board.thickness = +a[0]; break;
        case 'CUTOUT': {
          const cut: BoardCutout = { primitives: [], name: a[0] ?? '', attributes: {} };
          data.board.cutouts.push(cut);
          curBoardTarget = cut;
          break;
        }
        case 'MASK': case 'ARTWORK': {
          // Treat as named sub-groups that share the same target
          // For now just keep current target
          break;
        }
        case 'LINE': case 'ARC': case 'CIRCLE': case 'RECTANGLE':
          addPrim(kw, a, curBoardTarget);
          break;
        case 'TEXT':
          if (a.length >= 7) data.board.texts.push({ x: +a[0], y: +a[1], size: +a[2], rot: +a[3], mirror: a[4], layer: a[5], str: a[6], bw: +(a[7] ?? 0), bh: +(a[8] ?? 0), bx: +(a[9] ?? 0), by: +(a[10] ?? 0) });
          break;
        case 'ATTRIBUTE':
          if (a.length >= 2) curBoardTarget.attributes[a[0]] = a.slice(1).join(' ');
          break;
      }
      continue;
    }

    // --- PADS ---
    if (section === 'PADS') {
      if (kw === 'PAD' && a.length >= 3) {
        curPad = { name: a[0], type: a[1], drillSize: +a[2], primitives: [], attributes: {} };
        data.pads.set(curPad.name, curPad);
      } else if (curPad) {
        if (kw === 'ATTRIBUTE' && a.length >= 2) {
          curPad.attributes[a[0]] = a.slice(1).join(' ');
        } else {
          addPrim(kw, a, curPad);
        }
      }
      continue;
    }

    // --- PADSTACKS ---
    if (section === 'PADSTACKS') {
      if (kw === 'PADSTACK' && a.length >= 2) {
        curPadstack = { name: a[0], drillSize: +a[1], pads: [], attributes: {} };
        data.padstacks.set(curPadstack.name, curPadstack);
      } else if (curPadstack) {
        if (kw === 'PAD' && a.length >= 4) {
          curPadstack.pads.push({ padName: a[0], layer: a[1], rot: +a[2], mirror: a[3] });
        } else if (kw === 'ATTRIBUTE' && a.length >= 2) {
          curPadstack.attributes[a[0]] = a.slice(1).join(' ');
        }
      }
      continue;
    }

    // --- ARTWORKS ---
    if (section === 'ARTWORKS') {
      if (kw === 'ARTWORK' && a.length >= 1) {
        curArtwork = { name: a[0], layer: '', primitives: [], filled: false, attributes: {} };
        data.artworks.set(curArtwork.name, curArtwork);
      } else if (curArtwork) {
        switch (kw) {
          case 'LAYER': curArtwork.layer = a[0] ?? ''; break;
          case 'FILLED': curArtwork.filled = a[0] === 'YES' || a[0] === '0'; break;
          case 'TRACK': break; // skip track ref for now
          case 'LINE': case 'ARC': case 'CIRCLE': case 'RECTANGLE':
            addPrim(kw, a, curArtwork); break;
          case 'ATTRIBUTE':
            if (a.length >= 2) curArtwork.attributes[a[0]] = a.slice(1).join(' '); break;
        }
      }
      continue;
    }

    // --- SHAPES ---
    if (section === 'SHAPES') {
      if (kw === 'SHAPE' && a.length >= 1) {
        curShape = { name: a[0], primitives: [], pins: [], fiducials: [], artworks: [], attributes: {} };
        data.shapes.set(curShape.name, curShape);
      } else if (curShape) {
        switch (kw) {
          case 'LINE': case 'ARC': case 'CIRCLE': case 'RECTANGLE':
            addPrim(kw, a, curShape); break;
          case 'PIN':
            if (a.length >= 6) curShape.pins.push({ pinName: a[0], padName: a[1], x: +a[2], y: +a[3], layer: a[4], rot: +a[5], mirror: a[6] ?? '0' });
            break;
          case 'FIDUCIAL':
            // Old-style fiducial marker
            break;
          case 'FID':
            if (a.length >= 6) curShape.fiducials.push({ name: a[0], padName: a[1], x: +a[2], y: +a[3], layer: a[4], rot: +a[5], mirror: a[6] ?? '0' });
            break;
          case 'ARTWORK':
            if (a.length >= 4) curShape.artworks.push({ artworkName: a[0], x: +a[1], y: +a[2], rot: +a[3], mirror: a[4] ?? '0' });
            break;
          case 'INSERT': curShape.insert = a[0]; break;
          case 'HEIGHT': curShape.height = +a[0]; break;
          case 'ATTRIBUTE':
            if (a.length >= 2) curShape.attributes[a[0]] = a.slice(1).join(' '); break;
        }
      }
      continue;
    }

    // --- COMPONENTS ---
    if (section === 'COMPONENTS') {
      if (kw === 'COMPONENT' && a.length >= 1) {
        curComponent = { name: a[0], device: '', x: 0, y: 0, layer: 'TOP', rotation: 0, shapeName: '', shapeMirror: '0', shapeFlip: false, artworks: [], texts: [], attributes: {} };
        data.components.push(curComponent);
      } else if (curComponent) {
        switch (kw) {
          case 'DEVICE': curComponent.device = a[0] ?? ''; break;
          case 'PLACE': if (a.length >= 2) { curComponent.x = +a[0]; curComponent.y = +a[1]; } break;
          case 'LAYER': curComponent.layer = a[0] ?? 'TOP'; break;
          case 'ROTATION': curComponent.rotation = +a[0]; break;
          case 'SHAPE':
            if (a.length >= 2) { curComponent.shapeName = a[0]; curComponent.shapeMirror = a[1]; curComponent.shapeFlip = a[2] === 'FLIP'; }
            break;
          case 'ARTWORK':
            if (a.length >= 5) curComponent.artworks.push({ artworkName: a[0], x: +a[1], y: +a[2], rot: +a[3], mirror: a[4], flip: a[5] === 'FLIP' });
            break;
          case 'TEXT':
            if (a.length >= 7) curComponent.texts.push({ x: +a[0], y: +a[1], size: +a[2], rot: +a[3], mirror: a[4], layer: a[5], str: a[6], bw: +(a[7] ?? 0), bh: +(a[8] ?? 0), bx: +(a[9] ?? 0), by: +(a[10] ?? 0) });
            break;
          case 'ATTRIBUTE':
            if (a.length >= 2) curComponent.attributes[a[0]] = a.slice(1).join(' '); break;
        }
      }
      continue;
    }

    // --- DEVICES ---
    if (section === 'DEVICES') {
      if (kw === 'DEVICE' && a.length >= 1) {
        curDevice = { name: a[0], pinDesc: {}, pinFunct: {}, attributes: {} };
        data.devices.set(curDevice.name, curDevice);
      } else if (curDevice) {
        switch (kw) {
          case 'PART': curDevice.part = a.join(' '); break;
          case 'TYPE': curDevice.type = a.join(' '); break;
          case 'STYLE': curDevice.style = a.join(' '); break;
          case 'PACKAGE': curDevice.package = a.join(' '); break;
          case 'PINDESC': if (a.length >= 2) curDevice.pinDesc[a[0]] = a.slice(1).join(' '); break;
          case 'PINFUNCT': if (a.length >= 2) curDevice.pinFunct[a[0]] = a.slice(1).join(' '); break;
          case 'PINCOUNT': curDevice.pinCount = +a[0]; break;
          case 'VALUE': curDevice.value = a.join(' '); break;
          case 'DESC': curDevice.desc = a.join(' '); break;
          case 'ATTRIBUTE': if (a.length >= 2) curDevice.attributes[a[0]] = a.slice(1).join(' '); break;
        }
      }
      continue;
    }

    // --- SIGNALS ---
    if (section === 'SIGNALS') {
      if (kw === 'SIGNAL' && a.length >= 1) {
        curSignal = { name: a[0], nodes: [], attributes: {} };
        data.signals.set(curSignal.name, curSignal);
      } else if (curSignal) {
        switch (kw) {
          case 'NODE': if (a.length >= 2) curSignal.nodes.push({ componentName: a[0], pinName: a[1] }); break;
          case 'ATTRIBUTE': if (a.length >= 2) curSignal.attributes[a[0]] = a.slice(1).join(' '); break;
        }
      }
      continue;
    }

    // --- TRACKS ---
    if (section === 'TRACKS') {
      if (kw === 'TRACK' && a.length >= 2) {
        data.tracks.set(a[0], { name: a[0], width: +a[1] });
      }
      continue;
    }

    // --- ROUTES ---
    if (section === 'ROUTES') {
      if (kw === 'ROUTE' && a.length >= 1) {
        curRoute = { signalName: a[0], segments: [], vias: [], texts: [], attributes: {} };
        curRouteSegment = null;
        data.routes.push(curRoute);
      } else if (curRoute) {
        switch (kw) {
          case 'TRACK': {
            const track = data.tracks.get(a[0]);
            // If current segment has no primitives yet, just update its track info
            if (curRouteSegment && curRouteSegment.primitives.length === 0) {
              curRouteSegment.trackName = a[0];
              curRouteSegment.width = track?.width ?? 0;
            } else {
              const newSeg: RouteSegment = { primitives: [], trackName: a[0], layer: curRouteSegment?.layer ?? 'TOP', width: track?.width ?? 0 };
              curRouteSegment = newSeg;
              curRoute.segments.push(curRouteSegment);
            }
            break;
          }
          case 'LAYER': {
            // If current segment has no primitives yet, just update its layer
            if (curRouteSegment && curRouteSegment.primitives.length === 0) {
              curRouteSegment.layer = a[0] ?? 'TOP';
            } else {
              const seg: RouteSegment = { primitives: [], trackName: curRouteSegment?.trackName ?? '', layer: a[0] ?? 'TOP', width: curRouteSegment?.width ?? 0 };
              curRouteSegment = seg;
              curRoute.segments.push(curRouteSegment);
            }
            break;
          }
          case 'LINE': case 'ARC': case 'CIRCLE': case 'RECTANGLE': {
            if (!curRouteSegment) {
              curRouteSegment = { primitives: [], trackName: '', layer: 'TOP', width: 0 };
              curRoute.segments.push(curRouteSegment);
            }
            addPrim(kw, a, curRouteSegment);
            break;
          }
          case 'VIA':
            if (a.length >= 5) curRoute.vias.push({ padName: a[0], x: +a[1], y: +a[2], layer: a[3], drillSize: +a[4], name: a[5] ?? '' });
            break;
          case 'ATTRIBUTE': if (a.length >= 2) curRoute.attributes[a[0]] = a.slice(1).join(' '); break;
          case 'TEXT':
            if (a.length >= 7 && curRoute) curRoute.texts.push({ x: +a[0], y: +a[1], size: +a[2], rot: +a[3], mirror: a[4], layer: a[5], str: a[6], bw: +(a[7] ?? 0), bh: +(a[8] ?? 0), bx: +(a[9] ?? 0), by: +(a[10] ?? 0) });
            break;
        }
      }
      continue;
    }
  }

  return data;
}

// --- Helpers ---

function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === ' ') { i++; continue; }
    if (line[i] === '"') {
      const end = line.indexOf('"', i + 1);
      if (end === -1) { tokens.push(line.substring(i + 1)); break; }
      tokens.push(line.substring(i + 1, end));
      i = end + 1;
    } else {
      let end = i;
      while (end < line.length && line[end] !== ' ') end++;
      tokens.push(line.substring(i, end));
      i = end;
    }
  }
  return tokens;
}

function addPrim(kw: string, a: string[], target: { primitives: GenCADPrimitive[] }) {
  switch (kw) {
    case 'LINE':
      if (a.length >= 4) target.primitives.push({ type: 'LINE', x1: +a[0], y1: +a[1], x2: +a[2], y2: +a[3] });
      break;
    case 'ARC':
      if (a.length >= 6) target.primitives.push({ type: 'ARC', xs: +a[0], ys: +a[1], xe: +a[2], ye: +a[3], xc: +a[4], yc: +a[5] });
      break;
    case 'CIRCLE':
      if (a.length >= 3) target.primitives.push({ type: 'CIRCLE', xc: +a[0], yc: +a[1], r: +a[2] });
      break;
    case 'RECTANGLE':
      if (a.length >= 4) target.primitives.push({ type: 'RECTANGLE', x: +a[0], y: +a[1], w: +a[2], h: +a[3] });
      break;
  }
}
