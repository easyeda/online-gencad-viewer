// --- Theme & i18n ---

type Lang = 'zh' | 'en';

let currentLang: Lang = (localStorage.getItem('gc-lang') as Lang) || 'zh';

const T: Record<Lang, Record<string, string>> = {
  zh: {
    openFile: '打开文件', zoomIn: '放大', zoomOut: '缩小', fitScreen: '适应屏幕',
    components: '元件', searchComp: '搜索元件...', nets: '网络', searchNet: '搜索网络...',
    filters: '图元显示', all: '全部', board: '板框', routes: '导线',
    compFilter: '元件', ref: '位号', value: '值', vias: '过孔', labels: '网络名',
    layers: '图层', properties: '属性', clickHint: '点击图元查看属性', noLayers: '无图层',
    noProps: '无属性',
    propComp: '元件', propDevice: '器件', propPosition: '位置', propLayer: '层',
    propRotation: '角度', propPackage: '封装', propSignal: '网络',
    propNodeCount: '节点数', propNodes: '节点', propElement: '元素',
    allLayers: '全部图层',
    pads: '焊盘', drills: '钻孔层',
    text: '文本',
    layerTop: '顶层', layerBottom: '底层', layerBoard: '板框层', layerSilkTop: '顶层丝印层', layerSilkBottom: '底层丝印层',
    layerInner: '内层', layerVia: '过孔', layerPad: '焊盘', layerRoute: '导线',
    about: '关于', aboutAuthor: '作者', aboutRepo: '仓库', aboutVersion: '版本', aboutBuildDate: '编译日期', aboutEngine: '渲染引擎', aboutDesc: '在线 GenCAD 查看器，支持多层布局、走线、焊盘、过孔、丝印等元素的交互式可视化展示。',
    welcomeTitle: 'Online GenCAD Viewer',
    welcomeDesc: '在线 GenCAD 查看器，方便查看 PCB 的布局与走线',
    welcomeClick: '点击此处或工具栏「打开文件」按钮加载文件',
    welcomeDrag: '也可以直接拖拽 .cad 文件到此区域',
    welcomeSample: '打开示例文件',
  },
  en: {
    openFile: 'Open File', zoomIn: 'Zoom In', zoomOut: 'Zoom Out', fitScreen: 'Fit View',
    components: 'Components', searchComp: 'Search...', nets: 'Nets', searchNet: 'Search...',
    filters: 'Display', all: 'All', board: 'Board', routes: 'Routes',
    compFilter: 'Comps', ref: 'Ref', value: 'Value', vias: 'Vias', labels: 'Labels',
    layers: 'Layers', properties: 'Properties', clickHint: 'Click an element to view properties', noLayers: 'No layers',
    noProps: 'No properties',
    propComp: 'Component', propDevice: 'Device', propPosition: 'Position', propLayer: 'Layer',
    propRotation: 'Rotation', propPackage: 'Package', propSignal: 'Signal',
    propNodeCount: 'Node Count', propNodes: 'Nodes', propElement: 'Element',
    allLayers: 'All Layers',
    pads: 'Pads', drills: 'Drills',
    text: 'Text',
    layerTop: 'Top', layerBottom: 'Bottom', layerBoard: 'Board', layerSilkTop: 'Top Silk', layerSilkBottom: 'Bottom Silk',
    layerInner: 'Inner', layerVia: 'Via', layerPad: 'Pad', layerRoute: 'Route',
    about: 'About', aboutAuthor: 'Author', aboutRepo: 'Repository', aboutVersion: 'Version', aboutBuildDate: 'Build Date', aboutEngine: 'Render Engine', aboutDesc: 'Online GenCAD viewer with interactive multi-layer visualization for PCB layout, routing, pads, vias, and silkscreen.',
    welcomeTitle: 'Online GenCAD Viewer',
    welcomeDesc: 'Online GenCAD viewer for PCB layout and routing',
    welcomeClick: 'Click here or the "Open File" button to load a file',
    welcomeDrag: 'You can also drag and drop a .cad file into this area',
    welcomeSample: 'Open Sample File',
  },
};

export function t(key: string): string { return T[currentLang][key] || key; }
export function getLang(): Lang { return currentLang; }

let langChangeCallback: (() => void) | null = null;
export function onLangChange(fn: () => void) { langChangeCallback = fn; }

export function toggleLang(): Lang {
  currentLang = currentLang === 'zh' ? 'en' : 'zh';
  localStorage.setItem('gc-lang', currentLang);
  langChangeCallback?.();
  return currentLang;
}

// --- Init CSS variables (dark theme) ---
const DARK_VARS: Record<string, string> = {
  '--gc-bg': '#1e1e1e', '--gc-bg2': '#2a2a2a', '--gc-fg': '#ffffff', '--gc-fg2': '#cccccc',
  '--gc-border': '#333', '--gc-border2': '#444', '--gc-accent': '#3a5a8a', '--gc-accent-b': '#4a7aba',
  '--gc-btn': '#2d2d2d', '--gc-input': '#2a2a2a', '--gc-hover': '#3d3d3d', '--gc-canvas': '#1a1a2e',
};
for (const [k, v] of Object.entries(DARK_VARS)) {
  document.documentElement.style.setProperty(k, v);
}

// --- Layout ---

export interface LayoutRefs {
  container: HTMLElement;
  toolbar: HTMLElement;
  leftPanel: HTMLElement;
  canvasContainer: HTMLElement;
  canvasDiv: HTMLDivElement;
  welcomeOverlay: HTMLElement;
  rightPanel: HTMLElement;
  propertyContent: HTMLElement;
  layerPanel: HTMLElement;
  filterPanel: HTMLElement;
  compList: HTMLElement;
  compSearch: HTMLInputElement;
  netList: HTMLElement;
  netSearch: HTMLInputElement;
  fileNameEl: HTMLElement;
  btnOpen: HTMLButtonElement;
  btnZoomIn: HTMLButtonElement;
  btnZoomOut: HTMLButtonElement;
  btnFit: HTMLButtonElement;
  sampleBtn: HTMLButtonElement;
}

export function createLayout(): LayoutRefs {
  const container = document.getElementById('app')!;
  container.innerHTML = '';

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 12px;background:var(--gc-bg);color:var(--gc-fg);border-bottom:1px solid var(--gc-border);height:40px;flex-shrink:0;';

  const btnOpen = mkBtn(t('openFile'));
  const btnZoomIn = mkBtn(t('zoomIn'));
  const btnZoomOut = mkBtn(t('zoomOut'));
  const btnFit = mkBtn(t('fitScreen'));
  const fileNameEl = document.createElement('span');
  fileNameEl.style.cssText = 'flex:1;text-align:center;font-size:13px;font-weight:500;color:var(--gc-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';

  const langBtn = mkBtn(currentLang === 'zh' ? 'EN' : '中');
  langBtn.title = 'Language';
  langBtn.onclick = () => {
    toggleLang();
    langBtn.textContent = currentLang === 'zh' ? 'EN' : '中';
    refreshLabels(toolbar, leftPanel, filterPanel, layerPanel, propContent);
    renderAbout();
  };

  toolbar.append(btnOpen, btnZoomIn, btnZoomOut, btnFit, fileNameEl);

  // About button
  const aboutWrap = document.createElement('div');
  aboutWrap.style.cssText = 'position:relative;';
  const aboutBtn = mkBtn('?');
  aboutBtn.style.cssText += 'width:28px;text-align:center;padding:4px 0;font-size:14px;border-radius:50%;';

  const aboutDrop = document.createElement('div');
  aboutDrop.style.cssText = 'display:none;position:absolute;top:100%;right:0;margin-top:4px;background:var(--gc-bg2);border:1px solid var(--gc-border2);border-radius:8px;padding:20px 24px;min-width:400px;z-index:100;box-shadow:0 4px 20px rgba(0,0,0,0.5);font-size:12px;color:var(--gc-fg);line-height:1.8;';

  function renderAbout() {
    aboutDrop.innerHTML =
      `<div style="font-size:16px;font-weight:600;margin-bottom:4px;color:var(--gc-fg);">Online GenCAD Viewer</div>` +
      `<div style="font-size:11px;color:var(--gc-fg2);margin-bottom:12px;line-height:1.6;">${t('aboutDesc')}</div>` +
      `<div style="border-top:1px solid var(--gc-border);margin:10px 0;padding-top:10px;">` +
        `<div style="font-size:12px;font-weight:500;margin-bottom:6px;color:var(--gc-fg);">${currentLang === 'zh' ? '功能特性' : 'Features'}</div>` +
        `<div style="font-size:11px;color:var(--gc-fg2);line-height:1.7;">` +
          (currentLang === 'zh'
            ? `&#8226; 多层 PCB 布局与走线可视化<br>&#8226; 焊盘、过孔、丝印、钻孔渲染<br>&#8226; 鼠标滚轮缩放与拖拽平移<br>&#8226; 图层显示控制与图元过滤<br>&#8226; 元件与网络交互式高亮<br>&#8226; 属性面板实时查看<br>&#8226; 拖拽或点击加载 .cad 文件<br>&#8226; 中英文界面切换`
            : `&#8226; Multi-layer PCB layout &amp; routing visualization<br>&#8226; Pads, vias, silkscreen &amp; drill rendering<br>&#8226; Scroll zoom &amp; drag pan<br>&#8226; Layer visibility &amp; element filter controls<br>&#8226; Interactive component &amp; net highlighting<br>&#8226; Real-time property panel<br>&#8226; Drag-drop or click to load .cad files<br>&#8226; Chinese/English UI toggle`
          ) +
        `</div>` +
      `</div>` +
      `<div style="border-top:1px solid var(--gc-border);margin:10px 0;padding-top:10px;">` +
        `<div style="font-size:12px;font-weight:500;margin-bottom:6px;color:var(--gc-fg);">${currentLang === 'zh' ? '技术栈' : 'Tech Stack'}</div>` +
        `<div style="font-size:11px;color:var(--gc-fg2);">` +
          `Canvas: <a href="https://www.leaferjs.com" target="_blank" rel="noopener" style="color:var(--gc-accent-b);text-decoration:none;">LeaferJS</a> &nbsp;|&nbsp; ` +
          `Build: <a href="https://vitejs.dev" target="_blank" rel="noopener" style="color:var(--gc-accent-b);text-decoration:none;">Vite</a> &nbsp;|&nbsp; ` +
          `Lang: TypeScript &nbsp;|&nbsp; ` +
          `${currentLang === 'zh' ? '单文件' : 'Single-file'} HTML` +
        `</div>` +
      `</div>` +
      `<div style="border-top:1px solid var(--gc-border);margin:10px 0;padding-top:10px;font-size:11px;">` +
        `<div style="display:grid;grid-template-columns:auto 1fr;gap:2px 12px;">` +
          `<span style="color:var(--gc-fg2)">${t('aboutAuthor')}:</span><span><a href="https://easyeda.com" target="_blank" rel="noopener" style="color:var(--gc-accent-b);text-decoration:none;">EasyEDA</a></span>` +
          `<span style="color:var(--gc-fg2)">${t('aboutVersion')}:</span><span>${__VERSION__}</span>` +
          `<span style="color:var(--gc-fg2)">${t('aboutBuildDate')}:</span><span>${__BUILD_DATE__}</span>` +
          `<span style="color:var(--gc-fg2)">${t('aboutRepo')}:</span><span><a href="https://github.com/easyeda/online-gencad-viewer" target="_blank" rel="noopener" style="color:var(--gc-accent-b);text-decoration:none;word-break:break-all;">github.com/easyeda/online-gencad-viewer</a></span>` +
        `</div>` +
      `</div>`;
  }
  renderAbout();

  let aboutOpen = false;
  aboutBtn.onclick = (e) => {
    e.stopPropagation();
    aboutOpen = !aboutOpen;
    aboutDrop.style.display = aboutOpen ? 'block' : 'none';
  };
  document.addEventListener('click', () => { aboutOpen = false; aboutDrop.style.display = 'none'; });

  aboutWrap.append(aboutBtn, aboutDrop);
  toolbar.append(aboutWrap, langBtn);

  // Main content
  const content = document.createElement('div');
  content.style.cssText = 'display:flex;flex:1;overflow:hidden;';

  // Left panel
  const leftPanel = document.createElement('div');
  leftPanel.style.cssText = 'background:var(--gc-bg);color:var(--gc-fg);font-size:12px;overflow-y:auto;flex-shrink:0;width:220px;border-right:1px solid var(--gc-border);display:flex;flex-direction:column;';

  const compSection = document.createElement('div');
  compSection.style.cssText = 'padding:8px 10px;border-bottom:1px solid var(--gc-border);flex:1;overflow-y:auto;display:flex;flex-direction:column;min-height:0;';
  const compTitle = document.createElement('div');
  compTitle.style.cssText = 'color:var(--gc-fg2);margin-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;';
  compTitle.textContent = t('components');
  compTitle.dataset.i18n = 'components';
  const compSearch = document.createElement('input');
  compSearch.type = 'text';
  compSearch.placeholder = t('searchComp');
  compSearch.dataset.i18nPh = 'searchComp';
  compSearch.style.cssText = 'width:100%;padding:3px 6px;background:var(--gc-input);color:var(--gc-fg);border:1px solid var(--gc-border2);border-radius:2px;font-size:11px;margin-bottom:4px;box-sizing:border-box;';
  const compList = document.createElement('div');
  compList.style.cssText = 'flex:1;overflow-y:auto;';
  compSection.append(compTitle, compSearch, compList);

  const netSection = document.createElement('div');
  netSection.style.cssText = 'padding:8px 10px;border-bottom:1px solid var(--gc-border);flex:1;overflow-y:auto;display:flex;flex-direction:column;min-height:0;border-top:1px solid var(--gc-border);';
  const netTitle = document.createElement('div');
  netTitle.style.cssText = compTitle.style.cssText;
  netTitle.textContent = t('nets');
  netTitle.dataset.i18n = 'nets';
  const netSearch = document.createElement('input');
  netSearch.type = 'text';
  netSearch.placeholder = t('searchNet');
  netSearch.dataset.i18nPh = 'searchNet';
  netSearch.style.cssText = compSearch.style.cssText;
  const netList = document.createElement('div');
  netList.style.cssText = 'flex:1;overflow-y:auto;';
  netSection.append(netTitle, netSearch, netList);

  leftPanel.append(compSection, netSection);

  // Canvas
  const canvasContainer = document.createElement('div');
  canvasContainer.style.cssText = 'flex:1;overflow:hidden;background:var(--gc-canvas);position:relative;';
  const canvasDiv = document.createElement('div');
  canvasDiv.style.cssText = 'width:100%;height:100%;';
  canvasContainer.appendChild(canvasDiv);

  // Welcome overlay
  const welcomeOverlay = document.createElement('div');
  welcomeOverlay.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;user-select:none;';
  const sampleBtn = document.createElement('button');
  sampleBtn.textContent = t('welcomeSample');
  sampleBtn.style.cssText = 'margin-top:20px;padding:8px 20px;background:var(--gc-accent);color:#fff;border:1px solid var(--gc-accent-b);border-radius:6px;cursor:pointer;font-size:13px;font-family:inherit;pointer-events:auto;';
  welcomeOverlay.innerHTML =
    `<div style="text-align:center;pointer-events:none;">` +
    `<div style="font-size:24px;font-weight:600;color:var(--gc-fg);margin-bottom:12px;">${t('welcomeTitle')}</div>` +
    `<div style="font-size:14px;color:var(--gc-fg2);margin-bottom:24px;">${t('welcomeDesc')}</div>` +
    `<div style="border:2px dashed var(--gc-border2);border-radius:12px;padding:32px 48px;display:inline-block;cursor:pointer;pointer-events:auto;" data-welcome-dropzone>` +
    `<div style="font-size:36px;margin-bottom:12px;color:var(--gc-fg2);">+</div>` +
    `<div style="font-size:13px;color:var(--gc-fg);margin-bottom:8px;">${t('welcomeClick')}</div>` +
    `<div style="font-size:12px;color:var(--gc-fg2);">${t('welcomeDrag')}</div>` +
    `</div></div>`;
  welcomeOverlay.appendChild(sampleBtn);
  canvasContainer.appendChild(welcomeOverlay);

  // Right panel
  const rightPanel = document.createElement('div');
  rightPanel.style.cssText = 'background:var(--gc-bg);color:var(--gc-fg);font-size:12px;overflow-y:auto;flex-shrink:0;width:240px;border-left:1px solid var(--gc-border);display:flex;flex-direction:column;';

  const filterPanel = document.createElement('div');
  filterPanel.style.cssText = 'padding:8px 10px;border-bottom:1px solid var(--gc-border);';
  const filterTitle = document.createElement('div');
  filterTitle.style.cssText = 'color:var(--gc-fg2);margin-bottom:6px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;';
  filterTitle.textContent = t('filters');
  filterTitle.dataset.i18n = 'filters';
  filterPanel.append(filterTitle);

  const layerPanel = document.createElement('div');
  layerPanel.style.cssText = 'padding:8px 10px;border-bottom:1px solid var(--gc-border);';
  const layerTitle = document.createElement('div');
  layerTitle.style.cssText = filterTitle.style.cssText;
  layerTitle.textContent = t('layers');
  layerTitle.dataset.i18n = 'layers';
  layerPanel.append(layerTitle);

  const propSection = document.createElement('div');
  propSection.style.cssText = 'padding:8px 10px;border-bottom:1px solid var(--gc-border);flex:1;';
  const propTitle = document.createElement('div');
  propTitle.style.cssText = filterTitle.style.cssText;
  propTitle.textContent = t('properties');
  propTitle.dataset.i18n = 'properties';
  const propContent = document.createElement('div');
  propContent.id = 'prop-content';
  propContent.style.cssText = 'line-height:1.6;';
  propContent.textContent = t('clickHint');
  propContent.dataset.i18nHint = 'clickHint';
  propSection.append(propTitle, propContent);

  rightPanel.append(filterPanel, layerPanel, propSection);
  content.append(leftPanel, canvasContainer, rightPanel);
  container.style.cssText = 'display:flex;flex-direction:column;height:100vh;';
  container.append(toolbar, content);

  return {
    container, toolbar, leftPanel, canvasContainer, canvasDiv, welcomeOverlay,
    rightPanel, propertyContent: propContent, layerPanel, filterPanel,
    compList, compSearch, netList, netSearch, fileNameEl,
    btnOpen, btnZoomIn, btnZoomOut, btnFit, sampleBtn,
  };
}

function refreshLabels(toolbar: HTMLElement, leftPanel: HTMLElement, filterPanel: HTMLElement, layerPanel: HTMLElement, propContent: HTMLElement) {
  // Update toolbar buttons
  const btns = toolbar.querySelectorAll('button');
  const keys = ['openFile', 'zoomIn', 'zoomOut', 'fitScreen'];
  btns.forEach((btn, i) => {
    if (i < keys.length) btn.textContent = t(keys[i]);
  });

  // Update all elements with data-i18n (section titles)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t((el as HTMLElement).dataset.i18n!);
  });

  // Update all elements with data-i18nPh (search placeholders)
  document.querySelectorAll('[data-i18nPh]').forEach(el => {
    (el as HTMLInputElement).placeholder = t((el as HTMLElement).dataset.i18nPh!);
  });

  // Update filter buttons
  filterPanel.querySelectorAll('button[data-i18n]').forEach(btn => {
    btn.textContent = t((btn as HTMLElement).dataset.i18n!);
  });

  // Update property hint if currently showing hint text
  const propEl = document.getElementById('prop-content') as HTMLElement | null;
  if (propEl?.dataset.i18nHint) {
    const hintKey = propEl.dataset.i18nHint;
    // Check if current text is any known hint translation
    const isHint = Object.keys(T).some(lang => (T as Record<string, Record<string, string>>)[lang][hintKey] === propEl.textContent);
    if (isHint) propEl.textContent = t(hintKey);
  }
}

function mkBtn(text: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.style.cssText = 'padding:4px 10px;background:var(--gc-btn);color:var(--gc-fg);border:1px solid var(--gc-border2);border-radius:3px;cursor:pointer;font-size:12px;white-space:nowrap;';
  btn.onmouseenter = () => btn.style.background = 'var(--gc-hover)';
  btn.onmouseleave = () => btn.style.background = 'var(--gc-btn)';
  return btn;
}
