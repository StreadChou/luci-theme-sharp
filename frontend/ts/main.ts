import { t, tn } from './i18n';
import { bindPopoverDismissal } from './dom';
import { renderIcons } from './icons';
import { initAppearance } from './appearance';
import { initNavigation } from './navigation';
import { initSearch } from './search';
import { initContentLayout } from './layout';
import { closeDialogs, initMobileDialogs } from './dialogs';

renderIcons();
initAppearance();
bindPopoverDismissal();
initContentLayout();
initMobileDialogs();

function initRefresh(ui: LuCIUI): void {
  const refreshes = document.querySelectorAll<HTMLButtonElement>('[data-sharp-refresh]');
  const pendingButtons = document.querySelectorAll<HTMLButtonElement>('[data-sharp-pending]');
  const indicators = document.querySelector<HTMLElement>('#indicators')!;
  let formEdited = false;
  document.querySelector('#maincontent')?.addEventListener('input', () => { formEdited = true; });
  refreshes.forEach(refresh => {
    refresh.title = t('Refresh current page');
    refresh.setAttribute('aria-label', refresh.title);
    const label = refresh.querySelector('[data-sharp-refresh-label]');
    if (label) label.textContent = refresh.title;
    refresh.addEventListener('click', () => {
      if (formEdited && !confirm(t('Refreshing discards unsaved input on this page. Continue?'))) return;
      window.location.reload();
    });
  });
  pendingButtons.forEach(pending => {
    pending.addEventListener('click', () => {
      closeDialogs();
      ui.changes.displayChanges();
    });
  });
  const sync = (): void => {
    const count = Object.values(ui.changes.changes ?? {}).reduce((sum, changes) => sum + changes.length, 0);
    const available = indicators.querySelector('[data-indicator="uci-changes"]') !== null;
    const label = tn(count, '%d pending configuration change; click to review', '%d pending configuration changes; click to review');
    const hidden = !available || count === 0;
    pendingButtons.forEach(pending => {
      pending.hidden = hidden;
      const countLabel = pending.querySelector('[data-sharp-pending-count]');
      const textLabel = pending.querySelector('[data-sharp-pending-label]');
      if (countLabel) countLabel.textContent = String(count);
      else pending.textContent = String(count);
      if (textLabel) textLabel.textContent = t('Review pending changes');
      pending.title = label;
      pending.setAttribute('aria-label', label);
    });
    document.querySelector<HTMLElement>('.sharp-settings-dot')!.hidden = hidden;
    document.querySelector('#sharp-settings-toggle')!.setAttribute('aria-label', hidden ? t('Settings') : `${t('Settings')} · ${label}`);
  };
  new MutationObserver(sync).observe(indicators, { childList: true, subtree: true, characterData: true });
  document.addEventListener('uci-applied', () => { formEdited = false; sync(); });
  document.addEventListener('uci-reverted', () => { formEdited = false; sync(); });
  sync();
}

async function start(): Promise<void> {
  if (!document.querySelector('#sharp-header')) return;
  const ui = await L.require('ui');
  const tree = await ui.menu.load();
  initSearch(initNavigation(ui, tree));
  initRefresh(ui);
}

void start().catch(error => {
  console.error('Sharp navigation failed:', error);
  document.querySelectorAll('#sharp-nav, #sharp-mobile-nav').forEach(nav => {
    nav.textContent = t('Menu unavailable. Please refresh.');
  });
});
