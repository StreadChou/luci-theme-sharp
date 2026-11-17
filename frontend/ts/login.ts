import { icon } from './icons';

export function initLogin(): void {
  const input = document.querySelector<HTMLInputElement>('#sharp-password');
  const toggle = document.querySelector<HTMLButtonElement>('.sharp-login-password-toggle');
  if (!input || !toggle) return;
  // Anonymous login pages receive their translations from the Ucode template.
  const showLabel = toggle.dataset.showLabel;
  const hideLabel = toggle.dataset.hideLabel;
  if (!showLabel || !hideLabel) return;

  const sync = (): void => {
    const revealed = input.type === 'text';
    const label = revealed ? hideLabel : showLabel;
    toggle.title = label;
    toggle.setAttribute('aria-label', label);
    toggle.replaceChildren(icon(revealed ? 'eye-off' : 'eye'));
  };
  toggle.addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password';
    sync();
  });
  window.addEventListener('pagehide', () => {
    input.type = 'password';
    sync();
  });
  sync();
  toggle.hidden = false;
}
