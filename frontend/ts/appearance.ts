import { t } from './i18n';
import { bindPopover, closePopover, element } from './dom';
import { icon } from './icons';

type Mode = 'light' | 'dark' | 'system';
const key = 'sharp:appearance';

export function initAppearance(): void {
  const root = document.documentElement;
  const preference = matchMedia('(prefers-color-scheme: dark)');
  const trigger = document.querySelector<HTMLButtonElement>('#sharp-appearance-toggle');
  const panel = document.querySelector<HTMLElement>('#sharp-appearance-menu');
  const mobilePanel = document.querySelector<HTMLElement>('#sharp-mobile-appearance');
  let mode = (root.dataset.sharpMode || 'system') as Mode;
  const options: Array<[Mode, string]> = [
    ['light', t('Light')], ['dark', t('Dark')], ['system', t('Follow system')]
  ];
  const apply = (): void => {
    root.dataset.sharpMode = mode;
    root.dataset.sharpTheme = mode === 'system' ? (preference.matches ? 'dark' : 'light') : mode;
    if (trigger) {
      trigger.replaceChildren(icon(mode === 'system' ? 'monitor' : mode === 'dark' ? 'moon' : 'sun'));
      const label = `${t('Appearance')} · ${options.find(entry => entry[0] === mode)?.[1]}`;
      trigger.title = label;
      trigger.setAttribute('aria-label', label);
    }
    panel?.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => {
      button.setAttribute('aria-checked', String(button.dataset.mode === mode));
    });
    mobilePanel?.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    });
  };
  preference.addEventListener('change', apply);
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    mode = options.some(entry => entry[0] === event.newValue) ? event.newValue as Mode : 'system';
    apply();
  });
  const choose = (value: Mode): void => {
    mode = value;
    try { localStorage.setItem(key, mode); } catch { /* Keep the preference for this page. */ }
    apply();
  };
  const mobileTitle = document.querySelector('#sharp-settings-appearance-title');
  if (mobileTitle) mobileTitle.textContent = t('Appearance');
  options.forEach(([value, label]) => {
    if (!mobilePanel) return;
    const button = element('button', 'sharp-appearance-option');
    button.type = 'button';
    button.dataset.mode = value;
    button.append(icon(value === 'system' ? 'monitor' : value === 'dark' ? 'moon' : 'sun'), element('span', '', label));
    button.addEventListener('click', () => choose(value));
    mobilePanel.append(button);
  });
  if (trigger && panel) {
    panel.append(element('div', 'sharp-menu-caption', t('APPEARANCE')));
    options.forEach(([value, label]) => {
      const button = element('button', 'sharp-menu-item');
      button.type = 'button';
      button.dataset.mode = value;
      button.setAttribute('role', 'menuitemradio');
      button.append(icon(value === 'system' ? 'monitor' : value === 'dark' ? 'moon' : 'sun'), element('span', '', label), icon('check'));
      button.addEventListener('click', () => {
        choose(value);
        closePopover(true);
      });
      panel.append(button);
    });
    bindPopover(trigger, panel);
  }
  apply();
}
