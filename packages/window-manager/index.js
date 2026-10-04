import { EventBus } from "../core/index.js";
import { h, icon, button, showMenu } from "../ui/index.js";

export class WindowManager extends EventBus {
  constructor(container, settings) {
    super();
    this.container = container;
    this.settings = settings;
    this.windows = [];
    this.active = null;
    this.nextId = 1;
    this.z = 20;
    this.hiddenWindows = null;
    this.lifecycle = new AbortController();
    window.addEventListener("resize", () => this.reflow(), {
      signal: this.lifecycle.signal,
    });
  }
  get bounds() {
    return {
      width: this.container.clientWidth,
      height: this.container.clientHeight,
    };
  }
  create(options = {}) {
    const id = this.nextId++,
      b = this.bounds,
      saved = options.remember
        ? this.settings.get("window." + options.appId, null)
        : null;
    const width = Math.min(options.width || 740, b.width),
      height = Math.min(options.height || 480, b.height);
    const rect = saved || {
      x:
        options.x ??
        Math.max(
          10,
          Math.round((b.width - width) / 2) + (this.windows.length % 4) * 22,
        ),
      y:
        options.y ??
        Math.max(
          12,
          Math.round((b.height - height) / 2) -
            24 +
            (this.windows.length % 4) * 22,
        ),
      width,
      height,
    };
    const el = h("section", {
        class: "aero-window",
        role: "dialog",
        "aria-label": options.title || "Window",
        tabIndex: -1,
        "data-window-id": id,
      }),
      title = h("span", { class: "window-title" }, options.title || "Window"),
      body = h("div", { class: "window-body" }),
      controls = h("div", { class: "caption-buttons" });
    const win = {
      id,
      el,
      title: options.title || "Window",
      icon: options.icon || "computer",
      appId: options.appId || "app",
      body,
      rect: { ...rect },
      restoreRect: null,
      minimized: false,
      maximized: false,
      modal: !!options.modal,
      owner: options.owner || null,
      resizable: options.resizable !== false,
      lifecycle: new AbortController(),
      beforeClose: null,
      closed: false,
      setTitle: (value) => {
        win.title = value;
        title.textContent = value;
        el.setAttribute("aria-label", value);
        this.emit("change", win);
      },
      setIcon: (value) => {
        win.icon = value;
        this.emit("change", win);
      },
      close: () => this.close(win),
      forceClose: () => this.close(win, true),
      focus: () => this.focus(win),
      minimize: () => this.minimize(win),
      maximize: () => this.maximize(win),
      onCleanup: (fn) =>
        win.lifecycle.signal.addEventListener("abort", fn, { once: true }),
      signal: null,
    };
    win.signal = win.lifecycle.signal;
    const system = button(
      icon(win.icon, 16),
      (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        this.systemMenu(win, r.left, r.bottom);
      },
      "system-icon",
      { "aria-label": "Window menu" },
    );
    system.ondblclick = () => win.close();
    const titlebar = h(
      "header",
      { class: "titlebar" },
      system,
      title,
      controls,
    );
    if (!win.modal) {
      controls.append(
        button("−", () => this.minimize(win), "caption-button minimize", {
          "aria-label": "Minimize",
          title: "Minimize",
        }),
      );
      controls.append(
        button(
          h("span", { class: "maximize-symbol" }),
          () => this.maximize(win),
          "caption-button maximize",
          {
            "aria-label": "Maximize",
            title: "Maximize",
            disabled: !win.resizable,
          },
        ),
      );
    }
    controls.append(
      button("×", () => win.close(), "caption-button close", {
        "aria-label": "Close",
        title: "Close",
      }),
    );
    el.append(titlebar, body);
    if (win.resizable)
      for (const edge of ["n", "ne", "e", "se", "s", "sw", "w", "nw"]) {
        const handle = h("div", {
          class: `resize-handle resize-${edge}`,
          "data-edge": edge,
        });
        handle.addEventListener("pointerdown", (e) =>
          this.startResize(win, e, edge),
        );
        el.append(handle);
      }
    el.addEventListener(
      "pointerdown",
      (e) => {
        const modal = this.modalFor(win);
        if (modal) {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.focus(modal);
          return;
        }
        this.focus(win, false);
      },
      { capture: true },
    );
    el.addEventListener("focusin", (e) => {
      win.lastFocus = e.target;
    });
    el.addEventListener("keydown", (e) => {
      if (e.altKey && e.key === "F4") {
        e.preventDefault();
        win.close();
      }
      if (e.altKey && e.code === "Space") {
        e.preventDefault();
        const r = el.getBoundingClientRect();
        this.systemMenu(win, r.left + 8, r.top + 27);
      }
      if (win.modal && e.key === "Tab") {
        const nodes = [
          ...el.querySelectorAll(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea,[tabindex="0"]',
          ),
        ].filter((n) => n.offsetParent);
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    });
    titlebar.addEventListener("pointerdown", (e) => this.startDrag(win, e));
    titlebar.addEventListener("dblclick", (e) => {
      if (!e.target.closest("button") && win.resizable) this.maximize(win);
    });
    titlebar.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.systemMenu(win, e.clientX, e.clientY);
    });
    this.windows.push(win);
    this.container.append(el);
    this.clamp(win);
    this.applyRect(win);
    this.focus(win);
    this.emit("open", win);
    return win;
  }
  modalFor(win) {
    const direct = this.windows.find(
      (w) => w.modal && w.owner === win && !w.closed,
    );
    return direct ? this.modalFor(direct) || direct : null;
  }
  updateModality() {
    for (const win of this.windows) {
      const blocked = !!this.modalFor(win);
      win.el.inert = blocked;
      win.el.setAttribute("aria-modal", String(win.modal));
    }
  }
  focus(win, restoreFocus = true) {
    if (!win || win.closed) return;
    const modal = this.modalFor(win);
    if (modal) return this.focus(modal, true);
    if (win.minimized) {
      win.minimized = false;
      win.el.classList.remove("minimized");
    }
    const changed = this.active !== win;
    for (const w of this.windows) w.el.classList.toggle("active", w === win);
    this.active = win;
    win.el.style.zIndex = String(++this.z);
    this.updateModality();
    if (restoreFocus && (changed || !win.el.contains(document.activeElement))) {
      const target =
        win.lastFocus?.isConnected && !win.lastFocus.disabled
          ? win.lastFocus
          : win.el;
      target.focus({ preventScroll: true });
    }
    this.emit("change", win);
  }

  async close(win, force = false) {
    if (win.closed) return;
    const owned = this.windows.filter((w) => w.owner === win);
    if (owned.length && !force) {
      this.focus(owned.at(-1));
      return;
    }
    if (!force && win.beforeClose) {
      this.focus(win);
      if ((await win.beforeClose()) === false) return;
    }
    for (const child of owned) await this.close(child, true);
    if (win.closed) return;
    win.closed = true;
    if (!win.modal)
      this.settings.set("window." + win.appId, win.restoreRect || win.rect);
    win.lifecycle.abort();
    win.el.remove();
    this.windows = this.windows.filter((w) => w !== win);
    this.updateModality();
    if (this.active === win) {
      this.active = null;
      const next =
        win.owner && !win.owner.closed
          ? win.owner
          : [...this.windows]
              .filter((w) => !w.minimized)
              .sort(
                (a, b) => Number(b.el.style.zIndex) - Number(a.el.style.zIndex),
              )[0];
      this.focus(next);
    }
    this.emit("close", win);
    this.emit("change", win);
  }
  minimize(win) {
    if (win.modal) return;
    const modal = this.modalFor(win);
    if (modal) {
      this.focus(modal);
      return;
    }
    win.minimized = true;
    win.el.classList.add("minimized");
    if (this.active === win) {
      this.active = null;
      this.focus(
        [...this.windows]
          .filter((w) => !w.minimized)
          .sort(
            (a, b) => Number(b.el.style.zIndex) - Number(a.el.style.zIndex),
          )[0],
      );
    }
    this.emit("change", win);
  }
  maximize(win) {
    if (!win.resizable) return;
    if (win.maximized) {
      win.rect = { ...win.restoreRect };
      win.restoreRect = null;
      win.maximized = false;
    } else {
      win.restoreRect = { ...win.rect };
      win.maximized = true;
      win.rect = { x: 0, y: 0, ...this.bounds };
    }
    win.el.classList.toggle("maximized", win.maximized);
    win.el
      .querySelector(".maximize")
      ?.setAttribute("aria-label", win.maximized ? "Restore" : "Maximize");
    this.applyRect(win);
    this.focus(win);
  }
  applyRect(win) {
    const r = win.rect;
    Object.assign(win.el.style, {
      left: Math.round(r.x) + "px",
      top: Math.round(r.y) + "px",
      width: Math.round(r.width) + "px",
      height: Math.round(r.height) + "px",
    });
    win.el.dispatchEvent(new CustomEvent("windowresize"));
  }
  clamp(win) {
    const b = this.bounds;
    win.rect.width = Math.min(win.rect.width, b.width);
    win.rect.height = Math.min(win.rect.height, b.height);
    win.rect.x = Math.max(0, Math.min(win.rect.x, b.width - win.rect.width));
    win.rect.y = Math.max(0, Math.min(win.rect.y, b.height - 40));
  }
  reflow() {
    for (const w of this.windows) {
      if (w.maximized) w.rect = { x: 0, y: 0, ...this.bounds };
      else this.clamp(w);
      this.applyRect(w);
    }
    this.emit("change");
  }
  startDrag(win, e) {
    if (e.button !== 0 || e.target.closest("button") || win.maximized) return;
    e.preventDefault();
    this.focus(win);
    const start = { x: e.clientX, y: e.clientY, ...win.rect },
      target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    win.el.classList.add("moving");
    const move = (ev) => {
      win.rect.x = start.x + (ev.clientX - e.clientX);
      win.rect.y = start.y + (ev.clientY - e.clientY);
      this.clamp(win);
      this.applyRect(win);
    };
    this.trackPointer(target, e, move, () => win.el.classList.remove("moving"));
  }
  startResize(win, e, edge) {
    if (e.button !== 0 || win.maximized) return;
    e.preventDefault();
    e.stopPropagation();
    this.focus(win);
    const start = { ...win.rect },
      target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const dx = ev.clientX - e.clientX,
        dy = ev.clientY - e.clientY;
      let { x, y, width, height } = start;
      const minW = Math.min(260, this.bounds.width),
        minH = 120;
      if (edge.includes("e")) width = Math.max(minW, start.width + dx);
      if (edge.includes("s")) height = Math.max(minH, start.height + dy);
      if (edge.includes("w")) {
        width = Math.max(minW, start.width - dx);
        x = start.x + start.width - width;
      }
      if (edge.includes("n")) {
        height = Math.max(minH, start.height - dy);
        y = start.y + start.height - height;
      }
      win.rect = { x, y, width, height };
      this.clamp(win);
      this.applyRect(win);
    };
    this.trackPointer(target, e, move);
  }
  trackPointer(target, e, move, done = () => {}) {
    const lifecycle = new AbortController();
    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true;
      lifecycle.abort();
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {}
      done();
    };
    target.addEventListener("pointermove", move, { signal: lifecycle.signal });
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      target.addEventListener(event, end, { signal: lifecycle.signal });
    window.addEventListener("blur", end, { signal: lifecycle.signal });
    this.lifecycle.signal.addEventListener("abort", end, {
      once: true,
      signal: lifecycle.signal,
    });
  }

  systemMenu(win, x, y) {
    showMenu(
      [
        {
          label: "Restore",
          disabled: !win.maximized && !win.minimized,
          action: () => (win.maximized ? this.maximize(win) : this.focus(win)),
        },
        {
          label: "Minimize",
          disabled: win.modal,
          action: () => this.minimize(win),
        },
        {
          label: "Maximize",
          disabled: win.maximized || !win.resizable,
          action: () => this.maximize(win),
        },
        null,
        { label: "Close", shortcut: "Alt+F4", action: () => win.close() },
      ],
      x,
      y,
    );
  }
  showDesktop() {
    if (this.hiddenWindows) {
      for (const w of this.hiddenWindows) if (!w.closed) this.focus(w);
      this.hiddenWindows = null;
    } else {
      this.hiddenWindows = this.windows.filter((w) => !w.minimized && !w.modal);
      for (const w of this.hiddenWindows) this.minimize(w);
    }
  }
  cascade() {
    let i = 0;
    for (const w of this.windows.filter((w) => !w.modal)) {
      if (w.maximized) this.maximize(w);
      w.rect.x = 30 + (i % 8) * 28;
      w.rect.y = 24 + (i % 8) * 28;
      this.clamp(w);
      this.applyRect(w);
      this.focus(w);
      i++;
    }
  }
  tile(vertical = false) {
    const rows = this.windows.filter((w) => !w.minimized && !w.modal),
      b = this.bounds;
    rows.forEach((w, i) => {
      w.maximized = false;
      w.restoreRect = null;
      w.el.classList.remove("maximized");
      w.rect = vertical
        ? {
            x: (i * b.width) / rows.length,
            y: 0,
            width: b.width / rows.length,
            height: b.height,
          }
        : {
            x: 0,
            y: (i * b.height) / rows.length,
            width: b.width,
            height: b.height / rows.length,
          };
      this.applyRect(w);
    });
  }
  cycle() {
    const rows = this.windows.filter((w) => !w.modal);
    if (rows.length)
      this.focus(rows[(rows.indexOf(this.active) + 1) % rows.length]);
  }
  dispose() {
    this.lifecycle.abort();
    for (const win of [...this.windows]) this.close(win, true);
  }
}
