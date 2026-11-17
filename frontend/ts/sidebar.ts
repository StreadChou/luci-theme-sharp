import { element } from './dom';
import { icon, type IconName } from './icons';

type MenuGroup = LuCIMenuNode & { name: string; title: string };

// Only icon choices are mapped here; labels, links and permissions come from LuCI.
const groupIcons: Record<string, IconName> = {
  status: 'dashboard', system: 'settings', network: 'network',
  services: 'grid', vpn: 'shield', nas: 'storage', statistics: 'chart'
};

export function initSidebar(ui: LuCIUI, groups: MenuGroup[], route: string[]): void {
  const primary = document.querySelector<HTMLElement>('#sharp-sidebar-primary');
  const secondary = document.querySelector<HTMLElement>('#sharp-sidebar-secondary');
  if (!primary || !secondary) return;
  const entries: Array<{ button: HTMLButtonElement; panel: HTMLElement }> = [];
  const select = (index: number): void => {
    entries.forEach(({ button, panel }, position) => {
      button.setAttribute('aria-expanded', String(position === index));
      panel.hidden = position !== index;
    });
  };
  groups.forEach((group, index) => {
    const button = element('button', 'sharp-sidebar-group');
    button.type = 'button';
    button.id = `sharp-sidebar-group-${group.name}`;
    const groupIcon = Object.hasOwn(groupIcons, group.name) ? groupIcons[group.name] : 'grid';
    button.append(icon(groupIcon), element('span', '', _(group.title)));
    const panel = element('nav', 'sharp-sidebar-links');
    panel.id = `sharp-sidebar-links-${group.name}`;
    panel.setAttribute('aria-labelledby', button.id);
    button.setAttribute('aria-controls', panel.id);
    panel.hidden = true;
    const children = ui.menu.getChildren(group);
    const items = children.length ? children : [group];
    items.forEach(item => {
      const selected = route[1] === group.name && (!children.length || route[2] === item.name);
      const link = element('a', `sharp-menu-item${selected ? ' is-active' : ''}`, _(item.title));
      link.href = children.length ? L.url('admin', group.name, item.name) : L.url('admin', group.name);
      if (selected) link.setAttribute('aria-current', 'page');
      panel.append(link);
    });
    button.addEventListener('click', () => select(index));
    button.addEventListener('keydown', event => {
      const next = event.key === 'ArrowDown' ? (index + 1) % entries.length
        : event.key === 'ArrowUp' ? (index - 1 + entries.length) % entries.length
          : event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1 : -1;
      if (next >= 0) {
        event.preventDefault();
        select(next);
        entries[next]?.button.focus();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        select(index);
        panel.querySelector<HTMLAnchorElement>('a')?.focus();
      }
    });
    panel.addEventListener('keydown', event => {
      if (event.key === 'ArrowLeft' || event.key === 'Escape') {
        event.preventDefault();
        button.focus();
      }
    });
    entries.push({ button, panel });
    primary.append(button);
    secondary.append(panel);
  });
  select(Math.max(0, groups.findIndex(group => group.name === route[1])));
}
