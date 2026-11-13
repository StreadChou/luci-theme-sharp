import { animatePanel } from './motion';

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K, className = '', text?: string
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

interface Popover { trigger: HTMLButtonElement; panel: HTMLElement; closing: boolean }
let current: Popover | undefined;

function fitPopover(panel: HTMLElement): void {
  // Every header menu starts below the header, regardless of trigger height.
  const header = panel.closest<HTMLElement>('.sharp-header');
  const container = panel.offsetParent;
  if (header && container instanceof HTMLElement) {
    const anchorBottom = header.getBoundingClientRect().bottom
      - container.getBoundingClientRect().top - container.clientTop + container.scrollTop;
    panel.style.setProperty('--sharp-popover-anchor-bottom', `${anchorBottom}px`);
  }
  panel.style.setProperty('--sharp-popover-shift', '0px');
  const rect = panel.getBoundingClientRect();
  const width = document.documentElement.clientWidth;
  const shift = Math.max(16 - rect.left, Math.min(0, width - 16 - rect.right));
  panel.style.setProperty('--sharp-popover-shift', `${shift}px`);
}

export function closePopover(restoreFocus = false, immediate = false): void {
  const popover = current;
  if (!popover || (popover.closing && !immediate)) return;
  popover.closing = true;
  popover.trigger.setAttribute('aria-expanded', 'false');
  if (restoreFocus) popover.trigger.focus({ preventScroll: true });
  popover.panel.inert = true;
  animatePanel(popover.panel, false, () => {
    popover.panel.hidden = true;
    popover.panel.inert = false;
    if (current === popover) current = undefined;
  }, immediate);
}

export function bindPopover(trigger: HTMLButtonElement, panel: HTMLElement): void {
  const open = (): void => {
    if (current?.panel === panel && !current.closing) return;
    if (current?.panel !== panel) closePopover(false, true);
    panel.hidden = false;
    panel.inert = false;
    fitPopover(panel);
    trigger.setAttribute('aria-expanded', 'true');
    current = { trigger, panel, closing: false };
    animatePanel(panel, true);
  };
  trigger.addEventListener('click', () => current?.panel === panel && !current.closing ? closePopover() : open());
  trigger.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      open();
      panel.querySelector<HTMLElement>('a, button')?.focus();
    }
  });
  panel.addEventListener('keydown', event => {
    const items = [...panel.querySelectorAll<HTMLElement>('a, button:not(:disabled)')];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'ArrowDown' ? (index + 1) % items.length
      : event.key === 'ArrowUp' ? (index - 1 + items.length) % items.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : -1;
    if (next >= 0) { event.preventDefault(); items[next]?.focus(); }
  });
}

export function bindPopoverDismissal(): void {
  const reposition = (): void => {
    if (!current) return;
    if (!current.trigger.getClientRects().length) closePopover(false, true);
    else fitPopover(current.panel);
  };
  window.addEventListener('resize', reposition);
  const header = document.querySelector('.sharp-header');
  if (header) new ResizeObserver(reposition).observe(header);
  document.addEventListener('click', event => {
    if (current && !current.panel.contains(event.target as Node) && !current.trigger.contains(event.target as Node)) closePopover();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closePopover(true);
  });
  document.addEventListener('focusin', event => {
    if (current && !current.panel.contains(event.target as Node) && !current.trigger.contains(event.target as Node)) closePopover();
  });
}
