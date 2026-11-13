import { t } from './i18n';
import { closePopover } from './dom';
import { animatePanel, cancelMotion } from './motion';

let current: HTMLDialogElement | undefined;
const openers = new WeakMap<HTMLDialogElement, HTMLElement>();
const dismissers = new WeakMap<HTMLDialogElement, (immediate?: boolean) => void>();

export function closeDialogs(): void {
  // Native LuCI modals and breakpoint changes must take over immediately.
  if (current) dismissers.get(current)?.(true);
}

/** Native dialogs provide focus containment, Escape dismissal and an inert page. */
export function bindDialog(
  dialog: HTMLDialogElement,
  triggers: HTMLButtonElement[],
  focus?: () => void,
  prepare?: () => void
): (trigger?: HTMLButtonElement) => void {
  let closing = false;
  const dismiss = (immediate = false): void => {
    if (!dialog.open || (closing && !immediate)) return;
    closing = true;
    dialog.dataset.sharpClosing = '';
    triggers.forEach(button => button.setAttribute('aria-expanded', 'false'));
    animatePanel(dialog, false, () => {
      dialog.close();
      delete dialog.dataset.sharpClosing;
      closing = false;
      if (current === dialog) current = undefined;
    }, immediate);
  };
  dismissers.set(dialog, dismiss);
  const open = (trigger?: HTMLButtonElement): void => {
    if (document.body.classList.contains('modal-overlay-active')) return;
    if (!dialog.open) {
      const origin = trigger ?? (current && openers.get(current)) ?? document.activeElement;
      closePopover(false, true);
      closeDialogs();
      if (origin instanceof HTMLElement) openers.set(dialog, origin);
      prepare?.();
      dialog.showModal();
      current = dialog;
      triggers.forEach(button => button.setAttribute('aria-expanded', 'true'));
      animatePanel(dialog, true);
    } else if (closing) {
      closing = false;
      delete dialog.dataset.sharpClosing;
      triggers.forEach(button => button.setAttribute('aria-expanded', 'true'));
      animatePanel(dialog, true);
    }
    focus?.();
  };
  triggers.forEach(button => button.addEventListener('click', () => open(button)));
  dialog.addEventListener('keydown', event => {
    // Search inputs may otherwise consume Escape just to clear their text.
    if (event.key !== 'Escape' || event.isComposing) return;
    event.preventDefault();
    event.stopPropagation();
    dismiss();
  }, true);
  dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
  dialog.querySelectorAll<HTMLButtonElement>('[data-sharp-dialog-close]').forEach(button => {
    button.title = t('Close');
    button.setAttribute('aria-label', button.title);
    button.addEventListener('click', () => dismiss());
  });
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    cancelMotion(dialog);
    delete dialog.dataset.sharpClosing;
    closing = false;
    triggers.forEach(button => button.setAttribute('aria-expanded', 'false'));
    if (current === dialog) current = undefined;
    // A close event can arrive after another theme or native LuCI dialog opens.
    if (current?.open || document.body.classList.contains('modal-overlay-active')) return;
    const opener = openers.get(dialog);
    const target = opener?.getClientRects().length ? opener
      : triggers.find(button => button.getClientRects().length)
        ?? document.querySelector<HTMLElement>('.sharp-header .sharp-brand');
    target?.focus({ preventScroll: true });
  });
  const outside = (event: MouseEvent): boolean => {
    const rect = dialog.getBoundingClientRect();
    return event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right
      || event.clientY < rect.top || event.clientY > rect.bottom);
  };
  let backdrop = false;
  dialog.addEventListener('pointerdown', event => { backdrop = outside(event); });
  dialog.addEventListener('click', event => {
    if (backdrop && outside(event)) dismiss();
    backdrop = false;
  });
  return open;
}

export function initMobileDialogs(): void {
  const menu = document.querySelector<HTMLDialogElement>('#sharp-mobile-menu');
  const settings = document.querySelector<HTMLDialogElement>('#sharp-settings-dialog');
  if (!menu || !settings) return;
  document.querySelector('#sharp-mobile-menu-title')!.textContent = t('Navigation');
  document.querySelector('#sharp-settings-title')!.textContent = t('Settings');
  const menuToggle = document.querySelector<HTMLButtonElement>('#sharp-mobile-menu-toggle')!;
  const settingsToggle = document.querySelector<HTMLButtonElement>('#sharp-settings-toggle')!;
  menuToggle.title = t('Open navigation');
  menuToggle.setAttribute('aria-label', menuToggle.title);
  settingsToggle.title = t('Settings');
  settingsToggle.setAttribute('aria-label', settingsToggle.title);
  bindDialog(menu, [menuToggle]);
  bindDialog(settings, [settingsToggle]);
  const mobile = matchMedia('(max-width: 900px)');
  mobile.addEventListener('change', () => {
    if (!mobile.matches && current?.classList.contains('sharp-mobile-dialog')) closeDialogs();
    closePopover(false, true);
  });
  // Move the original indicators, preserving LuCI's handlers and live updates.
  const indicators = document.querySelector('#indicators')!;
  indicators.addEventListener('click', event => {
    if ((event.target as Element).closest('[data-clickable="true"]')) closeDialogs();
  }, true);
  const desktop = document.querySelector('.sharp-header-end')!;
  const mobileIndicators = document.querySelector('#sharp-mobile-indicators')!;
  const placeIndicators = (): void => {
    (mobile.matches ? mobileIndicators : desktop).prepend(indicators);
  };
  mobile.addEventListener('change', placeIndicators);
  placeIndicators();
}
