import { closePopover } from './dom';

type DesktopLayout = 'default' | 'argon';
const key = 'sharp:desktop-layout';
const normalize = (value: string | null | undefined): DesktopLayout => value === 'argon' ? 'argon' : 'default';

/** Browser-local presentation preference, independent of LuCI's UCI changes. */
export function initDesktopLayout(): void {
  const header = document.querySelector<HTMLElement>('#sharp-header');
  if (!header) return;
  const workspace = document.querySelector<HTMLElement>('.sharp-workspace-content');
  const root = document.documentElement;
  const controls = document.querySelectorAll<HTMLInputElement>('input[name="sharp-desktop-layout"]');
  const mobile = matchMedia('(max-width: 900px)');
  let navigationFocus: HTMLElement | undefined;
  document.addEventListener('focusin', event => {
    const target = event.target;
    if (target instanceof HTMLElement && target !== document.body) {
      navigationFocus = target.closest('#sharp-nav, #sharp-sidebar') ? target : undefined;
    }
  });
  const restoreVisibleFocus = (): void => {
    // Hiding a focused navigation control may move focus to body before the
    // media-query event fires. Retain that control until focus is placed again.
    const active = document.activeElement === document.body ? navigationFocus : document.activeElement;
    if (active instanceof HTMLElement && active.closest('#sharp-nav, #sharp-sidebar') && !active.getClientRects().length) {
      const target = mobile.matches ? document.querySelector<HTMLElement>('#sharp-mobile-menu-toggle')
        : header.querySelector<HTMLElement>('.sharp-brand');
      target?.focus({ preventScroll: true });
    }
  };
  const apply = (layout: DesktopLayout): void => {
    if (root.dataset.sharpDesktopLayout !== layout) closePopover(false, true);
    root.dataset.sharpDesktopLayout = layout;
    controls.forEach(input => { input.checked = input.value === layout; });
    restoreVisibleFocus();
  };
  controls.forEach(input => input.addEventListener('change', () => {
    if (!input.checked) return;
    const layout = normalize(input.value);
    try { localStorage.setItem(key, layout); } catch { /* Still apply for this page when storage is unavailable. */ }
    apply(layout);
  }));
  window.addEventListener('storage', event => {
    if (event.storageArea === localStorage && (event.key === key || event.key === null)) apply(normalize(event.newValue));
  });
  // Browsers restore form values during history navigation, even without bfcache.
  window.addEventListener('pageshow', () => {
    try { apply(normalize(localStorage.getItem(key))); } catch { /* Keep the current page preference. */ }
  });
  mobile.addEventListener('change', restoreVisibleFocus);
  const sizes = new ResizeObserver(() => {
    const height = `${header.getBoundingClientRect().height}px`;
    if (root.style.getPropertyValue('--sharp-shell-header-height') !== height) root.style.setProperty('--sharp-shell-header-height', height);
    if (workspace) {
      const width = `${workspace.getBoundingClientRect().width}px`;
      if (workspace.style.getPropertyValue('--sharp-workspace-width') !== width) workspace.style.setProperty('--sharp-workspace-width', width);
    }
  });
  sizes.observe(header);
  if (workspace) sizes.observe(workspace);
  apply(normalize(root.dataset.sharpDesktopLayout));
}
