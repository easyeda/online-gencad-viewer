import { t } from './layout';

export function showProperties(content: HTMLElement, props: Record<string, unknown>) {
  const entries = Object.entries(props).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) {
    content.innerHTML = `<span style="color:var(--gc-fg2)">${t('noProps')}</span>`;
    return;
  }
  content.innerHTML = entries.map(([k, v]) => {
    const val = esc(String(v));
    return `<div style="margin-bottom:4px;display:flex;gap:4px;"><span style="color:var(--gc-fg2);flex-shrink:0;">${esc(k)}:</span> <span style="color:var(--gc-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${val}">${val}</span></div>`;
  }).join('');
}

export function clearProperties(content: HTMLElement) {
  content.textContent = t('clickHint');
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
