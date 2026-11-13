import { t } from './i18n';
import { element } from './dom';

/** Keep native tables intact: LuCI continues updating the original nodes. */
export function initContentLayout(): void {
  const main = document.querySelector<HTMLElement>('#maincontent');
  if (!main) return;
  initPageTabs(main);
  const tables = new Map<HTMLElement, HTMLDivElement>();
  let frame = 0;
  const measure = (): void => {
    frame = 0;
    tables.forEach((region, table) => {
      if (!table.isConnected || table.parentElement !== region) {
        sizes.unobserve(table);
        sizes.unobserve(region);
        tables.delete(table);
        if (region.isConnected && !region.hasChildNodes()) region.remove();
        return;
      }
      const overflowing = region.clientWidth > 0 && region.scrollWidth > region.clientWidth + 1;
      region.tabIndex = overflowing ? 0 : -1;
      if (overflowing) {
        region.setAttribute('role', 'region');
        region.setAttribute('aria-label', t('Table, scroll horizontally to see all content'));
      } else {
        region.removeAttribute('role');
        region.removeAttribute('aria-label');
      }
    });
  };
  const schedule = (): void => { if (!frame) frame = requestAnimationFrame(measure); };
  const sizes = new ResizeObserver(schedule);
  const wrap = (table: HTMLElement): void => {
    const previous = tables.get(table);
    if (previous && table.parentElement === previous) return;
    if (previous) {
      sizes.unobserve(table);
      sizes.unobserve(previous);
      tables.delete(table);
      if (!previous.hasChildNodes()) previous.remove();
    }
    if (!table.closest('#maincontent, #modal_overlay')
      || table.parentElement?.closest('table, .table')
      || table.matches('[data-sharp-scroll="off"]')) return;
    let region = table.parentElement as HTMLDivElement;
    if (region.classList.contains('sharp-table-scroll')) {
      // A native view may replace the table while retaining our scroll region.
      tables.forEach((existing, oldTable) => {
        if (existing !== region) return;
        sizes.unobserve(oldTable);
        tables.delete(oldTable);
      });
    } else {
      if (region.closest('.sharp-table-scroll')) return;
      region = document.createElement('div');
      region.className = 'sharp-table-scroll';
      table.before(region);
      region.append(table);
    }
    tables.set(table, region);
    sizes.observe(region);
    sizes.observe(table);
    schedule();
  };
  const scan = (node: Node): void => {
    if (!(node instanceof HTMLElement)) return;
    if (node.matches('table, .table')) wrap(node);
    node.querySelectorAll<HTMLElement>('table, .table').forEach(wrap);
  };
  scan(document.body);
  new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(scan));
    schedule();
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}

/** Native LuCI tabs must stay immediately before their pane group. */
function initPageTabs(main: HTMLElement): void {
  const breadcrumb = main.querySelector<HTMLElement>('#sharp-breadcrumb');
  const fallback = main.querySelector<HTMLElement>('.sharp-page-meta');
  if (!breadcrumb || !fallback) return;
  const defaultTabs = element('ul', 'tabs sharp-fallback-tabs');
  const defaultItem = element('li', 'cbi-tab');
  const defaultLabel = element('span', 'sharp-tab-label');
  defaultLabel.setAttribute('aria-current', 'page');
  defaultItem.append(defaultLabel);
  defaultTabs.append(defaultItem);
  defaultTabs.hidden = true;
  fallback.append(defaultTabs);
  const menus = new Map<HTMLElement, Element | null>();
  const resized = new Set<HTMLElement>();
  let context: HTMLElement | undefined;
  let frame = 0;
  const schedule = (): void => { if (!frame) frame = requestAnimationFrame(sync); };
  const sizes = new ResizeObserver(entries => {
    entries.forEach(entry => resized.add(entry.target as HTMLElement));
    schedule();
  });
  const reveal = (menu: HTMLElement, item: Element): void => {
    if (!menu.clientWidth) return;
    const bounds = menu.getBoundingClientRect();
    const tab = item.getBoundingClientRect();
    // Only move this strip horizontally, never the page or its content.
    if (tab.width > menu.clientWidth || tab.left < bounds.left) menu.scrollLeft += tab.left - bounds.left;
    else if (tab.right > bounds.right) menu.scrollLeft += tab.right - bounds.right;
  };
  const sync = (): void => {
    frame = 0;
    // Limit this to a page's outer heading, not titles in cards or tab panes.
    const title = [...main.querySelectorAll<HTMLElement>('#view > h2, #view > div:not(.cbi-section) > h2, #view > form > .cbi-map > h2, #maincontent > h2, #maincontent > .cbi-map > h2')]
      .find(heading => !heading.closest('.cbi-section, [data-tab], .alert-message, .errorbox'));
    title?.classList.add('sharp-page-title');
    const lists = [...main.querySelectorAll<HTMLElement>('.tabs:not(.sharp-fallback-tabs), .cbi-tabmenu')];
    let next = lists.find(menu => menu.clientWidth > 0
      && [...menu.children].some(item => item.getClientRects().length > 0));
    // Prefer translated navigation text; never derive a title by splitting a path.
    const label = breadcrumb.dataset.pageTitle ?? title?.textContent?.trim() ?? '';
    if (defaultLabel.textContent !== label) defaultLabel.textContent = label;
    const showDefault = !next && !!label;
    if (defaultTabs.hidden === showDefault) defaultTabs.hidden = !showDefault;
    if (showDefault) {
      next = defaultTabs;
      lists.push(defaultTabs);
    }
    if (next !== context || (next && next.previousElementSibling !== breadcrumb)) {
      context?.classList.remove('sharp-context-tabs');
      context = next;
      if (context) {
        context.before(breadcrumb);
        context.classList.add('sharp-context-tabs');
      } else if (breadcrumb.parentElement !== fallback) fallback.append(breadcrumb);
    }
    if (breadcrumb.title !== breadcrumb.textContent) breadcrumb.title = breadcrumb.textContent ?? '';
    // Match the bottom divider even when a non-overlay scrollbar takes space.
    const height = `${context?.offsetHeight || 44}px`;
    if (breadcrumb.style.height !== height) breadcrumb.style.height = height;
    menus.forEach((_, menu) => {
      if (!main.contains(menu) || !lists.includes(menu)) {
        sizes.unobserve(menu);
        menus.delete(menu);
        resized.delete(menu);
      }
    });
    lists.forEach(menu => {
      const active = menu.querySelector('.cbi-tab, [aria-current="page"]');
      if (!menus.has(menu)) sizes.observe(menu);
      if (active && (!menus.has(menu) || menus.get(menu) !== active || resized.has(menu))) reveal(menu, active);
      menus.set(menu, active);
    });
    resized.clear();
  };
  main.addEventListener('focusin', event => {
    if (!(event.target instanceof HTMLElement)) return;
    const menu = event.target.closest<HTMLElement>('.tabs, .cbi-tabmenu');
    if (menu) reveal(menu, event.target);
  });
  new MutationObserver(records => {
    if (records.some(record => record.type !== 'attributes'
      || (record.target instanceof HTMLElement && record.target.matches('.tabs, .cbi-tabmenu, .tabs > li, .cbi-tabmenu > li, #tabmenu, [data-tab]')))) schedule();
  }).observe(main, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden', 'style', 'data-tab-active'] });
  sync();
}
