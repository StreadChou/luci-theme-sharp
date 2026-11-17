const paths = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  settings: '<path d="m9 3-.5 2.5L6 7l-2.5-.5L1 11l2 1.5v3L1 17l2.5 4.5L6 21l2.5 1.5L9 25h5l.5-2.5L17 21l2.5.5L22 17l-2-1.5v-3L22 11l-2.5-4.5L17 7l-2.5-1.5L14 3Z" transform="translate(2.6 .5) scale(.82)"/><circle cx="12" cy="12" r="3"/>',
  changes: '<path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 6.1A8 8 0 0 1 19.8 11M4.2 13a8 8 0 0 0 13.7 4.9"/>',
  pause: '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
  moon: '<path d="M21 13a9 9 0 0 1-10-10 9 9 0 1 0 10 10Z"/>',
  monitor: '<rect x="3" y="4" width="18" height="13"/><path d="M8 21h8m-4-4v4"/>',
  dashboard: '<path d="M4 19a10 10 0 1 1 16 0ZM12 14l5-5M5 12h2m10 0h2M12 4v2"/><circle cx="12" cy="14" r="1"/>',
  network: '<rect x="9" y="3" width="6" height="5"/><rect x="2" y="16" width="6" height="5"/><rect x="16" y="16" width="6" height="5"/><path d="M12 8v4M5 16v-4h14v4"/>',
  grid: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>',
  shield: '<path d="m12 2 8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5Z"/><path d="m8 12 3 3 5-6"/>',
  storage: '<rect x="3" y="3" width="18" height="7"/><rect x="3" y="14" width="18" height="7"/><path d="M6 6.5h1m-1 11h1M11 6.5h7m-7 11h7"/>',
  chart: '<path d="M3 3v18h18M7 17v-5m5 5V8m5 9V4"/>',
  chevron: '<path d="m8 10 4 4 4-4"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  password: '<rect x="5" y="10" width="14" height="11"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="m3 3 18 18M10.6 5.1 12 5c6.5 0 10 7 10 7a20 20 0 0 1-3 3.8M6.2 6.2A20 20 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.8-1.8M10 10a3 3 0 0 0 4 4"/>',
  reboot: '<path d="M12 2v10m-5-8a9 9 0 1 0 10 0"/>',
  logout: '<path d="M10 4H4v16h6m4-13 5 5-5 5m-6-5h11"/>'
} as const;

export type IconName = keyof typeof paths;

export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'square');
  svg.setAttribute('stroke-linejoin', 'miter');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = paths[name];
  return svg;
}

export function renderIcons(): void {
  document.querySelectorAll<HTMLElement>('[data-sharp-icon]').forEach(el => {
    const name = el.dataset.sharpIcon;
    if (name && name in paths) el.replaceChildren(icon(name as IconName));
  });
}
