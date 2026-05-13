import type { ComponentDef, SignalDef } from '../parser/types';

const ITEM_STYLE = 'padding:3px 6px;cursor:pointer;border-radius:2px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
const ITEM_HOVER = 'var(--gc-hover)';
const ITEM_SELECTED = 'var(--gc-accent)';
const ITEM_BG = 'transparent';

export function populateComponentList(
  container: HTMLElement,
  searchInput: HTMLInputElement,
  components: ComponentDef[],
  onClick: (comp: ComponentDef) => void
): { clearSelection: () => void } {
  container.innerHTML = '';
  const sorted = [...components].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  let selectedName: string | null = null;
  let items: { name: string; el: HTMLElement }[] = [];

  function updateSelection() {
    for (const it of items) {
      it.el.style.background = it.name === selectedName ? ITEM_SELECTED : ITEM_BG;
    }
  }

  function render(filter: string) {
    container.innerHTML = '';
    items = [];
    const filtered = filter
      ? sorted.filter(c => c.name.toLowerCase().includes(filter) || c.device.toLowerCase().includes(filter))
      : sorted;

    // Virtualize: only render first 200
    const visible = filtered.slice(0, 200);
    for (const comp of visible) {
      const item = document.createElement('div');
      item.style.cssText = ITEM_STYLE;
      item.style.background = comp.name === selectedName ? ITEM_SELECTED : ITEM_BG;
      item.textContent = `${comp.name}  ${comp.device}`;
      item.title = `${comp.name} (${comp.device}) @ ${comp.x.toFixed(3)}, ${comp.y.toFixed(3)}`;
      item.onmouseenter = () => { if (comp.name !== selectedName) item.style.background = ITEM_HOVER; };
      item.onmouseleave = () => { if (comp.name !== selectedName) item.style.background = ITEM_BG; };
      item.onclick = () => {
        selectedName = comp.name;
        updateSelection();
        onClick(comp);
      };
      items.push({ name: comp.name, el: item });
      container.appendChild(item);
    }
    if (filtered.length > 200) {
      const more = document.createElement('div');
      more.style.cssText = ITEM_STYLE + 'color:#666;';
      more.textContent = `... 还有 ${filtered.length - 200} 个`;
      container.appendChild(more);
    }
  }

  render('');
  searchInput.addEventListener('input', () => render(searchInput.value.toLowerCase()));

  return {
    clearSelection() { selectedName = null; updateSelection(); },
  };
}

export function populateNetList(
  container: HTMLElement,
  searchInput: HTMLInputElement,
  signals: Map<string, SignalDef>,
  routes: Map<string, { vias: unknown[] }>,
  onClick: (signalName: string) => void
): { clearSelection: () => void } {
  container.innerHTML = '';
  const names = [...signals.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  let selectedName: string | null = null;
  let items: { name: string; el: HTMLElement }[] = [];

  function updateSelection() {
    for (const it of items) {
      it.el.style.background = it.name === selectedName ? ITEM_SELECTED : ITEM_BG;
    }
  }

  function render(filter: string) {
    container.innerHTML = '';
    items = [];
    const filtered = filter
      ? names.filter(n => n.toLowerCase().includes(filter))
      : names;

    const visible = filtered.slice(0, 200);
    for (const name of visible) {
      const sig = signals.get(name)!;
      const item = document.createElement('div');
      item.style.cssText = ITEM_STYLE;
      item.style.background = name === selectedName ? ITEM_SELECTED : ITEM_BG;
      const nodeCount = sig.nodes.length;
      item.textContent = `${name} (${nodeCount})`;
      item.title = `${name} - ${nodeCount} 节点`;
      item.onmouseenter = () => { if (name !== selectedName) item.style.background = ITEM_HOVER; };
      item.onmouseleave = () => { if (name !== selectedName) item.style.background = ITEM_BG; };
      item.onclick = () => {
        selectedName = name;
        updateSelection();
        onClick(name);
      };
      items.push({ name, el: item });
      container.appendChild(item);
    }
    if (filtered.length > 200) {
      const more = document.createElement('div');
      more.style.cssText = ITEM_STYLE + 'color:#666;';
      more.textContent = `... 还有 ${filtered.length - 200} 个`;
      container.appendChild(more);
    }
  }

  render('');
  searchInput.addEventListener('input', () => render(searchInput.value.toLowerCase()));

  return {
    clearSelection() { selectedName = null; updateSelection(); },
  };
}
