"use strict";
(() => {
  // frontend/ts/i18n.ts
  function t(message) {
    return typeof _ === "function" ? _(message, "sharp") : message;
  }
  function tn(count, singular, plural) {
    const message = typeof N_ === "function" ? N_(count, singular, plural, "sharp") : count === 1 ? singular : plural;
    return message.replace(/%d/g, String(count));
  }

  // frontend/ts/motion.ts
  var reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  var running = /* @__PURE__ */ new Map();
  function cancelMotion(target) {
    const motion = running.get(target);
    if (!motion) return;
    running.delete(target);
    motion.animation.onfinish = null;
    motion.animation.cancel();
  }
  function animate(target, frames, opening, complete, immediate = false) {
    cancelMotion(target);
    const style = getComputedStyle(target);
    const duration = parseFloat(style.getPropertyValue(opening ? "--sharp-motion-enter" : "--sharp-motion-exit"));
    if (immediate || reducedMotion.matches || !duration || typeof target.animate !== "function") {
      complete();
      return;
    }
    const animation = target.animate(frames, {
      duration,
      easing: style.getPropertyValue("--sharp-motion-ease").trim(),
      fill: "both"
    });
    const finish = () => {
      if (running.get(target)?.animation !== animation) return;
      cancelMotion(target);
      complete();
    };
    running.set(target, { animation, finish });
    animation.onfinish = finish;
  }
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) [...running.values()].forEach((motion) => motion.finish());
  });
  function animatePanel(panel, opening, complete = () => {
  }, immediate = false) {
    const style = getComputedStyle(panel);
    const shown = { opacity: "1", translate: "0px 0px" };
    const hidden = {
      opacity: style.getPropertyValue("--sharp-motion-opacity").trim() || "0",
      translate: style.getPropertyValue("--sharp-motion-offset").trim() || "0px -6px"
    };
    const from = running.has(panel) ? { opacity: style.opacity, translate: style.translate } : opening ? hidden : shown;
    animate(panel, [from, opening ? shown : hidden], opening, complete, immediate);
  }
  function bindDisclosure(details) {
    const summary = details.querySelector("summary");
    const content = details.querySelector(".sharp-mobile-links");
    if (!summary || !content) return;
    let expanded = details.open;
    summary.setAttribute("aria-expanded", String(expanded));
    summary.addEventListener("click", (event) => {
      event.preventDefault();
      const from = details.getBoundingClientRect().height;
      cancelMotion(details);
      expanded = !expanded;
      summary.setAttribute("aria-expanded", String(expanded));
      content.inert = !expanded;
      details.open = true;
      const border = parseFloat(getComputedStyle(details).borderBottomWidth) || 0;
      const to = expanded ? details.getBoundingClientRect().height : summary.getBoundingClientRect().height + border;
      details.style.overflow = "hidden";
      animate(details, [{ height: `${from}px` }, { height: `${to}px` }], expanded, () => {
        details.open = expanded;
        details.style.removeProperty("overflow");
        content.inert = false;
      });
    });
  }

  // frontend/ts/dom.ts
  function element(tag, className = "", text) {
    const el = document.createElement(tag);
    el.className = className;
    if (text !== void 0) el.textContent = text;
    return el;
  }
  var current;
  function fitPopover(panel) {
    const header = panel.closest(".sharp-header");
    const container = panel.offsetParent;
    if (header && container instanceof HTMLElement) {
      const anchorBottom = header.getBoundingClientRect().bottom - container.getBoundingClientRect().top - container.clientTop + container.scrollTop;
      panel.style.setProperty("--sharp-popover-anchor-bottom", `${anchorBottom}px`);
    }
    panel.style.setProperty("--sharp-popover-shift", "0px");
    const rect = panel.getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    const shift = Math.max(16 - rect.left, Math.min(0, width - 16 - rect.right));
    panel.style.setProperty("--sharp-popover-shift", `${shift}px`);
  }
  function closePopover(restoreFocus = false, immediate = false) {
    const popover = current;
    if (!popover || popover.closing && !immediate) return;
    popover.closing = true;
    if (popover.toggleTrigger) popover.trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) popover.trigger.focus({ preventScroll: true });
    popover.panel.inert = true;
    animatePanel(popover.panel, false, () => {
      popover.panel.hidden = true;
      popover.panel.inert = false;
      if (current === popover) current = void 0;
    }, immediate);
  }
  function bindPopover(trigger, panel, options = {}) {
    const toggleTrigger = options.toggleTrigger !== false;
    const open = () => {
      if (current?.panel === panel && !current.closing) return;
      if (current?.panel !== panel) {
        closePopover(current?.panel.contains(document.activeElement), true);
      }
      panel.hidden = false;
      panel.inert = false;
      fitPopover(panel);
      if (toggleTrigger) trigger.setAttribute("aria-expanded", "true");
      current = { trigger, panel, closing: false, toggleTrigger };
      animatePanel(panel, true);
    };
    if (toggleTrigger) {
      trigger.addEventListener("click", () => current?.panel === panel && !current.closing ? closePopover() : open());
      trigger.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          open();
          panel.querySelector("a, button")?.focus();
        }
      });
    }
    panel.addEventListener("keydown", (event) => {
      const items = [...panel.querySelectorAll("a, button:not(:disabled)")];
      const index = items.indexOf(document.activeElement);
      const next = event.key === "ArrowDown" ? (index + 1) % items.length : event.key === "ArrowUp" ? (index - 1 + items.length) % items.length : event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : -1;
      if (next >= 0) {
        event.preventDefault();
        items[next]?.focus();
      }
    });
    return {
      open,
      close: (restoreFocus = false, immediate = false) => {
        if (current?.panel === panel) closePopover(restoreFocus, immediate);
      }
    };
  }
  function bindPopoverDismissal() {
    const reposition = () => {
      if (!current) return;
      if (!current.trigger.getClientRects().length) closePopover(false, true);
      else fitPopover(current.panel);
    };
    window.addEventListener("resize", reposition);
    const header = document.querySelector(".sharp-header");
    if (header) new ResizeObserver(reposition).observe(header);
    document.addEventListener("click", (event) => {
      if (current && !current.panel.contains(event.target) && !current.trigger.contains(event.target)) closePopover();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && current) {
        const focusInside = current.panel.contains(document.activeElement) || current.trigger === document.activeElement;
        closePopover(focusInside);
      }
    });
    document.addEventListener("focusin", (event) => {
      if (current && !current.panel.contains(event.target) && !current.trigger.contains(event.target)) closePopover();
    });
  }

  // frontend/ts/icons.ts
  var paths = {
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
    "eye-off": '<path d="m3 3 18 18M10.6 5.1 12 5c6.5 0 10 7 10 7a20 20 0 0 1-3 3.8M6.2 6.2A20 20 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.8-1.8M10 10a3 3 0 0 0 4 4"/>',
    reboot: '<path d="M12 2v10m-5-8a9 9 0 1 0 10 0"/>',
    logout: '<path d="M10 4H4v16h6m4-13 5 5-5 5m-6-5h11"/>'
  };
  function icon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.6");
    svg.setAttribute("stroke-linecap", "square");
    svg.setAttribute("stroke-linejoin", "miter");
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = paths[name];
    return svg;
  }
  function renderIcons() {
    document.querySelectorAll("[data-sharp-icon]").forEach((el) => {
      const name = el.dataset.sharpIcon;
      if (name && name in paths) el.replaceChildren(icon(name));
    });
  }

  // frontend/ts/appearance.ts
  var key = "sharp:appearance";
  function initAppearance() {
    const root = document.documentElement;
    const preference = matchMedia("(prefers-color-scheme: dark)");
    const trigger = document.querySelector("#sharp-appearance-toggle");
    const panel = document.querySelector("#sharp-appearance-menu");
    const mobilePanel = document.querySelector("#sharp-mobile-appearance");
    let mode = root.dataset.sharpMode || "system";
    const options = [
      ["light", t("Light")],
      ["dark", t("Dark")],
      ["system", t("Follow system")]
    ];
    const apply = () => {
      root.dataset.sharpMode = mode;
      root.dataset.sharpTheme = mode === "system" ? preference.matches ? "dark" : "light" : mode;
      if (trigger) {
        trigger.replaceChildren(icon(mode === "system" ? "monitor" : mode === "dark" ? "moon" : "sun"));
        const label = `${t("Appearance")} \xB7 ${options.find((entry) => entry[0] === mode)?.[1]}`;
        trigger.title = label;
        trigger.setAttribute("aria-label", label);
      }
      panel?.querySelectorAll("[data-mode]").forEach((button) => {
        button.setAttribute("aria-checked", String(button.dataset.mode === mode));
      });
      mobilePanel?.querySelectorAll("[data-mode]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
      });
    };
    preference.addEventListener("change", apply);
    window.addEventListener("storage", (event) => {
      if (event.key !== key) return;
      mode = options.some((entry) => entry[0] === event.newValue) ? event.newValue : "system";
      apply();
    });
    const choose = (value) => {
      mode = value;
      try {
        localStorage.setItem(key, mode);
      } catch {
      }
      apply();
    };
    const mobileTitle = document.querySelector("#sharp-settings-appearance-title");
    if (mobileTitle) mobileTitle.textContent = t("Appearance");
    options.forEach(([value, label]) => {
      if (!mobilePanel) return;
      const button = element("button", "sharp-appearance-option");
      button.type = "button";
      button.dataset.mode = value;
      button.append(icon(value === "system" ? "monitor" : value === "dark" ? "moon" : "sun"), element("span", "", label));
      button.addEventListener("click", () => choose(value));
      mobilePanel.append(button);
    });
    if (trigger && panel) {
      panel.append(element("div", "sharp-menu-caption", t("APPEARANCE")));
      options.forEach(([value, label]) => {
        const button = element("button", "sharp-menu-item");
        button.type = "button";
        button.dataset.mode = value;
        button.setAttribute("role", "menuitemradio");
        button.append(icon(value === "system" ? "monitor" : value === "dark" ? "moon" : "sun"), element("span", "", label), icon("check"));
        button.addEventListener("click", () => {
          choose(value);
          closePopover(true);
        });
        panel.append(button);
      });
      bindPopover(trigger, panel);
    }
    apply();
  }

  // frontend/ts/desktop-layout.ts
  var key2 = "sharp:desktop-layout";
  var normalize = (value) => value === "argon" ? "argon" : "default";
  function initDesktopLayout() {
    const header = document.querySelector("#sharp-header");
    if (!header) return;
    const workspace = document.querySelector(".sharp-workspace-content");
    const root = document.documentElement;
    const controls = document.querySelectorAll('input[name="sharp-desktop-layout"]');
    const mobile = matchMedia("(max-width: 900px)");
    let navigationFocus;
    document.addEventListener("focusin", (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && target !== document.body) {
        navigationFocus = target.closest("#sharp-nav, #sharp-sidebar") ? target : void 0;
      }
    });
    const restoreVisibleFocus = () => {
      const active = document.activeElement === document.body ? navigationFocus : document.activeElement;
      if (active instanceof HTMLElement && active.closest("#sharp-nav, #sharp-sidebar") && !active.getClientRects().length) {
        const target = mobile.matches ? document.querySelector("#sharp-mobile-menu-toggle") : header.querySelector(".sharp-brand");
        target?.focus({ preventScroll: true });
      }
    };
    const apply = (layout) => {
      if (root.dataset.sharpDesktopLayout !== layout) closePopover(false, true);
      root.dataset.sharpDesktopLayout = layout;
      controls.forEach((input) => {
        input.checked = input.value === layout;
      });
      restoreVisibleFocus();
    };
    controls.forEach((input) => input.addEventListener("change", () => {
      if (!input.checked) return;
      const layout = normalize(input.value);
      try {
        localStorage.setItem(key2, layout);
      } catch {
      }
      apply(layout);
    }));
    window.addEventListener("storage", (event) => {
      if (event.storageArea === localStorage && (event.key === key2 || event.key === null)) apply(normalize(event.newValue));
    });
    window.addEventListener("pageshow", () => {
      try {
        apply(normalize(localStorage.getItem(key2)));
      } catch {
      }
    });
    mobile.addEventListener("change", restoreVisibleFocus);
    const sizes = new ResizeObserver(() => {
      const height = `${header.getBoundingClientRect().height}px`;
      if (root.style.getPropertyValue("--sharp-shell-header-height") !== height) root.style.setProperty("--sharp-shell-header-height", height);
      if (workspace) {
        const width = `${workspace.getBoundingClientRect().width}px`;
        if (workspace.style.getPropertyValue("--sharp-workspace-width") !== width) workspace.style.setProperty("--sharp-workspace-width", width);
      }
    });
    sizes.observe(header);
    if (workspace) sizes.observe(workspace);
    apply(normalize(root.dataset.sharpDesktopLayout));
  }

  // frontend/ts/sidebar.ts
  var groupIcons = {
    status: "dashboard",
    system: "settings",
    network: "network",
    services: "grid",
    vpn: "shield",
    nas: "storage",
    statistics: "chart"
  };
  function initSidebar(ui, groups, route) {
    const primary = document.querySelector("#sharp-sidebar-primary");
    const secondary = document.querySelector("#sharp-sidebar-secondary");
    if (!primary || !secondary) return;
    const entries = [];
    const select = (index) => {
      entries.forEach(({ button, panel }, position) => {
        button.setAttribute("aria-expanded", String(position === index));
        panel.hidden = position !== index;
      });
    };
    groups.forEach((group, index) => {
      const button = element("button", "sharp-sidebar-group");
      button.type = "button";
      button.id = `sharp-sidebar-group-${group.name}`;
      const groupIcon = Object.hasOwn(groupIcons, group.name) ? groupIcons[group.name] : "grid";
      button.append(icon(groupIcon), element("span", "", _(group.title)));
      const panel = element("nav", "sharp-sidebar-links");
      panel.id = `sharp-sidebar-links-${group.name}`;
      panel.setAttribute("aria-labelledby", button.id);
      button.setAttribute("aria-controls", panel.id);
      panel.hidden = true;
      const children = ui.menu.getChildren(group);
      const items = children.length ? children : [group];
      items.forEach((item) => {
        const selected = route[1] === group.name && (!children.length || route[2] === item.name);
        const link = element("a", `sharp-menu-item${selected ? " is-active" : ""}`, _(item.title));
        link.href = children.length ? L.url("admin", group.name, item.name) : L.url("admin", group.name);
        if (selected) link.setAttribute("aria-current", "page");
        panel.append(link);
      });
      button.addEventListener("click", () => select(index));
      button.addEventListener("keydown", (event) => {
        const next = event.key === "ArrowDown" ? (index + 1) % entries.length : event.key === "ArrowUp" ? (index - 1 + entries.length) % entries.length : event.key === "Home" ? 0 : event.key === "End" ? entries.length - 1 : -1;
        if (next >= 0) {
          event.preventDefault();
          select(next);
          entries[next]?.button.focus();
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          select(index);
          panel.querySelector("a")?.focus();
        }
      });
      panel.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft" || event.key === "Escape") {
          event.preventDefault();
          button.focus();
        }
      });
      entries.push({ button, panel });
      primary.append(button);
      secondary.append(panel);
    });
    select(Math.max(0, groups.findIndex((group) => group.name === route[1])));
  }

  // frontend/ts/navigation.ts
  function initNavigation(ui, tree) {
    const nav = document.querySelector("#sharp-nav");
    const mobileNav = document.querySelector("#sharp-mobile-nav");
    const breadcrumb = document.querySelector("#sharp-breadcrumb");
    const admin = tree.children?.admin;
    if (!admin) return [];
    const route = L.env.dispatchpath;
    const entries = [];
    const groups = ui.menu.getChildren(admin).filter((node2) => node2.name !== "logout");
    initSidebar(ui, groups, route);
    groups.forEach((group) => {
      const title = _(group.title);
      const items = ui.menu.getChildren(group);
      const container = element("div", "sharp-nav-group");
      const active = route[1] === group.name;
      if (active) {
        breadcrumb.textContent = title;
        breadcrumb.dataset.pageTitle = title;
      }
      if (items.length) {
        const mobileGroup = element("details", `sharp-mobile-group${active ? " is-active" : ""}`);
        mobileGroup.open = active;
        const summary = element("summary", "sharp-mobile-category");
        summary.append(element("span", "", title), icon("chevron"));
        const mobileItems = element("div", "sharp-mobile-links");
        mobileGroup.append(summary, mobileItems);
        mobileNav.append(mobileGroup);
        bindDisclosure(mobileGroup);
        const button = element("button", `sharp-nav-button${active ? " is-active" : ""}`);
        button.type = "button";
        button.id = `sharp-nav-toggle-${group.name}`;
        button.append(element("span", "", title), icon("chevron"));
        button.setAttribute("aria-expanded", "false");
        const panel = element("div", "sharp-popover sharp-nav-menu");
        panel.id = `sharp-nav-${group.name}`;
        panel.hidden = true;
        panel.setAttribute("role", "menu");
        panel.setAttribute("aria-labelledby", button.id);
        button.setAttribute("aria-controls", panel.id);
        items.forEach((item) => {
          const url = L.url("admin", group.name, item.name);
          const selected = active && route[2] === item.name;
          const link = element("a", `sharp-menu-item${selected ? " is-active" : ""}`, _(item.title));
          link.href = url;
          link.setAttribute("role", "menuitem");
          if (selected) {
            link.setAttribute("aria-current", "page");
            breadcrumb.textContent = `${title} / ${_(item.title)}`;
            breadcrumb.dataset.pageTitle = _(item.title);
          }
          link.append(icon("arrow"));
          panel.append(link);
          const mobileLink = element("a", `sharp-menu-item${selected ? " is-active" : ""}`, _(item.title));
          mobileLink.href = url;
          if (selected) mobileLink.setAttribute("aria-current", "page");
          mobileItems.append(mobileLink);
          entries.push({ title: _(item.title), group: title, url });
        });
        container.append(button, panel);
        bindPopover(button, panel);
      } else {
        const link = element("a", `sharp-nav-button${active ? " is-active" : ""}`, title);
        link.href = L.url("admin", group.name);
        container.append(link);
        const mobileLink = element("a", `sharp-mobile-category${active ? " is-active" : ""}`, title);
        mobileLink.href = link.href;
        if (active) mobileLink.setAttribute("aria-current", "page");
        mobileNav.append(mobileLink);
        entries.push({ title, group: title, url: link.href });
      }
      nav.append(container);
    });
    const tabs = document.querySelector("#tabmenu");
    let node = tree;
    for (const segment of route.slice(0, 3)) node = node?.children?.[segment];
    const children = node ? ui.menu.getChildren(node) : [];
    if (children.length) {
      const list = element("ul", "tabs");
      children.forEach((child) => {
        const item = element("li", route[3] === child.name ? "cbi-tab" : "cbi-tab-disabled");
        const link = element("a", "", _(child.title));
        link.href = L.url(...route.slice(0, 3), child.name);
        if (route[3] === child.name) link.setAttribute("aria-current", "page");
        item.append(link);
        list.append(item);
      });
      tabs.append(list);
      tabs.hidden = false;
    }
    initUserMenu(tree);
    return entries;
  }
  function initUserMenu(tree) {
    const trigger = document.querySelector("#sharp-user-toggle");
    const panel = document.querySelector("#sharp-user-menu");
    const mobilePanel = document.querySelector("#sharp-settings-user-links");
    const items = [
      [["admin", "system", "admin", "password"], t("Router password"), "password"],
      [["admin", "system", "reboot"], t("Reboot router"), "reboot"],
      [["admin", "logout"], t("Log out"), "logout"]
    ];
    items.forEach(([path, title, name]) => {
      let node = tree;
      for (const segment of path) node = node?.children?.[segment];
      if (!node || node.satisfied === false) return;
      const link = element("a", `sharp-menu-item${name === "logout" ? " sharp-logout" : ""}`);
      link.href = L.url(...path);
      link.setAttribute("role", "menuitem");
      link.append(icon(name), element("span", "", title));
      panel.append(link);
      const mobileLink = link.cloneNode(true);
      mobileLink.removeAttribute("role");
      mobilePanel.append(mobileLink);
    });
    trigger.title = t("User menu");
    trigger.setAttribute("aria-label", trigger.title);
    bindPopover(trigger, panel);
  }

  // frontend/ts/dialogs.ts
  var current2;
  var openers = /* @__PURE__ */ new WeakMap();
  var dismissers = /* @__PURE__ */ new WeakMap();
  function closeDialogs() {
    if (current2) dismissers.get(current2)?.(true);
  }
  function bindDialog(dialog, triggers, focus, prepare) {
    let closing = false;
    const dismiss = (immediate = false) => {
      if (!dialog.open || closing && !immediate) return;
      closing = true;
      dialog.dataset.sharpClosing = "";
      triggers.forEach((button) => button.setAttribute("aria-expanded", "false"));
      animatePanel(dialog, false, () => {
        dialog.close();
        delete dialog.dataset.sharpClosing;
        closing = false;
        if (current2 === dialog) current2 = void 0;
      }, immediate);
    };
    dismissers.set(dialog, dismiss);
    const open = (trigger) => {
      if (document.body.classList.contains("modal-overlay-active")) return;
      if (!dialog.open) {
        const origin = trigger ?? (current2 && openers.get(current2)) ?? document.activeElement;
        closePopover(false, true);
        closeDialogs();
        if (origin instanceof HTMLElement) openers.set(dialog, origin);
        prepare?.();
        dialog.showModal();
        current2 = dialog;
        triggers.forEach((button) => button.setAttribute("aria-expanded", "true"));
        animatePanel(dialog, true);
      } else if (closing) {
        closing = false;
        delete dialog.dataset.sharpClosing;
        triggers.forEach((button) => button.setAttribute("aria-expanded", "true"));
        animatePanel(dialog, true);
      }
      focus?.();
    };
    triggers.forEach((button) => button.addEventListener("click", () => open(button)));
    dialog.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    }, true);
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      dismiss();
    });
    dialog.querySelectorAll("[data-sharp-dialog-close]").forEach((button) => {
      button.title = t("Close");
      button.setAttribute("aria-label", button.title);
      button.addEventListener("click", () => dismiss());
    });
    dialog.addEventListener("close", () => {
      if (dialog.open) return;
      cancelMotion(dialog);
      delete dialog.dataset.sharpClosing;
      closing = false;
      triggers.forEach((button) => button.setAttribute("aria-expanded", "false"));
      if (current2 === dialog) current2 = void 0;
      if (current2?.open || document.body.classList.contains("modal-overlay-active")) return;
      const opener = openers.get(dialog);
      const target = opener?.getClientRects().length ? opener : triggers.find((button) => button.getClientRects().length) ?? document.querySelector(".sharp-header .sharp-brand");
      target?.focus({ preventScroll: true });
    });
    const outside = (event) => {
      const rect = dialog.getBoundingClientRect();
      return event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
    };
    let backdrop = false;
    dialog.addEventListener("pointerdown", (event) => {
      backdrop = outside(event);
    });
    dialog.addEventListener("click", (event) => {
      if (backdrop && outside(event)) dismiss();
      backdrop = false;
    });
    return open;
  }
  function initMobileDialogs() {
    const menu = document.querySelector("#sharp-mobile-menu");
    const settings = document.querySelector("#sharp-settings-dialog");
    if (!menu || !settings) return;
    document.querySelector("#sharp-mobile-menu-title").textContent = t("Navigation");
    document.querySelector("#sharp-settings-title").textContent = t("Settings");
    const menuToggle = document.querySelector("#sharp-mobile-menu-toggle");
    const settingsToggle = document.querySelector("#sharp-settings-toggle");
    menuToggle.title = t("Open navigation");
    menuToggle.setAttribute("aria-label", menuToggle.title);
    settingsToggle.title = t("Settings");
    settingsToggle.setAttribute("aria-label", settingsToggle.title);
    bindDialog(menu, [menuToggle]);
    bindDialog(settings, [settingsToggle]);
    const mobile = matchMedia("(max-width: 900px)");
    mobile.addEventListener("change", () => {
      if (!mobile.matches && current2?.classList.contains("sharp-mobile-dialog")) closeDialogs();
      closePopover(false, true);
    });
    const indicators = document.querySelector("#indicators");
    indicators.addEventListener("click", (event) => {
      if (event.target.closest('[data-clickable="true"]')) closeDialogs();
    }, true);
    const desktop = document.querySelector(".sharp-header-end");
    const mobileIndicators = document.querySelector("#sharp-mobile-indicators");
    const placeIndicators = () => {
      (mobile.matches ? mobileIndicators : desktop).prepend(indicators);
    };
    mobile.addEventListener("change", placeIndicators);
    placeIndicators();
  }

  // frontend/ts/search.ts
  function initSearch(entries) {
    const dialog = document.querySelector("#sharp-search-dialog");
    const input = document.querySelector("#sharp-search-input");
    const panel = document.querySelector("#sharp-search-results");
    const status = document.querySelector("#sharp-search-status");
    const triggers = [...document.querySelectorAll("[data-sharp-search-open]")];
    const close = document.querySelector("#sharp-search-close");
    const title = t("Search menus");
    document.querySelector("#sharp-search-title").textContent = title;
    input.placeholder = t("Search menus\u2026");
    input.setAttribute("aria-label", title);
    document.querySelector(".sharp-search-label").textContent = input.placeholder;
    close.title = t("Close search");
    close.setAttribute("aria-label", close.title);
    triggers.forEach((trigger) => {
      trigger.title = title;
      trigger.setAttribute("aria-label", title);
    });
    const shortcut = document.querySelector(".sharp-search-shortcut");
    shortcut.textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? "\u2318 K" : "Ctrl K";
    const render = () => {
      const query = input.value.trim().toLocaleLowerCase();
      const matches = entries.filter((entry) => `${entry.group} ${entry.title}`.toLocaleLowerCase().includes(query)).slice(0, 8);
      panel.replaceChildren(element("div", "sharp-menu-caption", query ? t("SEARCH RESULTS") : t("QUICK ACCESS")));
      if (!matches.length) panel.append(element("p", "sharp-search-empty", t("No matching menu")));
      matches.forEach((entry) => {
        const link = element("a", "sharp-search-result");
        link.href = entry.url;
        const text = element("span", "sharp-search-result-label");
        text.append(element("strong", "", entry.title), element("small", "", entry.group));
        link.append(text, icon("arrow"));
        panel.append(link);
      });
      status.textContent = tn(matches.length, "%d menu result", "%d menu results");
    };
    const open = bindDialog(dialog, triggers, () => {
      input.focus({ preventScroll: true });
      input.select();
    }, () => {
      input.value = "";
      render();
    });
    input.addEventListener("input", render);
    input.addEventListener("keydown", (event) => {
      if (event.isComposing) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        panel.querySelector("a")?.focus();
      }
      if (event.key === "Enter") {
        event.preventDefault();
        panel.querySelector("a")?.click();
      }
    });
    panel.addEventListener("keydown", (event) => {
      const links = [...panel.querySelectorAll("a")];
      const index = links.indexOf(document.activeElement);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        links[(index + 1) % links.length]?.focus();
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (index <= 0) input.focus();
        else links[index - 1]?.focus();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (!event.isComposing && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        open();
      }
    });
  }

  // frontend/ts/layout.ts
  function initContentLayout() {
    const main = document.querySelector("#maincontent");
    if (!main) return;
    initPageTabs(main);
    const tables = /* @__PURE__ */ new Map();
    let frame = 0;
    const measure = () => {
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
          region.setAttribute("role", "region");
          region.setAttribute("aria-label", t("Table, scroll horizontally to see all content"));
        } else {
          region.removeAttribute("role");
          region.removeAttribute("aria-label");
        }
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const sizes = new ResizeObserver(schedule);
    const wrap = (table) => {
      const previous = tables.get(table);
      if (previous && table.parentElement === previous) return;
      if (previous) {
        sizes.unobserve(table);
        sizes.unobserve(previous);
        tables.delete(table);
        if (!previous.hasChildNodes()) previous.remove();
      }
      if (!table.closest("#maincontent, #modal_overlay") || table.parentElement?.closest("table, .table") || table.matches('[data-sharp-scroll="off"]')) return;
      let region = table.parentElement;
      if (region.classList.contains("sharp-table-scroll")) {
        tables.forEach((existing, oldTable) => {
          if (existing !== region) return;
          sizes.unobserve(oldTable);
          tables.delete(oldTable);
        });
      } else {
        if (region.closest(".sharp-table-scroll")) return;
        region = document.createElement("div");
        region.className = "sharp-table-scroll";
        table.before(region);
        region.append(table);
      }
      tables.set(table, region);
      sizes.observe(region);
      sizes.observe(table);
      schedule();
    };
    const scan = (node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.matches("table, .table")) wrap(node);
      node.querySelectorAll("table, .table").forEach(wrap);
    };
    scan(document.body);
    new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach(scan));
      schedule();
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  function initPageTabs(main) {
    const breadcrumb = main.querySelector("#sharp-breadcrumb");
    const fallback = main.querySelector(".sharp-page-meta");
    if (!breadcrumb || !fallback) return;
    const defaultTabs = element("ul", "tabs sharp-fallback-tabs");
    const defaultItem = element("li", "cbi-tab");
    const defaultLabel = element("span", "sharp-tab-label");
    defaultLabel.setAttribute("aria-current", "page");
    defaultItem.append(defaultLabel);
    defaultTabs.append(defaultItem);
    defaultTabs.hidden = true;
    fallback.append(defaultTabs);
    const menus = /* @__PURE__ */ new Map();
    const resized = /* @__PURE__ */ new Set();
    let context;
    let frame = 0;
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(sync);
    };
    const sizes = new ResizeObserver((entries) => {
      entries.forEach((entry) => resized.add(entry.target));
      schedule();
    });
    const reveal = (menu, item) => {
      if (!menu.clientWidth) return;
      const bounds = menu.getBoundingClientRect();
      const tab = item.getBoundingClientRect();
      if (tab.width > menu.clientWidth || tab.left < bounds.left) menu.scrollLeft += tab.left - bounds.left;
      else if (tab.right > bounds.right) menu.scrollLeft += tab.right - bounds.right;
    };
    const sync = () => {
      frame = 0;
      const title = [...main.querySelectorAll("#view > h2, #view > div:not(.cbi-section) > h2, #view > form > .cbi-map > h2, #maincontent > h2, #maincontent > .cbi-map > h2")].find((heading) => !heading.closest(".cbi-section, [data-tab], .alert-message, .errorbox"));
      title?.classList.add("sharp-page-title");
      const lists = [...main.querySelectorAll(".tabs:not(.sharp-fallback-tabs), .cbi-tabmenu")];
      let next = lists.find((menu) => menu.clientWidth > 0 && [...menu.children].some((item) => item.getClientRects().length > 0));
      const label = breadcrumb.dataset.pageTitle ?? title?.textContent?.trim() ?? "";
      if (defaultLabel.textContent !== label) defaultLabel.textContent = label;
      const showDefault = !next && !!label;
      if (defaultTabs.hidden === showDefault) defaultTabs.hidden = !showDefault;
      if (showDefault) {
        next = defaultTabs;
        lists.push(defaultTabs);
      }
      if (next !== context || next && next.previousElementSibling !== breadcrumb) {
        context?.classList.remove("sharp-context-tabs");
        context = next;
        if (context) {
          context.before(breadcrumb);
          context.classList.add("sharp-context-tabs");
        } else if (breadcrumb.parentElement !== fallback) fallback.append(breadcrumb);
      }
      if (breadcrumb.title !== breadcrumb.textContent) breadcrumb.title = breadcrumb.textContent ?? "";
      const height = `${context?.offsetHeight || 44}px`;
      if (breadcrumb.style.height !== height) breadcrumb.style.height = height;
      menus.forEach((_2, menu) => {
        if (!main.contains(menu) || !lists.includes(menu)) {
          sizes.unobserve(menu);
          menus.delete(menu);
          resized.delete(menu);
        }
      });
      lists.forEach((menu) => {
        const active = menu.querySelector('.cbi-tab, [aria-current="page"]');
        if (!menus.has(menu)) sizes.observe(menu);
        if (active && (!menus.has(menu) || menus.get(menu) !== active || resized.has(menu))) reveal(menu, active);
        menus.set(menu, active);
      });
      resized.clear();
    };
    main.addEventListener("focusin", (event) => {
      if (!(event.target instanceof HTMLElement)) return;
      const menu = event.target.closest(".tabs, .cbi-tabmenu");
      if (menu) reveal(menu, event.target);
    });
    new MutationObserver((records) => {
      if (records.some((record) => record.type !== "attributes" || record.target instanceof HTMLElement && record.target.matches(".tabs, .cbi-tabmenu, .tabs > li, .cbi-tabmenu > li, #tabmenu, [data-tab]"))) schedule();
    }).observe(main, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "hidden", "style", "data-tab-active"] });
    sync();
  }

  // frontend/ts/pending.ts
  function initPendingChanges(ui, indicators) {
    const button = document.querySelector("#sharp-pending");
    const panel = document.querySelector("#sharp-pending-notice");
    const message = document.querySelector("#sharp-pending-message");
    const dismiss = panel.querySelector("[data-sharp-notice-close]");
    const notice = bindPopover(button, panel, { toggleTrigger: false });
    let previousCount = 0;
    let queued = false;
    let frame = 0;
    const review = () => {
      queued = false;
      closePopover(false, true);
      closeDialogs();
      ui.changes.displayChanges();
    };
    button.addEventListener("click", review);
    panel.querySelector("[data-sharp-pending-review]").addEventListener("click", review);
    dismiss.title = t("Dismiss notification");
    dismiss.setAttribute("aria-label", dismiss.title);
    dismiss.addEventListener("click", () => {
      queued = false;
      notice.close(true);
    });
    const showWhenReady = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (document.body.classList.contains("modal-overlay-active") || document.querySelector(".sharp-dialog[open]")) {
          notice.close(false, true);
          return;
        }
        if (!queued || button.hidden) return;
        queued = false;
        notice.open();
      });
    };
    const modalObserver = new MutationObserver(showWhenReady);
    modalObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    document.querySelectorAll(".sharp-dialog").forEach((dialog) => {
      modalObserver.observe(dialog, { attributes: true, attributeFilter: ["open"] });
    });
    return () => {
      const available = indicators.querySelector('[data-indicator="uci-changes"]') !== null;
      const count = available ? Object.values(ui.changes.changes ?? {}).reduce((sum, changes) => sum + changes.length, 0) : 0;
      const label = tn(count, "%d pending configuration change; click to review", "%d pending configuration changes; click to review");
      button.hidden = count === 0;
      button.querySelector("[data-sharp-pending-count]").textContent = String(count);
      button.title = label;
      button.setAttribute("aria-label", label);
      if (count === previousCount) return;
      previousCount = count;
      queued = count > 0;
      if (!count) {
        const focusInside = panel.contains(document.activeElement) || button === document.activeElement;
        notice.close(false, true);
        if (focusInside) document.querySelector(".sharp-header .sharp-brand")?.focus({ preventScroll: true });
        return;
      }
      message.textContent = tn(count, "You have %d unsaved configuration change", "You have %d unsaved configuration changes");
      showWhenReady();
    };
  }

  // frontend/ts/login.ts
  function initLogin() {
    const input = document.querySelector("#sharp-password");
    const toggle = document.querySelector(".sharp-login-password-toggle");
    if (!input || !toggle) return;
    const showLabel = toggle.dataset.showLabel;
    const hideLabel = toggle.dataset.hideLabel;
    if (!showLabel || !hideLabel) return;
    const sync = () => {
      const revealed = input.type === "text";
      const label = revealed ? hideLabel : showLabel;
      toggle.title = label;
      toggle.setAttribute("aria-label", label);
      toggle.replaceChildren(icon(revealed ? "eye-off" : "eye"));
    };
    toggle.addEventListener("click", () => {
      input.type = input.type === "password" ? "text" : "password";
      sync();
    });
    window.addEventListener("pagehide", () => {
      input.type = "password";
      sync();
    });
    sync();
    toggle.hidden = false;
  }

  // frontend/ts/main.ts
  renderIcons();
  initAppearance();
  initDesktopLayout();
  bindPopoverDismissal();
  initContentLayout();
  initMobileDialogs();
  initLogin();
  document.querySelectorAll("[data-sharp-brand-logo]").forEach((image) => {
    const fallback = () => {
      const source = image.dataset.sharpBrandFallback;
      if (source && image.getAttribute("src") !== source) image.src = source;
    };
    image.addEventListener("error", fallback);
    if (image.complete && !image.naturalWidth) fallback();
  });
  document.querySelectorAll("[data-sharp-login-background]").forEach((image) => {
    const fallback = () => {
      image.hidden = true;
    };
    image.addEventListener("error", fallback);
    if (image.complete && !image.naturalWidth) fallback();
    const source = image.dataset.wallpaperSource;
    const endpoint = image.dataset.wallpaperEndpoint;
    if (!endpoint || source !== "bing" && source !== "wallhaven") return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8e3);
    const stop = () => controller.abort();
    window.addEventListener("pagehide", stop, { once: true });
    void fetch(endpoint + "?source=" + source, { signal: controller.signal, credentials: "omit", cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const result = await response.json();
      if (typeof result.url !== "string") return;
      const allowed = source === "bing" ? /^https:\/\/www\.bing\.com\/th\?id=OHR\.[A-Za-z0-9_.=&-]+$/ : /^https:\/\/w\.wallhaven\.cc\/full\/[a-z0-9]{2}\/wallhaven-[a-z0-9]{6}\.(jpg|png)$/;
      if (!allowed.test(result.url) || controller.signal.aborted) return;
      const online = new Image();
      online.referrerPolicy = "no-referrer";
      window.clearTimeout(timer);
      const url = result.url;
      await new Promise((resolve) => {
        const finish = () => {
          window.clearTimeout(imageTimer);
          online.onload = online.onerror = null;
          controller.signal.removeEventListener("abort", cancel);
          resolve();
        };
        const cancel = () => {
          online.src = "";
          finish();
        };
        const imageTimer = window.setTimeout(cancel, 1e4);
        controller.signal.addEventListener("abort", cancel, { once: true });
        online.onload = () => {
          if (!controller.signal.aborted) {
            image.referrerPolicy = "no-referrer";
            image.src = online.src;
            image.hidden = false;
          }
          finish();
        };
        online.onerror = finish;
        online.src = url;
      });
    }).catch(() => {
    }).finally(() => {
      window.clearTimeout(timer);
      window.removeEventListener("pagehide", stop);
    });
  });
  function initIndicators(ui) {
    const refreshes = document.querySelectorAll("[data-sharp-refresh]");
    const indicators = document.querySelector("#indicators");
    const syncPending = initPendingChanges(ui, indicators);
    refreshes.forEach((refresh) => {
      refresh.addEventListener("click", () => {
        indicators.querySelector('[data-indicator="poll-status"]')?.click();
      });
    });
    const sync = () => {
      const pollStatus = indicators.querySelector('[data-indicator="poll-status"]');
      const paused = pollStatus?.dataset.style === "inactive";
      const refreshLabel = paused ? t("Automatic refresh paused; click to resume") : t("Automatically refreshing; click to pause");
      refreshes.forEach((refresh) => {
        refresh.hidden = !pollStatus;
        refresh.title = refreshLabel;
        refresh.setAttribute("aria-label", refreshLabel);
        const indicator = refresh.querySelector("[data-sharp-icon]");
        const name = paused ? "pause" : "refresh";
        if (indicator && indicator.dataset.sharpIcon !== name) {
          indicator.dataset.sharpIcon = name;
          indicator.replaceChildren(icon(name));
        }
      });
      syncPending();
    };
    new MutationObserver(sync).observe(indicators, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["data-style"]
    });
    document.addEventListener("uci-applied", sync);
    document.addEventListener("uci-reverted", sync);
    sync();
  }
  async function start() {
    if (!document.querySelector("#sharp-header")) return;
    const ui = await L.require("ui");
    await ui.changes.init?.();
    initIndicators(ui);
    const tree = await ui.menu.load();
    initSearch(initNavigation(ui, tree));
  }
  void start().catch((error) => {
    console.error("Sharp navigation failed:", error);
    document.querySelectorAll("#sharp-nav, #sharp-mobile-nav, #sharp-sidebar-secondary").forEach((nav) => {
      nav.textContent = t("Menu unavailable. Please refresh.");
    });
  });
})();
