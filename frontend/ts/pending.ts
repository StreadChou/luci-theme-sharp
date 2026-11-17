import { t, tn } from './i18n';
import { bindPopover, closePopover } from './dom';
import { closeDialogs } from './dialogs';

/** The count and review dialog remain owned by LuCI. */
export function initPendingChanges(ui: LuCIUI, indicators: HTMLElement): () => void {
  const button = document.querySelector<HTMLButtonElement>('#sharp-pending')!;
  const panel = document.querySelector<HTMLElement>('#sharp-pending-notice')!;
  const message = document.querySelector<HTMLElement>('#sharp-pending-message')!;
  const dismiss = panel.querySelector<HTMLButtonElement>('[data-sharp-notice-close]')!;
  const notice = bindPopover(button, panel, { toggleTrigger: false });
  let previousCount = 0;
  let queued = false;
  let frame = 0;

  const review = (): void => {
    queued = false;
    closePopover(false, true);
    closeDialogs();
    ui.changes.displayChanges();
  };
  button.addEventListener('click', review);
  panel.querySelector('[data-sharp-pending-review]')!.addEventListener('click', review);
  dismiss.title = t('Dismiss notification');
  dismiss.setAttribute('aria-label', dismiss.title);
  dismiss.addEventListener('click', () => {
    queued = false;
    notice.close(true);
  });

  const showWhenReady = (): void => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (document.body.classList.contains('modal-overlay-active') || document.querySelector('.sharp-dialog[open]')) {
        notice.close(false, true);
        return;
      }
      if (!queued || button.hidden) return;
      queued = false;
      notice.open();
    });
  };
  // Saves can update the count while LuCI is still displaying its progress modal.
  const modalObserver = new MutationObserver(showWhenReady);
  modalObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.querySelectorAll('.sharp-dialog').forEach(dialog => {
    modalObserver.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  });

  return (): void => {
    const available = indicators.querySelector('[data-indicator="uci-changes"]') !== null;
    const count = available
      ? Object.values(ui.changes.changes ?? {}).reduce((sum, changes) => sum + changes.length, 0) : 0;
    const label = tn(count, '%d pending configuration change; click to review', '%d pending configuration changes; click to review');
    button.hidden = count === 0;
    button.querySelector('[data-sharp-pending-count]')!.textContent = String(count);
    button.title = label;
    button.setAttribute('aria-label', label);
    if (count === previousCount) return;
    previousCount = count;
    queued = count > 0;
    if (!count) {
      const focusInside = panel.contains(document.activeElement) || button === document.activeElement;
      notice.close(false, true);
      if (focusInside) document.querySelector<HTMLElement>('.sharp-header .sharp-brand')?.focus({ preventScroll: true });
      return;
    }
    message.textContent = tn(count, 'You have %d unsaved configuration change', 'You have %d unsaved configuration changes');
    showWhenReady();
  };
}
