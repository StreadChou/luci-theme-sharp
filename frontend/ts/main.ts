import { t } from './i18n';
import { bindPopoverDismissal } from './dom';
import { icon, renderIcons } from './icons';
import { initAppearance } from './appearance';
import { initDesktopLayout } from './desktop-layout';
import { initNavigation } from './navigation';
import { initSearch } from './search';
import { initContentLayout } from './layout';
import { initMobileDialogs } from './dialogs';
import { initPendingChanges } from './pending';
import { initLogin } from './login';

renderIcons();
initAppearance();
initDesktopLayout();
bindPopoverDismissal();
initContentLayout();
initMobileDialogs();
initLogin();
document.querySelectorAll<HTMLImageElement>('[data-sharp-brand-logo]').forEach(image => {
  const fallback = (): void => {
    const source = image.dataset.sharpBrandFallback;
    if (source && image.getAttribute('src') !== source) image.src = source;
  };
  image.addEventListener('error', fallback);
  if (image.complete && !image.naturalWidth) fallback();
});

document.querySelectorAll<HTMLImageElement>('[data-sharp-login-background]').forEach(image => {
  const fallback = (): void => {
    image.hidden = true;
  };
  image.addEventListener('error', fallback);
  if (image.complete && !image.naturalWidth) fallback();
  const source = image.dataset.wallpaperSource;
  const endpoint = image.dataset.wallpaperEndpoint;
  if (!endpoint || (source !== 'bing' && source !== 'wallhaven')) return;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8000);
  const stop = (): void => controller.abort();
  window.addEventListener('pagehide', stop, { once: true });
  void fetch(endpoint + '?source=' + source, { signal: controller.signal, credentials: 'omit', cache: 'no-store' })
    .then(async response => {
      if (!response.ok) return;
      const result: { url?: unknown } = await response.json();
      if (typeof result.url !== 'string') return;
      const allowed = source === 'bing' ? /^https:\/\/www\.bing\.com\/th\?id=OHR\.[A-Za-z0-9_.=&-]+$/
        : /^https:\/\/w\.wallhaven\.cc\/full\/[a-z0-9]{2}\/wallhaven-[a-z0-9]{6}\.(jpg|png)$/;
      if (!allowed.test(result.url) || controller.signal.aborted) return;
      // Keep the bundled wallpaper visible until the online image has decoded.
      const online = new Image();
      online.referrerPolicy = 'no-referrer';
      window.clearTimeout(timer);
      const url = result.url;
      await new Promise<void>(resolve => {
        const finish = (): void => {
          window.clearTimeout(imageTimer);
          online.onload = online.onerror = null;
          controller.signal.removeEventListener('abort', cancel);
          resolve();
        };
        const cancel = (): void => { online.src = ''; finish(); };
        const imageTimer = window.setTimeout(cancel, 10000);
        controller.signal.addEventListener('abort', cancel, { once: true });
        online.onload = () => {
          if (!controller.signal.aborted) {
            image.referrerPolicy = 'no-referrer';
            image.src = online.src;
            image.hidden = false;
          }
          finish();
        };
        online.onerror = finish;
        online.src = url;
      });
    })
    .catch(() => { /* The built-in wallpaper remains available offline. */ })
    .finally(() => {
      window.clearTimeout(timer);
      window.removeEventListener('pagehide', stop);
    });
});

function initIndicators(ui: LuCIUI): void {
  const refreshes = document.querySelectorAll<HTMLButtonElement>('[data-sharp-refresh]');
  const indicators = document.querySelector<HTMLElement>('#indicators')!;
  const syncPending = initPendingChanges(ui, indicators);
  refreshes.forEach(refresh => {
    refresh.addEventListener('click', () => {
      // Keep LuCI's original handler as the single owner of polling.
      indicators.querySelector<HTMLElement>('[data-indicator="poll-status"]')?.click();
    });
  });
  const sync = (): void => {
    const pollStatus = indicators.querySelector<HTMLElement>('[data-indicator="poll-status"]');
    const paused = pollStatus?.dataset.style === 'inactive';
    const refreshLabel = paused
      ? t('Automatic refresh paused; click to resume')
      : t('Automatically refreshing; click to pause');
    refreshes.forEach(refresh => {
      refresh.hidden = !pollStatus;
      refresh.title = refreshLabel;
      refresh.setAttribute('aria-label', refreshLabel);
      const indicator = refresh.querySelector<HTMLElement>('[data-sharp-icon]');
      const name = paused ? 'pause' : 'refresh';
      if (indicator && indicator.dataset.sharpIcon !== name) {
        indicator.dataset.sharpIcon = name;
        indicator.replaceChildren(icon(name));
      }
    });
    syncPending();
  };
  // LuCI updates the native indicator for both user and programmatic poll changes.
  new MutationObserver(sync).observe(indicators, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ['data-style']
  });
  document.addEventListener('uci-applied', sync);
  document.addEventListener('uci-reverted', sync);
  sync();
}

async function start(): Promise<void> {
  if (!document.querySelector('#sharp-header')) return;
  const ui = await L.require('ui');
  // Sharp loads with defer after LuCI's luci-loaded event may have fired.
  // Initialize the native UCI change tracker explicitly so indicators are
  // available on every route, including pages without a view bootstrap.
  await ui.changes.init?.();
  initIndicators(ui);
  const tree = await ui.menu.load();
  initSearch(initNavigation(ui, tree));
}

void start().catch(error => {
  console.error('Sharp navigation failed:', error);
  document.querySelectorAll('#sharp-nav, #sharp-mobile-nav, #sharp-sidebar-secondary').forEach(nav => {
    nav.textContent = t('Menu unavailable. Please refresh.');
  });
});
