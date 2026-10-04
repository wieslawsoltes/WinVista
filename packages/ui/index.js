import {
  basename,
  dirname,
  joinPath,
  resolvePath,
  prettyPath,
} from "../core/index.js";

/** DOM primitives preserve native editing, focus, IME and accessibility. */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null) continue;
    if (key === "class") el.className = value;
    else if (key === "style" && typeof value === "object")
      Object.assign(el.style, value);
    else if (key === "text") el.textContent = value;
    else if (key === "html") el.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function")
      el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (
      [
        "value",
        "checked",
        "disabled",
        "selected",
        "tabIndex",
        "draggable",
        "contentEditable",
      ].includes(key)
    )
      el[key] = value;
    else el.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity))
    if (child != null && child !== false)
      el.append(
        child instanceof Node ? child : document.createTextNode(String(child)),
      );
  return el;
}
const iconAliases = {
  explorer: "computer",
  recyclebin: "recycle",
  photo: "pictures",
  word: "wordpad",
  sound: "media",
  system: "computer",
  run: "run",
  terminal: "run",
  taskmanager: "computer",
  welcome: "computer",
  clock: "calendar",
  notes: "notepad",
  registry: "control",
  snipping: "paint",
  journal: "wordpad",
  movie: "videos",
  dvd: "media",
  mahjong: "games",
  services: "control",
  magnifier: "search",
  accessibility: "control",
};
export function icon(name = "folder", size = 32) {
  name = iconAliases[name] || name;
  const el = h("img", {
    class: "vista-icon",
    src: `/assets/icons/${name}${size <= 20 ? "-16" : size > 64 && ["computer", "media"].includes(name) ? "-large" : ""}.png`,
    width: size,
    height: size,
    alt: "",
    draggable: false,
    style: { width: `${size}px`, height: `${size}px` },
  });
  el.onerror = () => {
    el.onerror = null;
    el.src = "/assets/icons/folder.png";
  };
  return el;
}
export function fileIcon(entry) {
  if (entry.kind === "folder")
    return (
      {
        Documents: "documents",
        Pictures: "pictures",
        Music: "music",
        Videos: "videos",
        Contacts: "contacts",
        User: "user",
      }[entry.name] || "folder"
    );
  const ext = entry.name.split(".").pop().toLowerCase();
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext))
    return "pictures";
  if (["mp3", "wav", "ogg", "m4a", "flac"].includes(ext)) return "media";
  if (["mp4", "webm", "mov"].includes(ext)) return "videos";
  if (["html", "rtf"].includes(ext)) return "wordpad";
  return "notepad";
}
export function button(label, action, cls = "vista-button", attrs = {}) {
  return h(
    "button",
    { type: "button", class: cls, ...attrs, onclick: action },
    label,
  );
}
export function tool(label, iconName, action, attrs = {}) {
  return button(
    [icon(iconName, 16), h("span", {}, label)],
    action,
    "toolbar-button",
    attrs,
  );
}
export function field(label, input) {
  return h("label", { class: "field" }, h("span", {}, label), input);
}
export function separator() {
  return h("div", { class: "menu-separator", role: "separator" });
}

let currentMenu = null;
export function closeMenu() {
  currentMenu?.close();
}
export function showMenu(items, x, y, { onClose } = {}) {
  closeMenu();
  const menu = h("div", { class: "context-menu", role: "menu", tabIndex: -1 }),
    lifecycle = new AbortController();
  const close = () => {
    lifecycle.abort();
    menu.remove();
    if (currentMenu?.el === menu) currentMenu = null;
    onClose?.();
  };
  for (const item of items) {
    if (!item || item.separator) {
      menu.append(separator());
      continue;
    }
    const disabled =
      typeof item.disabled === "function" ? item.disabled() : item.disabled;
    const row = button(
      [
        h(
          "span",
          { class: "menu-glyph" },
          item.checked ? "✓" : item.icon ? icon(item.icon, 16) : "",
        ),
        h("span", { class: "menu-label" }, item.label),
        h("span", { class: "menu-shortcut" }, item.shortcut || ""),
        item.items ? h("span", { class: "menu-arrow" }, "▶") : null,
      ],
      (e) => {
        e.stopPropagation();
        if (item.items) {
          const r = row.getBoundingClientRect();
          showMenu(item.items, r.right - 2, r.top);
          return;
        }
        close();
        try {
          Promise.resolve(item.action?.()).catch((error) =>
            console.error(error),
          );
        } catch (error) {
          console.error(error);
        }
      },
      "menu-item",
      { role: "menuitem", disabled: !!disabled },
    );
    menu.append(row);
  }
  document.querySelector(".vista-desktop")?.append(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.max(2, Math.min(x, innerWidth - r.width - 3)) + "px";
  menu.style.top = Math.max(2, Math.min(y, innerHeight - r.height - 3)) + "px";
  setTimeout(() => {
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (!menu.contains(e.target)) close();
      },
      { signal: lifecycle.signal, capture: true },
    );
  }, 0);
  menu.addEventListener("keydown", (e) => {
    const rows = [...menu.querySelectorAll("button:not(:disabled)")],
      i = rows.indexOf(document.activeElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      rows[
        (i + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length
      ]?.focus();
    } else if (e.key === "Home") rows[0]?.focus();
    else if (e.key === "End") rows.at(-1)?.focus();
  });
  currentMenu = { el: menu, close };
  menu.focus();
  return close;
}
export function menuBar(groups) {
  return h(
    "div",
    { class: "menubar", role: "menubar" },
    groups.map((group) =>
      button(
        group.label,
        (e) => {
          const r = e.currentTarget.getBoundingClientRect();
          showMenu(
            typeof group.items === "function" ? group.items() : group.items,
            r.left,
            r.bottom,
          );
        },
        "menubar-button",
        { role: "menuitem", "aria-haspopup": "menu" },
      ),
    ),
  );
}
export function statusBar(...children) {
  return h("div", { class: "statusbar" }, ...children);
}
export function listen(target, type, fn, signal, options = {}) {
  target.addEventListener(type, fn, { ...options, signal });
}
export function chooseFiles({ multiple = false, accept = "" } = {}) {
  return new Promise((resolve) => {
    const input = h("input", {
      type: "file",
      accept,
      style: { display: "none" },
    });
    input.multiple = multiple;
    document.body.append(input);
    input.addEventListener(
      "change",
      () => {
        resolve([...input.files]);
        input.remove();
      },
      { once: true },
    );
    input.addEventListener(
      "cancel",
      () => {
        resolve([]);
        input.remove();
      },
      { once: true },
    );
    input.click();
  });
}

export class DialogService {
  constructor(desktop) {
    this.desktop = desktop;
  }
  message(title, text, options = {}) {
    return this.form({
      title,
      width: options.width || 440,
      icon: options.icon || "help",
      body: h(
        "div",
        { class: "dialog-message" },
        icon(options.icon || "help", 40),
        h("div", {}, text),
      ),
      owner: options.owner,
      buttons: options.buttons || [{ label: "OK", value: true, primary: true }],
    });
  }
  confirm(title, text) {
    return this.message(title, text, {
      buttons: [
        { label: "Yes", value: true, primary: true },
        { label: "No", value: false },
      ],
    });
  }
  error(error) {
    return this.message("Windows", error?.message || String(error), {
      icon: "help",
    });
  }
  prompt(title, label, value = "", options = {}) {
    const input = h("input", {
      class: "vista-input",
      value,
      style: { width: "100%" },
      "aria-label": label,
    });
    return this.form({
      title,
      width: options.width || 420,
      body: field(label, input),
      buttons: [
        { label: options.ok || "OK", value: () => input.value, primary: true },
        { label: "Cancel", value: null },
      ],
      focus: input,
    });
  }
  form({
    title,
    body,
    buttons,
    width = 460,
    height = 0,
    focus,
    icon: iconName = "control",
    owner: explicitOwner,
  }) {
    return new Promise((resolve) => {
      const owner = explicitOwner || this.desktop.wm.active,
        previous = document.activeElement;
      const win = this.desktop.wm.create({
        title,
        icon: iconName,
        width,
        height: height || 230,
        resizable: !!height,
        modal: true,
        owner,
        appId: "dialog",
      });
      win.el.classList.add("dialog-window");
      if (!height) {
        win.el.style.height = "auto";
        win.el.style.minHeight = "120px";
      }
      let settled = false,
        submitting = false;
      win.onCleanup(() => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      });
      const finish = (value) => {
        if (settled) return;
        settled = true;
        win.forceClose();
        previous?.isConnected && previous.focus?.();
        resolve(value);
      };
      const content = h("div", { class: "dialog-body" }, body),
        actions = h("div", { class: "dialog-buttons" });
      for (const b of buttons)
        actions.append(
          button(
            b.label,
            async () => {
              if (submitting || settled) return;
              submitting = true;
              actions
                .querySelectorAll("button")
                .forEach((n) => (n.disabled = true));
              try {
                const result =
                  typeof b.value === "function" ? await b.value() : b.value;
                if (!settled && result !== DialogService.KEEP_OPEN)
                  finish(result);
              } catch (error) {
                if (!settled) await this.error(error);
              } finally {
                submitting = false;
                if (!settled)
                  actions
                    .querySelectorAll("button")
                    .forEach((n) => (n.disabled = false));
              }
            },
            `vista-button ${b.primary ? "primary" : ""}`,
          ),
        );
      win.body.append(content, actions);
      win.beforeClose = () => {
        finish(null);
        return false;
      };
      win.el.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          finish(null);
        }
        if (
          e.key === "Enter" &&
          e.target.tagName !== "TEXTAREA" &&
          e.target.tagName !== "BUTTON"
        ) {
          e.preventDefault();
          actions.querySelector(".primary")?.click();
        }
      });
      queueMicrotask(() => {
        (
          focus ||
          actions.querySelector(".primary") ||
          actions.querySelector("button")
        )?.focus();
      });
    });
  }
  async file({
    mode = "open",
    path = "C:/Users/User/Documents",
    name = "",
    types = "",
    title,
    normalizeTarget = (p) => p,
  } = {}) {
    const fs = this.desktop.fs;
    let current = fs.stat(path)?.kind === "folder" ? path : dirname(path),
      selected = null;
    const list = h("div", { class: "file-dialog-list" }),
      address = h("input", {
        class: "vista-input",
        value: prettyPath(current),
        "aria-label": "Folder",
      }),
      filename = h("input", {
        class: "vista-input",
        value: name,
        "aria-label": "File name",
      });
    const refresh = () => {
      address.value = prettyPath(current);
      list.replaceChildren();
      if (current !== "C:/")
        list.append(
          button(
            [icon("folder", 20), h("span", {}, "..")],
            () => {
              current = dirname(current);
              refresh();
            },
            "file-dialog-entry",
          ),
        );
      for (const entry of fs.list(current)) {
        const row = button(
          [icon(fileIcon(entry), 24), h("span", {}, entry.name)],
          () => {
            selected = entry;
            list
              .querySelectorAll(".selected")
              .forEach((x) => x.classList.remove("selected"));
            row.classList.add("selected");
            if (entry.kind === "file") filename.value = entry.name;
          },
          "file-dialog-entry",
        );
        row.ondblclick = () => {
          if (entry.kind === "folder") {
            current = entry.path;
            refresh();
          } else {
            filename.value = entry.name;
            submitButton?.click();
          }
        };
        list.append(row);
      }
    };
    address.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const p = address.value;
        if (fs.stat(p)?.kind === "folder") {
          current = fs.stat(p).path;
          refresh();
        }
      }
    });
    const body = h(
      "div",
      { class: "file-dialog" },
      h(
        "div",
        { class: "file-dialog-nav" },
        button(
          "↑",
          () => {
            current = dirname(current);
            refresh();
          },
          "vista-button",
          { "aria-label": "Up one level" },
        ),
        address,
        button(
          "New folder",
          async () => {
            const n = await this.prompt(
              "New folder",
              "Folder name:",
              "New folder",
            );
            if (n)
              try {
                fs.validateName(n);
                fs.mkdir(joinPath(current, n));
                refresh();
              } catch (e) {
                this.error(e);
              }
          },
          "vista-button",
        ),
      ),
      list,
      field("File name:", filename),
      h("div", { class: "muted" }, types || "All files (*.*)"),
    );
    let submitButton;
    refresh();
    const resultPromise = this.form({
      title: title || (mode === "save" ? "Save As" : "Open"),
      width: 650,
      height: 440,
      body,
      focus: filename,
      buttons: [
        {
          label: mode === "save" ? "Save" : "Open",
          primary: true,
          value: async () => {
            if (!filename.value.trim()) {
              filename.focus();
              return DialogService.KEEP_OPEN;
            }
            const target = normalizeTarget(
              resolvePath(filename.value.trim(), current),
            );
            if (fs.stat(target)?.kind === "folder") {
              current = target;
              refresh();
              return DialogService.KEEP_OPEN;
            }
            if (mode === "open" && !fs.exists(target)) {
              await this.error(
                new Error("File not found. Check the file name and try again."),
              );
              return DialogService.KEEP_OPEN;
            }
            if (
              mode === "save" &&
              fs.exists(target) &&
              !(await this.confirm(
                "Confirm Save As",
                `${basename(target)} already exists. Do you want to replace it?`,
              ))
            )
              return DialogService.KEEP_OPEN;
            return target;
          },
        },
        { label: "Cancel", value: null },
      ],
    });
    submitButton = this.desktop.wm.active?.body.querySelector(
      ".dialog-buttons .primary",
    );
    return resultPromise;
  }
}
DialogService.KEEP_OPEN = Symbol("keep-open");
