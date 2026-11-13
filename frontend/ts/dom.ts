export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K, className = '', text?: string
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

interface Popover { trigger: HTMLButtonElement; panel: HTMLElement }
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

export function closePopover(restoreFocus = false): void {
  if (!current) return;
  current.panel.hidden = true;
  current.trigger.setAttribute('aria-expanded', 'false');
  if (restoreFocus) current.trigger.focus();
  current = undefined;
}

export function bindPopover(trigger: HTMLButtonElement, panel: HTMLElement): void {
  const open = (): void => {
    closePopover();
    panel.hidden = false;
    fitPopover(panel);
    trigger.setAttribute('aria-expanded', 'true');
    current = { trigger, panel };
  };
  trigger.addEventListener('click', () => panel.hidden ? open() : closePopover());
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
    if (!current.trigger.getClientRects().length) closePopover();
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
