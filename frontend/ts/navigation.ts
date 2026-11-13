import { t } from './i18n';
import { bindPopover, element } from './dom';
import { icon, type IconName } from './icons';
import { bindDisclosure } from './motion';

export interface SearchEntry { title: string; group: string; url: string }

export function initNavigation(ui: LuCIUI, tree: LuCIMenuNode): SearchEntry[] {
  const nav = document.querySelector<HTMLElement>('#sharp-nav')!;
  const mobileNav = document.querySelector<HTMLElement>('#sharp-mobile-nav')!;
  const breadcrumb = document.querySelector<HTMLElement>('#sharp-breadcrumb')!;
  const admin = tree.children?.admin;
  if (!admin) return [];
  const route = L.env.dispatchpath;
  const entries: SearchEntry[] = [];
  const groups = ui.menu.getChildren(admin).filter(node => node.name !== 'logout');
  groups.forEach(group => {
    const title = _(group.title);
    const items = ui.menu.getChildren(group);
    const container = element('div', 'sharp-nav-group');
    const active = route[1] === group.name;
    if (active) {
      breadcrumb.textContent = title;
      breadcrumb.dataset.pageTitle = title;
    }
    if (items.length) {
      const mobileGroup = element('details', `sharp-mobile-group${active ? ' is-active' : ''}`);
      mobileGroup.open = active;
      const summary = element('summary', 'sharp-mobile-category');
      summary.append(element('span', '', title), icon('chevron'));
      const mobileItems = element('div', 'sharp-mobile-links');
      mobileGroup.append(summary, mobileItems);
      mobileNav.append(mobileGroup);
      bindDisclosure(mobileGroup);
      const button = element('button', `sharp-nav-button${active ? ' is-active' : ''}`);
      button.type = 'button';
      button.id = `sharp-nav-toggle-${group.name}`;
      button.append(element('span', '', title), icon('chevron'));
      button.setAttribute('aria-expanded', 'false');
      const panel = element('div', 'sharp-popover sharp-nav-menu');
      panel.id = `sharp-nav-${group.name}`;
      panel.hidden = true;
      panel.setAttribute('role', 'menu');
      panel.setAttribute('aria-labelledby', button.id);
      button.setAttribute('aria-controls', panel.id);
      items.forEach(item => {
        const url = L.url('admin', group.name, item.name);
        const selected = active && route[2] === item.name;
        const link = element('a', `sharp-menu-item${selected ? ' is-active' : ''}`, _(item.title));
        link.href = url;
        link.setAttribute('role', 'menuitem');
        if (selected) {
          link.setAttribute('aria-current', 'page');
          breadcrumb.textContent = `${title} / ${_(item.title)}`;
          breadcrumb.dataset.pageTitle = _(item.title);
        }
        link.append(icon('arrow'));
        panel.append(link);
        const mobileLink = element('a', `sharp-menu-item${selected ? ' is-active' : ''}`, _(item.title));
        mobileLink.href = url;
        if (selected) mobileLink.setAttribute('aria-current', 'page');
        mobileItems.append(mobileLink);
        entries.push({ title: _(item.title), group: title, url });
      });
      container.append(button, panel);
      bindPopover(button, panel);
    } else {
      const link = element('a', `sharp-nav-button${active ? ' is-active' : ''}`, title);
      link.href = L.url('admin', group.name);
      container.append(link);
      const mobileLink = element('a', `sharp-mobile-category${active ? ' is-active' : ''}`, title);
      mobileLink.href = link.href;
      if (active) mobileLink.setAttribute('aria-current', 'page');
      mobileNav.append(mobileLink);
      entries.push({ title, group: title, url: link.href });
    }
    nav.append(container);
  });

  // Preserve LuCI's own subpage tabs inside the content area, without adding
  // a third level to the top navigation or creating a cached tab workspace.
  const tabs = document.querySelector<HTMLElement>('#tabmenu')!;
  let node: LuCIMenuNode | undefined = tree;
  for (const segment of route.slice(0, 3)) node = node?.children?.[segment];
  const children = node ? ui.menu.getChildren(node) : [];
  if (children.length) {
    const list = element('ul', 'tabs');
    children.forEach(child => {
      const item = element('li', route[3] === child.name ? 'cbi-tab' : 'cbi-tab-disabled');
      const link = element('a', '', _(child.title));
      link.href = L.url(...route.slice(0, 3), child.name);
      if (route[3] === child.name) link.setAttribute('aria-current', 'page');
      item.append(link);
      list.append(item);
    });
    tabs.append(list);
    tabs.hidden = false;
  }
  initUserMenu(tree);
  return entries;
}

function initUserMenu(tree: LuCIMenuNode): void {
  const trigger = document.querySelector<HTMLButtonElement>('#sharp-user-toggle')!;
  const panel = document.querySelector<HTMLElement>('#sharp-user-menu')!;
  const mobilePanel = document.querySelector<HTMLElement>('#sharp-settings-user-links')!;
  const items: Array<[string[], string, IconName]> = [
    [['admin', 'system', 'admin', 'password'], t('Router password'), 'password'],
    [['admin', 'system', 'reboot'], t('Reboot router'), 'reboot'],
    [['admin', 'logout'], t('Log out'), 'logout']
  ];
  items.forEach(([path, title, name]) => {
    let node: LuCIMenuNode | undefined = tree;
    for (const segment of path) node = node?.children?.[segment];
    if (!node || node.satisfied === false) return;
    const link = element('a', `sharp-menu-item${name === 'logout' ? ' sharp-logout' : ''}`);
    link.href = L.url(...path);
    link.setAttribute('role', 'menuitem');
    link.append(icon(name), element('span', '', title));
    panel.append(link);
    const mobileLink = link.cloneNode(true) as HTMLAnchorElement;
    mobileLink.removeAttribute('role');
    mobilePanel.append(mobileLink);
  });
  trigger.title = t('User menu');
  trigger.setAttribute('aria-label', trigger.title);
  bindPopover(trigger, panel);
}
