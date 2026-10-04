import {
  VirtualFileSystem,
  Settings,
  ClipboardService,
  basename,
  joinPath,
  downloadBlob,
} from "../core/index.js";
import {
  h,
  icon,
  button,
  fileIcon,
  showMenu,
  closeMenu,
  DialogService,
  chooseFiles,
} from "../ui/index.js";
import { WindowManager } from "../window-manager/index.js";
import { DesktopRenderer } from "../renderer/index.js";

const groups = {
  explorer: () => import("../apps-explorer/index.js"),
  accessories: () => import("../apps-accessories/index.js"),
  games: () => import("../apps-games/index.js"),
  media: () => import("../apps-media/index.js"),
  system: () => import("../apps-system/index.js"),
  productivity: () => import("../apps-productivity/index.js"),
};
export const APPLICATIONS = [
  ["welcome", "Welcome Center", "computer", "system", "System Tools"],
  ["explorer", "Computer", "computer", "explorer", "System Tools"],
  ["ie", "Internet Explorer", "ie", "media", "Internet"],
  ["mail", "Windows Mail", "mail", "productivity", "Internet"],
  ["media", "Windows Media Player", "media", "media", "Multimedia"],
  ["photo", "Windows Photo Gallery", "pictures", "media", "Multimedia"],
  ["mediacenter", "Windows Media Center", "media", "media", "Multimedia"],
  ["movie", "Windows Movie Maker", "videos", "media", "Multimedia"],
  ["dvd", "Windows DVD Maker", "media", "media", "Multimedia"],
  ["notepad", "Notepad", "notepad", "accessories", "Accessories"],
  ["wordpad", "WordPad", "wordpad", "accessories", "Accessories"],
  ["paint", "Paint", "paint", "accessories", "Accessories"],
  ["calculator", "Calculator", "calculator", "accessories", "Accessories"],
  ["terminal", "Command Prompt", "run", "accessories", "Accessories"],
  ["snipping", "Snipping Tool", "paint", "accessories", "Accessories"],
  ["soundrecorder", "Sound Recorder", "media", "media", "Accessories"],
  ["journal", "Windows Journal", "wordpad", "accessories", "Accessories"],
  ["charactermap", "Character Map", "notepad", "accessories", "Accessories"],
  ["calendar", "Windows Calendar", "calendar", "productivity", "Accessories"],
  ["contacts", "Windows Contacts", "contacts", "productivity", "Accessories"],
  ["games", "Games", "games", "games", "Games"],
  ["minesweeper", "Minesweeper", "games", "games", "Games"],
  ["solitaire", "Solitaire", "solitaire", "games", "Games"],
  ["freecell", "FreeCell", "freecell", "games", "Games"],
  ["spider", "Spider Solitaire", "spider", "games", "Games"],
  ["hearts", "Hearts", "hearts", "games", "Games"],
  ["chess", "Chess Titans", "chess", "games", "Games"],
  ["mahjong", "Mahjong Titans", "games", "games", "Games"],
  ["purble", "Purble Place", "purble", "games", "Games"],
  ["inkball", "InkBall", "inkball", "games", "Games"],
  ["control", "Control Panel", "control", "system", "System Tools"],
  [
    "personalization",
    "Personalization",
    "personalization",
    "system",
    "System Tools",
  ],
  ["system", "System", "computer", "system", "System Tools"],
  ["taskmanager", "Windows Task Manager", "computer", "system", "System Tools"],
  ["backup", "Backup and Restore Center", "drive", "system", "System Tools"],
  [
    "network",
    "Network and Sharing Center",
    "network",
    "system",
    "System Tools",
  ],
  ["security", "Windows Security Center", "security", "system", "System Tools"],
  ["registry", "Registry Editor", "control", "system", "System Tools"],
  ["services", "Services", "control", "system", "Administrative Tools"],
  ["tasks", "Task Scheduler", "calendar", "system", "Administrative Tools"],
  [
    "accessibility",
    "Ease of Access Center",
    "control",
    "system",
    "Accessories",
  ],
  ["magnifier", "Magnifier", "search", "system", "Accessories"],
  ["help", "Windows Help and Support", "help", "system", "System Tools"],
].map(([id, name, iconName, group, category]) => ({
  id,
  name,
  icon: iconName,
  group,
  category,
}));

export async function createDesktop(root) {
  const lifecycle = new AbortController(),
    settings = new Settings(),
    fs = await new VirtualFileSystem().init();
  root.replaceChildren();
  const host = h("div", { class: "vista-desktop", "data-testid": "desktop" }),
    workspace = h("div", { class: "desktop-workspace" }),
    icons = h("div", { class: "desktop-icons", "aria-label": "Desktop icons" });
  host.append(icons, workspace);
  root.append(host);
  const desktop = {
    root,
    host,
    workspace,
    settings,
    fs,
    clipboard: new ClipboardService(),
    wm: new WindowManager(workspace, settings),
    apps: APPLICATIONS,
    lifecycle,
    signal: lifecycle.signal,
    volume: settings.get("volume", 70),
    muted: settings.get("muted", false),
    start: null,
    flyout: null,
    selectedDesktop: null,
  };
  desktop.dialog = new DialogService(desktop);
  desktop.renderer = new DesktopRenderer(host, settings);
  desktop.toast = (title, message, iconName = "computer") => {
    host.querySelector(".toast")?.remove();
    const el = h(
      "div",
      { class: "toast", role: "status" },
      button("×", () => el.remove(), "toast-close", {
        "aria-label": "Dismiss notification",
      }),
      h("div", { class: "toast-title" }, icon(iconName, 20), title),
      h("div", {}, message),
    );
    host.append(el);
    setTimeout(() => el.remove(), 6500);
  };
  const sounds = new Set();
  desktop.playSound = (kind = "click") => {
    if (!settings.get("sounds", true) || desktop.muted) return;
    const name =
      {
        start: "logon",
        error: "error",
        click: "click",
        menu: "menu",
        recycle: "recycle",
        critical: "critical-stop",
      }[kind] || "click";
    const audio = new Audio("/assets/sounds/" + name + ".wav");
    audio.volume = desktop.volume / 100;
    sounds.add(audio);
    const clear = () => sounds.delete(audio);
    audio.addEventListener("ended", clear, { once: true });
    audio.addEventListener("error", clear, { once: true });
    audio.play().catch(clear);
  };
  lifecycle.signal.addEventListener("abort", () => {
    for (const audio of sounds) audio.pause();
    sounds.clear();
  });

  desktop.open = async (id, args = {}) => {
    if (desktop.sessionActive) return null;
    closeMenu();
    desktop.closeStart?.();
    desktop.closeFlyout?.();
    if (id === "run") return openRun(desktop);
    if (id === "recycle")
      return desktop.open("explorer", { path: "C:/$Recycle.Bin" });
    if (
      id === "lock" ||
      id === "shutdown" ||
      id === "restart" ||
      id === "logoff" ||
      id === "sleep"
    )
      return desktop.session(id);
    const app = APPLICATIONS.find((a) => a.id === id);
    if (!app) {
      desktop.dialog.error(new Error(`Windows cannot find '${id}'.`));
      return null;
    }
    const singleton = [
      "calendar",
      "contacts",
      "mail",
      "control",
      "personalization",
      "system",
      "taskmanager",
      "games",
      "welcome",
      "network",
      "security",
      "services",
      "tasks",
      "accessibility",
    ];
    if (singleton.includes(id) && !args.page && !args.to && !args.choose) {
      const existing = desktop.wm.windows.find((w) => w.appId === id);
      if (existing) {
        desktop.wm.focus(existing);
        return existing;
      }
    }
    try {
      const module = await groups[app.group]();
      if (lifecycle.signal.aborted) return null;
      const win = await module.launch(desktop, id, args);
      const recent = settings.get("recentApps", []).filter((x) => x !== id);
      settings.set("recentApps", [id, ...recent].slice(0, 8));
      return win;
    } catch (error) {
      console.error("Application error", id, error);
      desktop.dialog.error(error);
      return null;
    }
  };
  desktop.openFile = async (path) => {
    const entry = fs.stat(path);
    if (!entry)
      return desktop.dialog.error(new Error("This file no longer exists."));
    if (entry.kind === "folder")
      return desktop.open("explorer", { path: entry.path });
    const ext = entry.name.split(".").pop().toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(ext))
      return desktop.open("photo", { path });
    if (
      ["wav", "mp3", "mp4", "ogg", "webm", "m4a", "flac", "mov"].includes(ext)
    )
      return desktop.open("media", { path });
    if (["html", "htm", "rtf"].includes(ext))
      return desktop.open("wordpad", { path });
    if (["exe", "com", "dll", "sys", "msi"].includes(ext))
      return desktop.dialog.message(
        "Windows",
        `“${entry.name}” is a native Windows program. This desktop opens browser applications; native executables need a separate Windows emulator.`,
        { icon: "computer" },
      );
    return desktop.open("notepad", { path });
  };
  desktop.importFiles = async (
    destination = "C:/Users/User/Downloads",
    accept = "",
  ) => {
    const files = await chooseFiles({ multiple: true, accept });
    if (!files.length) return [];
    try {
      const paths = await fs.importFiles(files, destination);
      desktop.toast(
        "Import complete",
        `${paths.length} file${paths.length === 1 ? "" : "s"} added to ${basename(destination)}.`,
      );
      return paths;
    } catch (e) {
      await desktop.dialog.error(e);
      return [];
    }
  };
  desktop.session = (action) => session(desktop, action);
  desktop.flip = () => flip3D(desktop);
  desktop.screenSaver = () => screenSaver(desktop);
  desktop.refreshDesktop = () => renderDesktopIcons(desktop, icons);
  desktop.refreshDesktop();
  fs.on("change", desktop.refreshDesktop, lifecycle.signal);
  fs.on(
    "error",
    () =>
      desktop.toast(
        "Your changes are not saved",
        "Browser storage is full or unavailable. Export your files from Backup and Restore Center.",
        "security",
      ),
    lifecycle.signal,
  );
  makeTaskbar(desktop);
  makeSidebar(desktop);
  setupStart(desktop);
  setupShellKeyboard(desktop);
  setupDesktopServices(desktop);
  setupWebMCP(desktop);
  const applySettings = ({ key } = {}) => {
    host.style.cursor = settings.get("cursor", "default");
    host.classList.toggle("basic", settings.get("theme", "aero") === "basic");
    host.classList.toggle("high-contrast", settings.get("highContrast", false));
    host.classList.toggle("large-text", settings.get("largeText", false));
    host.style.setProperty(
      "--glass-rgb",
      settings.get("glassColor", "88,157,178"),
    );
    if (key === "sidebar" || key === "gadgets") makeSidebar(desktop);
    if (key === "wallpaper")
      desktop.renderer
        .loadImage(settings.get("wallpaper", "/assets/wallpaper.jpg"))
        .catch((e) => desktop.dialog.error(e));
    if (key === "volume") desktop.volume = settings.get("volume", 70);
    if (key === "muted") desktop.muted = settings.get("muted", false);
  };
  settings.on("change", applySettings, lifecycle.signal);
  applySettings();
  host.addEventListener("contextmenu", (e) => {
    if (e.target === host || e.target === icons || e.target === workspace) {
      e.preventDefault();
      desktopContext(desktop, e.clientX, e.clientY);
    }
  });
  host.addEventListener("pointerdown", (e) => {
    if (!e.target.closest(".start-menu,.start-orb")) desktop.closeStart();
    if (!e.target.closest(".flyout,.tray")) desktop.closeFlyout();
    if (e.target === host || e.target === workspace || e.target === icons) {
      icons
        .querySelectorAll(".selected")
        .forEach((n) => n.classList.remove("selected"));
      desktop.selectedDesktop = null;
    }
  });
  host.addEventListener("dragover", (e) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  });
  host.addEventListener("drop", async (e) => {
    if (e.dataTransfer.files.length) {
      e.preventDefault();
      try {
        await fs.importFiles(e.dataTransfer.files, "C:/Users/User/Desktop");
        desktop.toast("Files imported", "Your files are on the desktop.");
      } catch (error) {
        desktop.dialog.error(error);
      }
    }
  });
  desktop.renderer.on(
    "ready",
    (backend) => {
      host.dataset.renderer = backend;
    },
    lifecycle.signal,
  );
  desktop.renderer.init().catch((error) => {
    console.error(error);
    host.style.background = "url('/assets/wallpaper.jpg') center / cover";
  });
  window.addEventListener(
    "beforeunload",
    (e) => {
      if (desktop.wm.windows.some((w) => w.dirty)) {
        e.preventDefault();
        e.returnValue = "";
      }
    },
    { signal: lifecycle.signal },
  );
  if (settings.get("showWelcome", true)) await desktop.open("welcome");
  desktop.dispose = () => {
    lifecycle.abort();
    desktop.sidebarLifecycle?.abort();
    desktop.closeStart();
    desktop.closeFlyout();
    desktop.wm.dispose();
    desktop.renderer.dispose();
    desktop.audioContext?.close();
    host.remove();
  };
  return desktop;
}

function renderDesktopIcons(d, container) {
  const fixed = [
    ["User", "user", () => d.open("explorer", { path: "C:/Users/User" })],
    ["Computer", "computer", () => d.open("explorer")],
    [
      "Recycle Bin",
      d.fs.list("C:/$Recycle.Bin").length ? "recycle-full" : "recycle",
      () => d.open("recycle"),
    ],
    ["Internet Explorer", "ie", () => d.open("ie")],
  ];
  container.replaceChildren();
  const entries = [
    ...fixed.map(([name, ico, open]) => ({ name, ico, open })),
    ...d.fs.list("C:/Users/User/Desktop").map((e) => ({
      name: e.name,
      ico: fileIcon(e),
      open: () => d.openFile(e.path),
      path: e.path,
    })),
  ];
  for (const entry of entries) {
    const el = button(
      [
        icon(entry.ico, d.settings.get("desktopIconSize", 48)),
        h("span", {}, entry.name),
      ],
      () => {
        container
          .querySelectorAll(".selected")
          .forEach((n) => n.classList.remove("selected"));
        el.classList.add("selected");
        d.selectedDesktop = entry;
      },
      "desktop-icon",
      { "aria-label": entry.name },
    );
    el.ondblclick = entry.open;
    el.onkeydown = (e) => {
      if (e.key === "Enter") entry.open();
      if (e.key === "F2" && entry.path) {
        e.preventDefault();
        renameDesktop(d, entry);
      }
      if (e.key === "Delete" && entry.path) {
        e.preventDefault();
        deleteDesktop(d, entry);
      }
    };
    el.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      el.click();
      showMenu(
        [
          { label: "Open", action: entry.open },
          entry.path
            ? {
                label: "Rename",
                shortcut: "F2",
                action: () => renameDesktop(d, entry),
              }
            : null,
          entry.path
            ? {
                label: "Delete",
                shortcut: "Del",
                action: () => deleteDesktop(d, entry),
              }
            : null,
          {
            label: "Properties",
            action: () =>
              entry.path
                ? d.open("explorer", {
                    path: "C:/Users/User/Desktop",
                    select: entry.path,
                  })
                : d.open(
                    entry.name === "Computer" ? "system" : "personalization",
                  ),
          },
        ],
        e.clientX,
        e.clientY,
      );
    };
    container.append(el);
  }
}
async function renameDesktop(d, entry) {
  const name = await d.dialog.prompt("Rename", "File name:", entry.name);
  if (name)
    try {
      d.fs.validateName(name);
      d.fs.move(entry.path, joinPath("C:/Users/User/Desktop", name));
    } catch (e) {
      d.dialog.error(e);
    }
}
async function deleteDesktop(d, entry) {
  if (
    await d.dialog.confirm(
      "Delete File",
      `Move “${entry.name}” to the Recycle Bin?`,
    )
  )
    try {
      d.fs.remove(entry.path);
      d.playSound("recycle");
    } catch (e) {
      d.dialog.error(e);
    }
}
function desktopContext(d, x, y) {
  showMenu(
    [
      {
        label: "View",
        items: [
          {
            label: "Large icons",
            checked: d.settings.get("desktopIconSize", 48) === 48,
            action: () => {
              d.settings.set("desktopIconSize", 48);
              d.refreshDesktop();
            },
          },
          {
            label: "Classic icons",
            checked: d.settings.get("desktopIconSize", 48) === 32,
            action: () => {
              d.settings.set("desktopIconSize", 32);
              d.refreshDesktop();
            },
          },
          {
            label: "Show desktop icons",
            checked: !d.host.querySelector(".desktop-icons").hidden,
            action: () => {
              const icons = d.host.querySelector(".desktop-icons");
              icons.hidden = !icons.hidden;
            },
          },
        ],
      },
      { label: "Refresh", action: d.refreshDesktop },
      null,
      {
        label: "Paste",
        disabled: !d.clipboard.files.length,
        action: () => {
          try {
            d.clipboard.paste(d.fs, "C:/Users/User/Desktop");
          } catch (e) {
            d.dialog.error(e);
          }
        },
      },
      {
        label: "New",
        items: [
          {
            label: "Folder",
            icon: "folder",
            action: async () => {
              const name = await d.dialog.prompt(
                "New folder",
                "Folder name:",
                "New folder",
              );
              if (name)
                try {
                  d.fs.validateName(name);
                  d.fs.mkdir(joinPath("C:/Users/User/Desktop", name));
                } catch (e) {
                  d.dialog.error(e);
                }
            },
          },
          {
            label: "Text Document",
            icon: "notepad",
            action: () => {
              const path = d.fs.uniquePath(
                "C:/Users/User/Desktop",
                "New Text Document.txt",
              );
              d.fs.write(path, "");
              d.openFile(path);
            },
          },
        ],
      },
      {
        label: "Import files…",
        action: () => d.importFiles("C:/Users/User/Desktop"),
      },
      null,
      {
        label: "Personalize",
        icon: "personalization",
        action: () => d.open("personalization"),
      },
    ],
    x,
    y,
  );
}

function makeTaskbar(d) {
  const bar = h("footer", { class: "taskbar" }),
    start = button("", () => d.toggleStart(), "start-orb", {
      title: "Start",
      "aria-label": "Start",
      "aria-haspopup": "menu",
      "aria-expanded": "false",
    }),
    quick = h("div", { class: "quick-launch", "aria-label": "Quick Launch" }),
    tasks = h("div", { class: "task-buttons", "aria-label": "Open windows" }),
    tray = h("div", { class: "tray" });
  for (const [name, ico, action] of [
    ["Show desktop", "desktop", () => d.wm.showDesktop()],
    ["Switch between windows", "computer", () => d.flip()],
    ["Internet Explorer", "ie", () => d.open("ie")],
  ])
    quick.append(
      button(icon(ico, 16), action, "", { title: name, "aria-label": name }),
    );
  tray.append(
    button(
      "‹",
      (e) =>
        showMenu(
          [
            {
              label: "Windows Sidebar",
              action: () =>
                d.settings.set("sidebar", !d.settings.get("sidebar", true)),
            },
            {
              label: "Windows Security Center",
              icon: "security",
              action: () => d.open("security"),
            },
          ],
          e.clientX - 100,
          innerHeight - 112,
        ),
      "tray-button tray-chevron",
      { title: "Show hidden icons", "aria-label": "Show hidden icons" },
    ),
    button(icon("network", 16), () => networkFlyout(d), "tray-button", {
      title: "Network",
      "aria-label": "Network",
    }),
    button(
      h("span", { class: "tray-icon" }, "◖))"),
      () => volumeFlyout(d),
      "tray-button",
      { title: "Volume", "aria-label": "Volume" },
    ),
  );
  const clock = button("", () => clockFlyout(d), "tray-clock", {
    "aria-label": "Date and time",
  });
  tray.append(clock);
  bar.append(start, quick, tasks, tray);
  d.host.append(bar);
  d.startButton = start;
  const tick = () => {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    clock.title = now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };
  tick();
  const timer = setInterval(tick, 1000);
  d.signal.addEventListener("abort", () => clearInterval(timer));
  let hoverTimer, preview;
  const closePreview = () => {
    clearTimeout(hoverTimer);
    preview?.remove();
    preview = null;
  };
  d.signal.addEventListener("abort", closePreview);
  const render = () => {
    tasks.replaceChildren();
    bar.classList.toggle(
      "opaque",
      d.wm.windows.some((w) => w.maximized && !w.minimized),
    );
    for (const win of d.wm.windows.filter((w) => !w.modal)) {
      const btn = button(
        [icon(win.icon, 16), h("span", {}, win.title)],
        () => {
          closePreview();
          if (d.wm.active === win && !win.minimized) d.wm.minimize(win);
          else d.wm.focus(win);
        },
        `task-button ${d.wm.active === win ? "active" : ""}`,
        {
          title: win.title,
          "aria-label": win.title,
          "aria-pressed": d.wm.active === win,
        },
      );
      btn.oncontextmenu = (e) => {
        e.preventDefault();
        d.wm.systemMenu(win, e.clientX, innerHeight - 130);
      };
      btn.onmouseenter = () => {
        closePreview();
        hoverTimer = setTimeout(() => {
          const r = btn.getBoundingClientRect(),
            clone = cloneWindowSurface(win.body);
          clone
            .querySelectorAll("input,textarea")
            .forEach((n) => n.removeAttribute("id"));
          const ratio = 224 / Math.max(win.body.clientWidth, 1);
          clone.style.width = win.body.clientWidth + "px";
          clone.style.height = win.body.clientHeight + "px";
          clone.style.transform = `scale(${ratio})`;
          clone.style.flex = "none";
          preview = h(
            "div",
            {
              class: "task-preview",
              style: { left: Math.min(r.left, innerWidth - 246) + "px" },
            },
            h("div", {}, icon(win.icon, 16), win.title),
            h("div", { class: "task-preview-screen" }, clone),
          );
          preview.onclick = () => {
            d.wm.focus(win);
            closePreview();
          };
          preview.onmouseleave = closePreview;
          d.host.append(preview);
        }, 450);
      };
      btn.onmouseleave = () => {
        clearTimeout(hoverTimer);
        setTimeout(() => {
          if (preview && !preview.matches(":hover")) closePreview();
        }, 180);
      };
      tasks.append(btn);
    }
  };
  d.wm.on("change", render, d.signal);
  render();
  bar.addEventListener("contextmenu", (e) => {
    if (e.target.closest("button")) return;
    e.preventDefault();
    showMenu(
      [
        { label: "Cascade Windows", action: () => d.wm.cascade() },
        { label: "Show Windows Stacked", action: () => d.wm.tile() },
        { label: "Show Windows Side by Side", action: () => d.wm.tile(true) },
        { label: "Show the Desktop", action: () => d.wm.showDesktop() },
        null,
        {
          label: "Task Manager",
          icon: "computer",
          action: () => d.open("taskmanager"),
        },
        null,
        {
          label: "Properties",
          action: () => d.open("personalization", { page: "taskbar" }),
        },
      ],
      e.clientX,
      innerHeight - 214,
    );
  });
}

function setupStart(d) {
  d.closeStart = () => {
    d.start?.remove();
    d.start = null;
    d.startButton.classList.remove("open");
    d.startButton.setAttribute("aria-expanded", "false");
  };
  d.toggleStart = () => {
    if (d.sessionActive) return;
    if (d.start) {
      d.closeStart();
      return;
    }
    d.closeFlyout();
    closeMenu();
    d.playSound("menu");
    let all = false;
    const panel = h("div", { class: "start-menu", "aria-label": "Start menu" }),
      left = h("div", { class: "start-left" }),
      programs = h("div", { class: "start-programs" }),
      right = h("div", { class: "start-right" }),
      search = h("input", {
        placeholder: "Start Search",
        "aria-label": "Start Search",
        autocomplete: "off",
      }),
      allBtn = button(
        "▶  All Programs",
        () => {
          all = !all;
          search.value = "";
          renderPrograms();
        },
        "all-programs",
      );
    const appRow = (app, pinned = false, sub = "") =>
      button(
        [
          icon(app.icon, pinned ? 32 : 32),
          h(
            "span",
            {},
            pinned ? h("strong", {}, app.name) : app.name,
            sub ? h("small", {}, sub) : null,
          ),
        ],
        () => d.open(app.id),
        `start-app ${pinned ? "pinned" : ""} ${all ? "compact" : ""}`,
        { "aria-label": app.name },
      );
    const renderPrograms = () => {
      programs.replaceChildren();
      const query = search.value.toLowerCase().trim();
      allBtn.textContent = all ? "◀  Back" : "▶  All Programs";
      if (query) {
        for (const app of d.apps.filter(
          (a) => a.name.toLowerCase().includes(query) || a.id.startsWith(query),
        ))
          programs.append(appRow(app));
        const files = d.settings.get("searchEnabled", true)
          ? d.fs
              .search(query)
              .filter((e) => e.kind === "file")
              .slice(0, 6)
          : [];
        if (files.length) programs.append(h("div", { class: "start-rule" }));
        for (const file of files)
          programs.append(
            button(
              [icon(fileIcon(file), 24), h("span", {}, file.name)],
              () => d.openFile(file.path),
              "start-app compact",
            ),
          );
        if (!programs.childElementCount)
          programs.append(
            h("div", { class: "no-results" }, "No items match your search."),
          );
        return;
      }
      if (all) {
        const categories = [
          "Accessories",
          "Administrative Tools",
          "Games",
          "Internet",
          "Multimedia",
          "System Tools",
        ];
        for (const category of categories) {
          const group = h(
            "details",
            {},
            h(
              "summary",
              { class: "start-app compact" },
              icon("folder", 16),
              category,
            ),
          );
          for (const app of d.apps.filter((a) => a.category === category))
            group.append(appRow(app));
          programs.append(group);
        }
        return;
      }
      programs.append(
        appRow(
          d.apps.find((a) => a.id === "ie"),
          true,
          "Browse the Internet",
        ),
        appRow(
          d.apps.find((a) => a.id === "mail"),
          true,
          "E-mail",
        ),
        h("div", { class: "start-rule" }),
      );
      const ids = [
        ...new Set([
          "welcome",
          "media",
          "photo",
          "calendar",
          "paint",
          "notepad",
          ...d.settings.get("recentApps", []),
        ]),
      ]
        .filter((id) => !["ie", "mail"].includes(id))
        .slice(0, 7);
      for (const id of ids) {
        const app = d.apps.find((a) => a.id === id);
        if (app) programs.append(appRow(app));
      }
    };
    search.addEventListener("input", renderPrograms);
    search.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const first = programs.querySelector("button");
        if (first) first.click();
        else openRun(d, search.value);
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        programs.querySelector("button")?.focus();
      }
    });
    left.append(
      programs,
      allBtn,
      h("div", { class: "start-search" }, search, icon("search", 16)),
    );
    right.append(h("div", { class: "start-user-picture" }, icon("user", 48)));
    for (const [label, action] of [
      [
        d.settings.get("userName", "User"),
        () => d.open("explorer", { path: "C:/Users/User" }),
      ],
      [
        "Documents",
        () => d.open("explorer", { path: "C:/Users/User/Documents" }),
      ],
      [
        "Pictures",
        () => d.open("explorer", { path: "C:/Users/User/Pictures" }),
      ],
      ["Music", () => d.open("explorer", { path: "C:/Users/User/Music" })],
      ["Games", () => d.open("games")],
      [
        "Recent Items",
        () => d.open("explorer", { path: "C:/Users/User/Documents" }),
      ],
      ["Computer", () => d.open("explorer")],
      ["Network", () => d.open("network")],
      ["Control Panel", () => d.open("control")],
      ["Default Programs", () => d.open("control", { page: "programs" })],
      ["Help and Support", () => d.open("help")],
    ]) {
      if (label === "Computer" || label === "Control Panel")
        right.append(h("div", { class: "start-rule" }));
      right.append(button(label, action, "start-link"));
    }
    right.append(
      h(
        "div",
        { class: "start-power" },
        button("⏻", () => d.session("sleep"), "", {
          title: "Sleep",
          "aria-label": "Sleep",
        }),
        button("▣", () => d.session("lock"), "", {
          title: "Lock",
          "aria-label": "Lock",
        }),
        button(
          "▶",
          (e) =>
            showMenu(
              [
                { label: "Switch User", action: () => d.session("lock") },
                { label: "Log Off", action: () => d.session("logoff") },
                { label: "Lock", action: () => d.session("lock") },
                null,
                { label: "Restart", action: () => d.session("restart") },
                { label: "Sleep", action: () => d.session("sleep") },
                { label: "Shut Down", action: () => d.session("shutdown") },
              ],
              e.clientX,
              e.clientY - 184,
            ),
          "",
          { "aria-label": "Shut down options" },
        ),
      ),
    );
    panel.append(left, right);
    d.start = panel;
    d.host.append(panel);
    d.startButton.classList.add("open");
    d.startButton.setAttribute("aria-expanded", "true");
    renderPrograms();
    search.focus();
  };
  d.closeFlyout = () => {
    d.flyout?.remove();
    d.flyout = null;
  };
}

function makeSidebar(d) {
  d.sidebarLifecycle?.abort();
  d.sidebarLifecycle = new AbortController();
  const signal = d.sidebarLifecycle.signal;
  d.host.querySelector(".sidebar")?.remove();
  if (!d.settings.get("sidebar", true)) return;
  const sidebar = h("aside", {
      class: "sidebar",
      "aria-label": "Windows Sidebar",
    }),
    tools = h(
      "div",
      { class: "sidebar-tools" },
      button("+", () => gadgetGallery(d), "", {
        "aria-label": "Add gadgets",
        title: "Add gadgets",
      }),
      button("‹", () => d.settings.set("sidebar", false), "", {
        "aria-label": "Close Sidebar",
        title: "Close Sidebar",
      }),
    );
  sidebar.append(tools);
  const selected = d.settings.get("gadgets", ["clock", "photo", "calendar"]);
  for (const type of selected) {
    let g;
    if (type === "clock") {
      g = h("div", { class: "gadget clock-gadget" });
      const canvas = h("canvas", {
        width: 260,
        height: 260,
        "aria-label": "Analog clock",
      });
      g.append(canvas);
      const draw = () => drawClock(canvas, new Date());
      draw();
      const id = setInterval(draw, 1000);
      signal.addEventListener("abort", () => clearInterval(id));
      g.ondblclick = () => clockFlyout(d);
    } else if (type === "photo") {
      g = h(
        "div",
        { class: "gadget photo-gadget" },
        h("img", { src: "/assets/lake.jpg", alt: "Mountain lake" }),
      );
      g.ondblclick = () => d.open("photo");
      const photos = [
        "/assets/lake.jpg",
        "/assets/forest.jpg",
        "/assets/wallpaper.jpg",
      ];
      let i = 0;
      const id = setInterval(() => {
        const im = g.querySelector("img");
        if (im) im.src = photos[++i % photos.length];
      }, 15000);
      signal.addEventListener("abort", () => clearInterval(id));
    } else if (type === "calendar") {
      const date = new Date();
      g = h(
        "div",
        { class: "gadget gadget-calendar" },
        h(
          "div",
          { class: "month" },
          date.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        ),
        h("div", {}, date.toLocaleDateString("en-US", { weekday: "long" })),
        h("div", { class: "day" }, date.getDate()),
      );
      g.ondblclick = () => d.open("calendar");
    } else if (type === "notes") {
      const area = h("textarea", {
          value: d.settings.get("gadgetNote", "Remember the little things."),
        }),
        note = h("div", { class: "gadget gadget-note" }, area);
      area.oninput = () => d.settings.set("gadgetNote", area.value);
      g = note;
    } else if (type === "meter") {
      const label = h("label", {}, "Desktop memory"),
        fill = h("span", {});
      g = h(
        "div",
        { class: "gadget gadget-meter" },
        label,
        h("div", { class: "meter-bar" }, fill),
      );
      const tick = () => {
        const memory = performance.memory;
        const used = memory
          ? Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100)
          : Math.min(100, Math.round((d.fs.entries.size / 500) * 100));
        fill.style.width = used + "%";
        label.textContent = memory
          ? `Memory ${used}%`
          : `${d.wm.windows.length} running applications`;
      };
      tick();
      const id = setInterval(tick, 2000);
      signal.addEventListener("abort", () => clearInterval(id));
    } else continue;
    g.append(
      button(
        "×",
        () =>
          d.settings.set(
            "gadgets",
            selected.filter((x) => x !== type),
          ),
        "gadget-close",
        { "aria-label": `Remove ${type} gadget` },
      ),
    );
    sidebar.append(g);
  }
  d.host.append(sidebar);
}
function drawClock(canvas, date) {
  const ctx = canvas.getContext("2d"),
    size = canvas.width,
    c = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(c, c);
  const ring = ctx.createLinearGradient(-c, -c, c, c);
  ring.addColorStop(0, "#e8eef1");
  ring.addColorStop(0.45, "#818c91");
  ring.addColorStop(0.7, "#bec8cc");
  ring.addColorStop(1, "#3d484e");
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(0, 0, c - 3, 0, Math.PI * 2);
  ctx.fill();
  const face = ctx.createRadialGradient(-20, -40, 3, 0, 0, c);
  face.addColorStop(0, "#4c5960");
  face.addColorStop(0.75, "#17202a");
  face.addColorStop(1, "#070e15");
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(0, 0, c - 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#c6d1d8";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, c - 16, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 60; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 30);
    ctx.strokeStyle = i % 5 === 0 ? "#e4edf3" : "#9cabb6";
    ctx.lineWidth = i % 5 === 0 ? 3 : 1.3;
    ctx.beginPath();
    ctx.moveTo(0, -c + 23);
    ctx.lineTo(0, -c + (i % 5 === 0 ? 35 : 28));
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = "#dce4ea";
  ctx.font = "23px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.fillText(
      String(i),
      Math.sin(a) * (c - 49),
      -Math.cos(a) * (c - 49) + 1,
    );
  }
  const hand = (angle, length, width, color) => {
    ctx.save();
    ctx.rotate(angle);
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(0, 9);
    ctx.lineTo(0, -length);
    ctx.stroke();
    ctx.restore();
  };
  const hour = (date.getHours() % 12) + date.getMinutes() / 60,
    minute = date.getMinutes() + date.getSeconds() / 60;
  hand((hour * Math.PI) / 6, 57, 7, "#c9d5de");
  hand((minute * Math.PI) / 30, 87, 5, "#e3edf4");
  hand((date.getSeconds() * Math.PI) / 30, 89, 2, "#db7359");
  ctx.fillStyle = "#e4ecf0";
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
function gadgetGallery(d) {
  const win = d.wm.create({
    title: "Gadget Gallery",
    icon: "control",
    appId: "gadgets",
    width: 590,
    height: 300,
  });
  const wrap = h("div", {
    class: "games-explorer",
    style: { gridTemplateColumns: "repeat(5,1fr)", gap: "4px" },
  });
  for (const [type, label, ico] of [
    ["clock", "Clock", "calendar"],
    ["photo", "Slide Show", "pictures"],
    ["calendar", "Calendar", "calendar"],
    ["notes", "Notes", "notepad"],
    ["meter", "CPU Meter", "computer"],
  ])
    wrap.append(
      button(
        [icon(ico, 48), label],
        () => {
          const current = d.settings.get("gadgets", [
            "clock",
            "photo",
            "calendar",
          ]);
          if (!current.includes(type))
            d.settings.set("gadgets", [...current, type]);
          d.settings.set("sidebar", true);
        },
        "game-cover",
      ),
    );
  win.body.append(wrap);
}
function flyout(d, content, cls = "") {
  d.closeFlyout();
  const el = h(
    "div",
    { class: "flyout " + cls },
    h("div", { class: "flyout-content" }, content),
  );
  d.host.append(el);
  d.flyout = el;
  return el;
}
function clockFlyout(d) {
  const date = new Date(),
    title = h(
      "div",
      {},
      date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    ),
    calendar = h("div", { class: "clock-flyout-calendar" });
  for (const day of ["S", "M", "T", "W", "T", "F", "S"])
    calendar.append(h("b", {}, day));
  const first = new Date(date.getFullYear(), date.getMonth(), 1).getDay(),
    days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  for (let i = 0; i < first; i++) calendar.append(h("span", {}, ""));
  for (let i = 1; i <= days; i++)
    calendar.append(
      h("span", { class: i === date.getDate() ? "today" : "" }, i),
    );
  flyout(d, [
    title,
    calendar,
    h(
      "div",
      { style: { marginTop: "14px", textAlign: "center" } },
      button("Open Windows Calendar", () => d.open("calendar"), "link-button"),
    ),
  ]);
}
function volumeFlyout(d) {
  const input = h("input", {
      type: "range",
      min: 0,
      max: 100,
      value: d.volume,
      "aria-label": "Volume",
    }),
    value = h("span", {}, d.volume);
  input.oninput = () => {
    d.settings.set("volume", Number(input.value));
    value.textContent = input.value;
  };
  flyout(
    d,
    [
      h("b", {}, "Speakers"),
      icon("media", 32),
      value,
      input,
      button(
        d.muted ? "Unmute" : "Mute",
        () => {
          d.settings.set("muted", !d.muted);
          volumeFlyout(d);
        },
        "vista-button",
      ),
    ],
    "volume-flyout",
  );
}
function networkFlyout(d) {
  flyout(d, [
    h("h3", {}, navigator.onLine ? "Connected" : "Not connected"),
    h(
      "p",
      {},
      navigator.onLine
        ? "Internet access through your browser."
        : "Your browser is currently offline.",
    ),
    button(
      "Network and Sharing Center",
      () => d.open("network"),
      "link-button",
    ),
  ]);
}
function setupShellKeyboard(d) {
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.defaultPrevented || d.sessionActive) return;
      const key = e.key.toLowerCase();
      if (e.ctrlKey && e.shiftKey && e.key === "Escape") {
        e.preventDefault();
        d.open("taskmanager");
      } else if (e.ctrlKey && e.key === "Escape") {
        e.preventDefault();
        d.toggleStart();
      } else if (e.key === "Escape") {
        d.closeStart();
        d.closeFlyout();
        d.host.querySelector(".flip3d")?.remove();
      } else if (e.altKey && e.key === "Tab") {
        e.preventDefault();
        d.wm.cycle();
      } else if (e.metaKey && key === "d") {
        e.preventDefault();
        d.wm.showDesktop();
      } else if (e.metaKey && key === "e") {
        e.preventDefault();
        d.open("explorer");
      } else if (e.metaKey && key === "r") {
        e.preventDefault();
        d.open("run");
      } else if (e.metaKey && key === "l") {
        e.preventDefault();
        d.session("lock");
      } else if (
        e.key === "F1" &&
        !e.target.closest("input,textarea,[contenteditable]")
      ) {
        e.preventDefault();
        d.open("help");
      }
    },
    { signal: d.signal },
  );
}
function setupDesktopServices(d) {
  let lastActivity = Date.now();
  const active = () => (lastActivity = Date.now());
  for (const name of ["pointerdown", "pointermove", "keydown"])
    d.host.addEventListener(name, active, { passive: true, signal: d.signal });
  const tick = () => {
    if (d.sessionActive || document.hidden) return;
    const now = Date.now(),
      tasks = d.settings.get("scheduledTasks", []),
      due = tasks.filter(
        (t) => t.enabled && Number.isFinite(t.next) && t.next <= now,
      );
    if (due.length) {
      for (const task of due) {
        task.last = now;
        if (task.interval > 0) task.next = now + Math.max(1000, task.interval);
        else task.enabled = false;
      }
      d.settings.set("scheduledTasks", tasks);
      for (const task of due)
        if (d.apps.some((app) => app.id === task.app)) d.open(task.app);
    }
    const wait = d.settings.get("screenSaverMinutes", 0) * 60000;
    if (
      wait > 0 &&
      now - lastActivity >= wait &&
      !d.host.querySelector(".screen-saver") &&
      !d.wm.windows.some((w) => w.modal || w.recording)
    ) {
      d.screenSaver();
      lastActivity = now;
    }
  };
  const timer = setInterval(tick, 1000);
  d.signal.addEventListener("abort", () => clearInterval(timer), {
    once: true,
  });
}

async function openRun(d, initial = "") {
  const input = h("input", {
    class: "vista-input",
    value: initial,
    "aria-label": "Open:",
    style: { width: "100%" },
  });
  const body = h(
    "div",
    {},
    h(
      "div",
      { class: "dialog-message" },
      icon("run", 32),
      h(
        "div",
        {},
        "Type the name of a program, folder, document, or Internet resource, and Windows will open it for you.",
      ),
    ),
    h("label", { class: "field" }, h("span", {}, "Open:"), input),
  );
  const command = await d.dialog.form({
    title: "Run",
    icon: "run",
    width: 420,
    body,
    focus: input,
    buttons: [
      { label: "OK", primary: true, value: () => input.value },
      { label: "Cancel", value: null },
    ],
  });
  if (!command) return;
  const aliases = {
    cmd: "terminal",
    "cmd.exe": "terminal",
    calc: "calculator",
    "calc.exe": "calculator",
    mspaint: "paint",
    "mspaint.exe": "paint",
    explorer: "explorer",
    "explorer.exe": "explorer",
    control: "control",
    taskmgr: "taskmanager",
    regedit: "registry",
    winver: "system",
    "services.msc": "services",
    "notepad.exe": "notepad",
    write: "wordpad",
    wmplayer: "media",
  };
  const key = command.trim().toLowerCase();
  if (d.fs.exists(command)) d.openFile(command);
  else if (/^https?:\/\//i.test(command)) d.open("ie", { url: command });
  else d.open(aliases[key] || key);
}
async function session(d, action) {
  if (d.sessionActive) return;
  d.closeStart();
  d.closeFlyout();
  closeMenu();
  if (["shutdown", "restart", "logoff"].includes(action)) {
    for (const win of [...d.wm.windows].filter((w) => !w.modal)) {
      await win.close();
      if (!win.closed) return;
    }
    await d.fs.flush();
  }
  d.host.querySelector(".session-overlay")?.remove();
  d.sessionActive = true;
  const blocked = [...d.host.children];
  for (const node of blocked) node.inert = true;
  const overlay = h("div", {
    class: "session-overlay",
    role: "dialog",
    "aria-modal": "true",
    tabIndex: -1,
  });
  overlay.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Tab") {
      e.preventDefault();
      overlay.querySelector("button")?.focus();
    }
  });
  const resume = () => {
    d.sessionActive = false;
    for (const node of blocked) node.inert = false;
    d.wm.updateModality();
    overlay.remove();
    d.wm.focus(d.wm.active);
    d.playSound("start");
    if (!d.wm.windows.length && d.settings.get("showWelcome", true))
      d.open("welcome");
  };
  if (action === "restart") {
    overlay.append(h("h1", {}, "Restarting…"));
    d.host.append(overlay);
    setTimeout(resume, 900);
    return;
  }
  if (action === "shutdown") {
    overlay.append(
      h("h1", {}, "Your computer is turned off"),
      button("Start Windows", resume, "vista-button"),
    );
  } else {
    overlay.append(
      h("div", { class: "session-avatar" }, icon("user", 110)),
      h("h1", {}, d.settings.get("userName", "User")),
      h(
        "div",
        {},
        action === "sleep"
          ? "Sleeping"
          : action === "logoff"
            ? "Logged off"
            : "Locked",
      ),
      button(
        action === "logoff"
          ? "Log on"
          : action === "sleep"
            ? "Wake up"
            : "Unlock",
        resume,
        "vista-button",
      ),
    );
  }
  overlay.append(
    h("div", { class: "session-brand" }, "Windows Vista™ Ultimate"),
  );
  d.host.append(overlay);
  overlay.querySelector("button")?.focus();
}
function flip3D(d) {
  const existing = d.host.querySelector(".flip3d");
  if (existing) {
    existing.remove();
    return;
  }
  d.closeStart();
  const rows = d.wm.windows.filter((w) => !w.modal);
  if (!rows.length) return;
  const overlay = h("div", {
    class: "flip3d",
    tabIndex: 0,
    "aria-label": "Switch between windows",
  });
  rows.slice(-6).forEach((win, i) => {
    const clone = cloneWindowSurface(win.body);
    clone.style.height = "100%";
    const card = h(
      "div",
      {
        class: "flip-card",
        style: {
          transform: `translate(${i * 28}px,${i * 29}px) rotateY(-32deg) rotateX(7deg) translateZ(${i * 25}px)`,
          zIndex: i + 1,
        },
      },
      h("span", {}, win.title),
      h("div", { class: "flip-card-inner" }, clone),
    );
    card.onclick = (e) => {
      e.stopPropagation();
      d.wm.focus(win);
      overlay.remove();
    };
    overlay.append(card);
  });
  overlay.append(
    h(
      "div",
      { class: "flip-caption" },
      "Click a window to switch to it. Press Esc to return to the desktop.",
    ),
  );
  overlay.onclick = () => overlay.remove();
  overlay.onkeydown = (e) => {
    if (e.key === "Escape") overlay.remove();
    if (e.key === "Enter") {
      d.wm.cycle();
      overlay.remove();
    }
  };
  d.host.append(overlay);
  overlay.focus();
}
function screenSaver(d) {
  if (d.host.querySelector(".screen-saver") || d.sessionActive) return;
  const el = h("div", { class: "screen-saver" }),
    canvas = h("canvas", {});
  el.append(
    canvas,
    h(
      "div",
      { class: "bubbles-tip" },
      "Move the mouse or press a key to return to the desktop.",
    ),
  );
  d.host.append(el);
  const ctx = canvas.getContext("2d");
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  let active = true,
    frame;
  const bubbles = Array.from({ length: 18 }, (_, i) => ({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    r: 25 + Math.random() * 55,
    vx: (Math.random() - 0.5) * 1.2,
    vy: -0.3 - Math.random() * 0.7,
    hue: i * 21,
  }));
  const draw = () => {
    if (!active) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const b of bubbles) {
      b.x += b.vx;
      b.y += b.vy;
      if (b.y < -b.r) b.y = canvas.height + b.r;
      if (b.x < -b.r) b.x = canvas.width + b.r;
      if (b.x > canvas.width + b.r) b.x = -b.r;
      const g = ctx.createRadialGradient(
        b.x - b.r * 0.35,
        b.y - b.r * 0.4,
        1,
        b.x,
        b.y,
        b.r,
      );
      g.addColorStop(0, "#ffffff80");
      g.addColorStop(0.25, `hsla(${b.hue},90%,65%,.12)`);
      g.addColorStop(0.88, "#ffffff06");
      g.addColorStop(0.96, `hsla(${b.hue},90%,75%,.55)`);
      g.addColorStop(1, "#ffffff90");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    frame = requestAnimationFrame(draw);
  };
  draw();
  const stop = () => {
    active = false;
    cancelAnimationFrame(frame);
    el.remove();
    document.removeEventListener("keydown", stop);
  };
  setTimeout(() => {
    if (!active) return;
    el.addEventListener("pointermove", stop, { once: true });
    el.addEventListener("pointerdown", stop, { once: true });
    document.addEventListener("keydown", stop, { once: true });
  }, 500);
  d.signal.addEventListener("abort", stop, { once: true });
}
function setupWebMCP(d) {
  const context = document.modelContext;
  if (!context?.registerTool) return;
  const register = (tool) => {
    try {
      Promise.resolve(context.registerTool(tool, { signal: d.signal })).catch(
        console.error,
      );
    } catch (error) {
      console.error(error);
    }
  };
  register({
    name: "vista_list_applications",
    description:
      "List installed browser desktop applications and open windows.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    execute: () => ({
      applications: d.apps.map(({ id, name }) => ({ id, name })),
      windows: d.wm.windows.map(({ id, title, appId, minimized }) => ({
        id,
        title,
        appId,
        minimized,
      })),
    }),
  });
  register({
    name: "vista_open_application",
    description: "Open a named installed application in the Vista desktop.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", enum: d.apps.map((a) => a.id) } },
      required: ["id"],
      additionalProperties: false,
    },
    execute: async (input) => {
      if (
        !input ||
        typeof input.id !== "string" ||
        !d.apps.some((a) => a.id === input.id)
      )
        throw new Error("Unknown application");
      const win = await d.open(input.id);
      return { windowId: win?.id, title: win?.title };
    },
  });
  register({
    name: "vista_list_files",
    description: "Read file names in one virtual desktop folder.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: (input) => {
      if (
        !input ||
        typeof input.path !== "string" ||
        d.fs.stat(input.path)?.kind !== "folder"
      )
        throw new Error("Folder not found");
      return d.fs.list(input.path).map(({ path, name, kind, modified }) => ({
        path,
        name,
        kind,
        modified,
      }));
    },
  });
}

/** Clone ordinary DOM plus raster content for taskbar and Flip 3D previews. */
function cloneWindowSurface(source) {
  const copy = source.cloneNode(true),
    originals = source.querySelectorAll("canvas,video"),
    targets = copy.querySelectorAll("canvas,video");
  originals.forEach((original, index) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = original.videoWidth || original.width;
      canvas.height = original.videoHeight || original.height;
      if (!canvas.width || !canvas.height) return;
      canvas.getContext("2d").drawImage(original, 0, 0);
      const img = document.createElement("img");
      img.src = canvas.toDataURL();
      img.style.cssText = targets[index].style.cssText;
      img.className = targets[index].className;
      img.width = canvas.width;
      img.height = canvas.height;
      targets[index].replaceWith(img);
    } catch {}
  });
  for (const node of copy.querySelectorAll("[id]")) node.removeAttribute("id");
  return copy;
}
