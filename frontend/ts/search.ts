import { t, tn } from './i18n';
import { element } from './dom';
import { bindDialog } from './dialogs';
import { icon } from './icons';
import type { SearchEntry } from './navigation';

export function initSearch(entries: SearchEntry[]): void {
  const dialog = document.querySelector<HTMLDialogElement>('#sharp-search-dialog')!;
  const input = document.querySelector<HTMLInputElement>('#sharp-search-input')!;
  const panel = document.querySelector<HTMLElement>('#sharp-search-results')!;
  const status = document.querySelector<HTMLElement>('#sharp-search-status')!;
  const triggers = [...document.querySelectorAll<HTMLButtonElement>('[data-sharp-search-open]')];
  const close = document.querySelector<HTMLButtonElement>('#sharp-search-close')!;
  const title = t('Search menus');
  document.querySelector('#sharp-search-title')!.textContent = title;
  input.placeholder = t('Search menus…');
  input.setAttribute('aria-label', title);
  document.querySelector('.sharp-search-label')!.textContent = input.placeholder;
  close.title = t('Close search');
  close.setAttribute('aria-label', close.title);
  triggers.forEach(trigger => { trigger.title = title; trigger.setAttribute('aria-label', title); });
  const shortcut = document.querySelector<HTMLElement>('.sharp-search-shortcut')!;
  shortcut.textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K';
  const render = (): void => {
    const query = input.value.trim().toLocaleLowerCase();
    const matches = entries.filter(entry => `${entry.group} ${entry.title}`.toLocaleLowerCase().includes(query)).slice(0, 8);
    panel.replaceChildren(element('div', 'sharp-menu-caption', query ? t('SEARCH RESULTS') : t('QUICK ACCESS')));
    if (!matches.length) panel.append(element('p', 'sharp-search-empty', t('No matching menu')));
    matches.forEach(entry => {
      const link = element('a', 'sharp-search-result');
      link.href = entry.url;
      const text = element('span', 'sharp-search-result-label');
      text.append(element('strong', '', entry.title), element('small', '', entry.group));
      link.append(text, icon('arrow'));
      panel.append(link);
    });
    status.textContent = tn(matches.length, '%d menu result', '%d menu results');
  };
  const open = bindDialog(dialog, triggers, () => {
    input.focus({ preventScroll: true });
    input.select();
  }, () => {
    input.value = '';
    render();
  });
  input.addEventListener('input', render);
  input.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); panel.querySelector<HTMLAnchorElement>('a')?.focus(); }
    if (event.key === 'Enter') { event.preventDefault(); panel.querySelector<HTMLAnchorElement>('a')?.click(); }
  });
  panel.addEventListener('keydown', event => {
    const links = [...panel.querySelectorAll<HTMLAnchorElement>('a')];
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (event.key === 'ArrowDown') { event.preventDefault(); links[(index + 1) % links.length]?.focus(); }
    if (event.key === 'ArrowUp') { event.preventDefault(); if (index <= 0) input.focus(); else links[index - 1]?.focus(); }
  });
  document.addEventListener('keydown', event => {
    if (!event.isComposing && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault(); open();
    }
  });
}
