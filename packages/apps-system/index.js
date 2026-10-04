import { downloadBlob, formatBytes, basename } from "../core/index.js";
import {
  h,
  icon,
  button,
  tool,
  field,
  menuBar,
  statusBar,
  chooseFiles,
} from "../ui/index.js";

export function launch(d, id, args = {}) {
  if (id === "welcome") return welcome(d);
  if (id === "control") return control(d, args);
  if (id === "personalization") return personalization(d, args);
  if (id === "system") return system(d);
  if (id === "taskmanager") return taskManager(d);
  if (id === "backup") return backup(d);
  if (id === "network") return network(d);
  if (id === "security") return security(d);
  if (id === "registry") return registry(d);
  if (id === "services") return services(d);
  if (id === "tasks") return taskScheduler(d);
  if (id === "accessibility") return accessibility(d);
  if (id === "magnifier") return magnifier(d);
  if (id === "help") return help(d, args);
}

function welcome(d) {
  const win = d.wm.create({
      title: "Welcome Center",
      icon: "computer",
      appId: "welcome",
      width: 775,
      height: 525,
      x: Math.max(95, Math.round((innerWidth - 900) / 2)),
      y: Math.max(45, Math.round((innerHeight - 630) / 2)),
      remember: true,
    }),
    main = h("div", { class: "welcome-main" }),
    banner = h(
      "div",
      { class: "welcome-banner" },
      icon("computer", 106),
      h(
        "div",
        {},
        h("div", { class: "welcome-headline" }, "Windows Vista™ Ultimate"),
        h("div", { class: "welcome-edition" }, "Welcome to your computer"),
        h(
          "div",
          { class: "welcome-specs" },
          h("div", {}, "User’s Computer"),
          h("div", {}, "Your files, programs, and settings — together."),
          h(
            "div",
            {},
            button("Show more details", () => d.open("system"), "link-button"),
          ),
        ),
      ),
    ),
    content = h("div", { class: "welcome-content" });
  const grid = h("div", { class: "welcome-grid" });
  for (const [label, ico, action] of [
    ["View computer details", "computer", () => d.open("system")],
    ["Transfer files and settings", "documents", () => d.open("backup")],
    ["Add new users", "users", () => d.open("control", { page: "users" })],
    ["Connect to the Internet", "network", () => d.open("network")],
    ["Windows Ultimate Extras", "games", () => d.open("games")],
    ["What’s new in Windows Vista", "help", () => d.open("help")],
  ])
    grid.append(
      button([icon(ico, 40), h("span", {}, label)], action, "welcome-action"),
    );
  const discover = h("div", { class: "welcome-grid" });
  for (const [label, ico, action] of [
    ["Personalize Windows", "personalization", () => d.open("personalization")],
    ["Organize your photos", "pictures", () => d.open("photo")],
    ["Play music and videos", "media", () => d.open("media")],
  ])
    discover.append(
      button([icon(ico, 40), h("span", {}, label)], action, "welcome-action"),
    );
  content.append(
    h("h2", { class: "welcome-section-label" }, "Get started with Windows"),
    grid,
    h("h2", { class: "welcome-section-label" }, "Make it yours"),
    discover,
  );
  main.append(banner, content);
  const show = h("input", {
    type: "checkbox",
    checked: d.settings.get("showWelcome", true),
  });
  show.onchange = () => d.settings.set("showWelcome", show.checked);
  win.body.append(
    main,
    h(
      "div",
      { class: "welcome-footer" },
      h("label", {}, show, "Run at startup"),
      h(
        "div",
        { class: "windows-wordmark" },
        icon("computer", 20),
        h("span", {}, "Windows ", h("b", {}, "Vista")),
      ),
    ),
  );
  return win;
}
function controlFrame(
  d,
  { title, id = "control", iconName = "control", width = 820, height = 560 },
) {
  const win = d.wm.create({
      title,
      icon: iconName,
      appId: id,
      width,
      height,
      remember: true,
    }),
    sidebar = h(
      "nav",
      { class: "control-sidebar" },
      button("Control Panel Home", () => d.open("control"), "link-button"),
      button(
        "Classic View",
        () => d.open("control", { page: "classic" }),
        "link-button",
      ),
      h(
        "div",
        {
          style: {
            borderTop: "1px solid #a8c1d5",
            marginTop: "15px",
            paddingTop: "10px",
          },
        },
        "See also",
      ),
      button("Welcome Center", () => d.open("welcome"), "link-button"),
      button("Windows Help and Support", () => d.open("help"), "link-button"),
    ),
    main = h("div", { class: "control-main" });
  win.body.append(
    h(
      "div",
      { class: "explorer-address" },
      button("‹", () => d.open("control"), "nav-button", {
        "aria-label": "Back to Control Panel",
      }),
      h(
        "div",
        { class: "breadcrumb" },
        icon("control", 16),
        button("Control Panel", () => d.open("control"), ""),
        h("span", { class: "crumb-arrow" }, "▶"),
        h("span", {}, title),
      ),
    ),
    h("div", { class: "control-layout" }, sidebar, main),
  );
  return { win, main, sidebar };
}
function control(d, args) {
  const { win, main, sidebar } = controlFrame(d, { title: "Control Panel" });
  let page = args.page || "home";
  const render = () => {
    main.replaceChildren();
    if (page === "users") {
      main.append(
        h("h1", {}, "Make changes to your user account"),
        h(
          "div",
          {
            class: "dialog-message",
            style: { alignItems: "center", marginBottom: "24px" },
          },
          icon("user", 72),
          h(
            "div",
            {},
            h("h2", {}, d.settings.get("userName", "User")),
            h("p", {}, "Administrator · Local desktop profile"),
          ),
        ),
        button(
          "Change your account name",
          async () => {
            const name = await d.dialog.prompt(
              "Change Your Name",
              "New account name:",
              d.settings.get("userName", "User"),
            );
            if (name) {
              d.settings.set("userName", name);
              d.refreshDesktop();
              render();
            }
          },
          "link-button",
        ),
        h("p", {}, "This profile belongs to the desktop in this browser."),
        button("Lock this session", () => d.session("lock"), "vista-button"),
      );
      return;
    }
    if (page === "programs") {
      main.append(
        h("h1", {}, "Choose your default programs"),
        h("p", {}, "Files open in the matching application on this desktop."),
        h(
          "table",
          { class: "data-table" },
          h(
            "thead",
            {},
            h(
              "tr",
              {},
              h("th", {}, "File type"),
              h("th", {}, "Default program"),
            ),
          ),
          h(
            "tbody",
            {},
            ...[
              ["Text documents (.txt, .log, .ini)", "Notepad"],
              ["Rich text and HTML (.rtf, .html)", "WordPad"],
              ["Pictures (.jpg, .png, .gif, .bmp)", "Windows Photo Gallery"],
              [
                "Audio and video (.wav, .mp3, .mp4, .webm)",
                "Windows Media Player",
              ],
            ].map(([a, b]) => h("tr", {}, h("td", {}, a), h("td", {}, b))),
          ),
        ),
        h(
          "p",
          {},
          "Use “Open with” in Computer to choose a different application for a file.",
        ),
      );
      return;
    }
    if (page === "classic") {
      main.append(
        h("h1", {}, "Control Panel"),
        h(
          "div",
          { class: "personal-tiles" },
          ...d.apps
            .filter((a) =>
              [
                "personalization",
                "system",
                "backup",
                "network",
                "security",
                "services",
                "tasks",
                "accessibility",
                "calendar",
                "taskmanager",
              ].includes(a.id),
            )
            .map((a) =>
              button(
                [icon(a.icon, 48), a.name],
                () => d.open(a.id),
                "personal-tile",
              ),
            ),
        ),
      );
      return;
    }
    main.append(h("h1", {}, "Adjust your computer’s settings"));
    const categories = [
      [
        "System and Maintenance",
        "computer",
        [
          ["View system information", "system"],
          ["Back up your computer", "backup"],
          ["Manage running programs", "taskmanager"],
        ],
      ],
      ["User Accounts", "users", [["Change your account name", "users"]]],
      [
        "Security",
        "security",
        [["Check this computer’s security status", "security"]],
      ],
      [
        "Appearance and Personalization",
        "personalization",
        [
          ["Personalize colors and appearance", "personalization"],
          ["Change desktop background", "wallpaper"],
          ["Add gadgets to the Sidebar", "gadgets"],
        ],
      ],
      [
        "Network and Internet",
        "network",
        [
          ["View network status and tasks", "network"],
          ["Browse the Internet", "ie"],
        ],
      ],
      [
        "Clock, Language, and Region",
        "calendar",
        [
          ["Open Windows Calendar", "calendar"],
          ["View the date and time", "calendar"],
        ],
      ],
      [
        "Hardware and Sound",
        "media",
        [
          ["Play audio and video", "media"],
          ["Record sound", "soundrecorder"],
        ],
      ],
      [
        "Ease of Access",
        "control",
        [
          ["Optimize visual display", "accessibility"],
          ["Start Magnifier", "magnifier"],
        ],
      ],
      [
        "Programs",
        "documents",
        [
          ["Set your default programs", "programs"],
          ["View installed applications", "classic"],
        ],
      ],
    ];
    const grid = h("div", { class: "control-categories" });
    for (const [label, ico, links] of categories) {
      const item = h(
        "div",
        { class: "control-category" },
        icon(ico, 48),
        h("div", {}, h("h2", {}, label)),
      );
      for (const [text, target] of links)
        item.lastChild.append(
          button(
            text,
            () => {
              if (["users", "programs", "classic"].includes(target)) {
                page = target;
                render();
              } else if (target === "wallpaper")
                d.open("personalization", { page: "wallpaper" });
              else if (target === "gadgets") {
                d.settings.set("sidebar", true);
                d.host.querySelector(".sidebar-tools button")?.click();
              } else d.open(target);
            },
            "link-button",
          ),
        );
      grid.append(item);
    }
    main.append(grid);
  };
  sidebar.firstChild.onclick = () => {
    page = "home";
    render();
  };
  sidebar.children[1].onclick = () => {
    page = "classic";
    render();
  };
  render();
  return win;
}

function personalization(d, args) {
  const { win, main } = controlFrame(d, {
    title: "Personalization",
    id: "personalization",
    iconName: "personalization",
    width: 810,
    height: 570,
  });
  let page = args.page || "home";
  const save = () =>
    d.toast(
      "Personalization",
      "Your changes have been applied.",
      "personalization",
    );
  const back = () => {
    page = "home";
    render();
  };
  function render() {
    main.replaceChildren();
    if (page !== "home")
      main.append(button("‹ Personalization", back, "link-button"));
    if (page === "home") {
      main.append(
        h("h1", {}, "Personalize appearance and sounds"),
        h("p", {}, "Change the visuals and sounds on your computer."),
        h(
          "div",
          { class: "personal-tiles" },
          ...[
            ["Window Color and Appearance", "personalization", "color"],
            ["Desktop Background", "pictures", "wallpaper"],
            ["Screen Saver", "computer", "screensaver"],
            ["Sounds", "media", "sounds"],
            ["Mouse Pointers", "control", "mouse"],
            ["Theme", "personalization", "theme"],
            ["Display Settings", "computer", "display"],
            ["Taskbar and Start Menu", "desktop", "taskbar"],
          ].map(([name, ico, target]) =>
            button(
              [icon(ico, 48), h("span", {}, name)],
              () => {
                page = target;
                render();
              },
              "personal-tile",
            ),
          ),
        ),
      );
      return;
    }
    if (page === "color") {
      main.append(
        h("h1", {}, "Window Color and Appearance"),
        h(
          "p",
          {},
          "Change the color of your windows, Start menu, and taskbar.",
        ),
      );
      const choices = [
        ["Default", "88,157,178", "#7cbed5"],
        ["Graphite", "68,79,91", "#535b65"],
        ["Blue", "57,120,190", "#498dd8"],
        ["Teal", "49,152,141", "#45b4a7"],
        ["Red", "165,76,83", "#bb737b"],
        ["Orange", "178,132,75", "#d6ad70"],
        ["Pink", "174,110,155", "#d29bcb"],
        ["Frost", "182,201,211", "#c2d8e1"],
      ];
      const swatches = h("div", { class: "color-swatches" });
      for (const [name, value, color] of choices)
        swatches.append(
          button(
            "",
            () => {
              d.settings.set("glassColor", value);
              render();
            },
            "color-swatch" +
              (d.settings.get("glassColor", "88,157,178") === value
                ? " selected"
                : ""),
            { title: name, "aria-label": name, style: { background: color } },
          ),
        );
      const transparent = h("input", {
        type: "checkbox",
        checked: d.settings.get("theme", "aero") === "aero",
      });
      transparent.onchange = () =>
        d.settings.set("theme", transparent.checked ? "aero" : "basic");
      main.append(
        swatches,
        h("label", { class: "field" }, transparent, "Enable transparency"),
        h(
          "div",
          {
            class: "theme-preview",
            style: { width: "210px", height: "130px", margin: "25px 0" },
          },
          h("div", {
            style: {
              width: "130px",
              height: "87px",
              borderColor: `rgba(${d.settings.get("glassColor", "88,157,178")},.65)`,
            },
          }),
        ),
        button(
          "OK",
          () => {
            save();
            back();
          },
          "vista-button",
        ),
      );
    } else if (page === "wallpaper") {
      main.append(h("h1", {}, "Choose a desktop background"));
      const grid = h("div", { class: "wallpaper-choices" });
      for (const [label, src] of [
        ["Windows Vista", "/assets/wallpaper.jpg"],
        ["Mountain lake", "/assets/lake.jpg"],
        ["Landscape", "/assets/forest.jpg"],
      ])
        grid.append(
          button(
            [
              h("img", { src, alt: label }),
              h("div", { style: { paddingTop: "5px" } }, label),
            ],
            () => {
              d.settings.set("wallpaper", src);
              render();
            },
            "wallpaper-choice" +
              (d.settings.get("wallpaper", "/assets/wallpaper.jpg") === src
                ? " selected"
                : ""),
          ),
        );
      main.append(
        grid,
        button(
          "Browse…",
          async () => {
            const files = await chooseFiles({ accept: "image/*" });
            if (!files[0]) return;
            if (files[0].size > 5 * 1048576) {
              d.dialog.message(
                "Desktop Background",
                "Choose a background image smaller than 5 MB.",
              );
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              d.settings.set("wallpaper", reader.result);
              save();
            };
            reader.readAsDataURL(files[0]);
          },
          "vista-button",
        ),
        h(
          "p",
          { class: "muted" },
          "Backgrounds fill the screen while preserving their proportions.",
        ),
      );
    } else if (page === "theme") {
      main.append(h("h1", {}, "Theme Settings"));
      const select = h(
        "select",
        { class: "vista-input" },
        h(
          "option",
          {
            value: "aero",
            selected: d.settings.get("theme", "aero") === "aero",
          },
          "Windows Vista",
        ),
        h(
          "option",
          {
            value: "basic",
            selected: d.settings.get("theme", "aero") === "basic",
          },
          "Windows Vista Basic",
        ),
      );
      select.onchange = () => d.settings.set("theme", select.value);
      main.append(
        field("Theme:", select),
        h(
          "div",
          {
            class: "theme-preview",
            style: { width: "250px", height: "170px", margin: "20px 0" },
          },
          h("div", { style: { width: "150px", height: "100px" } }),
        ),
        button("Apply", save, "vista-button"),
      );
    } else if (page === "screensaver") {
      main.append(h("h1", {}, "Screen Saver Settings"));
      const wait = h("input", {
        class: "vista-input",
        type: "number",
        min: 0,
        max: 120,
        value: d.settings.get("screenSaverMinutes", 0),
      });
      main.append(
        h("div", { class: "screensaver-preview" }, h("span", {}, "Bubbles")),
        field(
          "Screen saver:",
          h("select", { class: "vista-input" }, h("option", {}, "Bubbles")),
        ),
        field("Wait (minutes):", wait),
        h("p", { class: "muted" }, "Use 0 to turn off automatic activation."),
        button("Preview", () => d.screenSaver(), "vista-button"),
        button(
          "Apply",
          () => {
            d.settings.set(
              "screenSaverMinutes",
              Math.max(0, Math.min(120, Number(wait.value) || 0)),
            );
            save();
          },
          "vista-button",
          { style: { marginLeft: "8px" } },
        ),
      );
    } else if (page === "sounds") {
      main.append(h("h1", {}, "Sounds"));
      const enabled = h("input", {
        type: "checkbox",
        checked: d.settings.get("sounds", true),
      });
      enabled.onchange = () => d.settings.set("sounds", enabled.checked);
      const volume = h("input", {
        type: "range",
        min: 0,
        max: 100,
        value: d.volume,
      });
      volume.oninput = () => d.settings.set("volume", Number(volume.value));
      main.append(
        h("label", { class: "field" }, enabled, "Play Windows sounds"),
        field("Volume:", volume),
        button("Test Sound", () => d.playSound("start"), "vista-button"),
        h("h2", {}, "Recording"),
        button(
          "Open Sound Recorder",
          () => d.open("soundrecorder"),
          "link-button",
        ),
      );
    } else if (page === "display") {
      main.append(
        h("h1", {}, "Display Settings"),
        h(
          "dl",
          { class: "system-summary" },
          h("dt", {}, "Resolution"),
          h("dd", {}, `${innerWidth} × ${innerHeight} CSS pixels`),
          h("dt", {}, "Pixel density"),
          h("dd", {}, `${devicePixelRatio}×`),
          h("dt", {}, "Graphics backend"),
          h("dd", {}, d.renderer.backend),
        ),
      );
      const renderer = h(
        "select",
        { class: "vista-input" },
        [
          ["auto", "Automatic (WebGPU → WebGL2 → Canvas 2D)"],
          ["webgl2", "WebGL2"],
          ["canvas2d", "Canvas 2D"],
        ].map(([v, label]) =>
          h(
            "option",
            { value: v, selected: d.settings.get("renderer", "auto") === v },
            label,
          ),
        ),
      );
      main.append(
        field("Renderer:", renderer),
        button(
          "Apply on next restart",
          () => {
            d.settings.set("renderer", renderer.value);
            save();
          },
          "vista-button",
        ),
        h(
          "p",
          { class: "muted" },
          "Reload the desktop to use a different graphics backend. Files are retained.",
        ),
      );
    } else if (page === "mouse") {
      main.append(h("h1", {}, "Mouse Pointers"));
      const select = h(
        "select",
        { class: "vista-input" },
        h("option", { value: "default" }, "Windows Default"),
        h("option", { value: "crosshair" }, "Crosshair"),
        h("option", { value: "pointer" }, "Link Select"),
      );
      select.value = d.settings.get("cursor", "default");
      select.onchange = () => {
        d.settings.set("cursor", select.value);
        d.host.style.cursor = select.value;
      };
      main.append(
        field("Scheme:", select),
        h("p", {}, "Pointer appearance changes within this desktop."),
        button(
          "Restore Default",
          () => {
            d.settings.set("cursor", "default");
            d.host.style.cursor = "";
            select.value = "default";
          },
          "vista-button",
        ),
      );
    } else if (page === "taskbar") {
      main.append(h("h1", {}, "Taskbar and Start Menu Properties"));
      const sidebar = h("input", {
          type: "checkbox",
          checked: d.settings.get("sidebar", true),
        }),
        welcome = h("input", {
          type: "checkbox",
          checked: d.settings.get("showWelcome", true),
        });
      sidebar.onchange = () => d.settings.set("sidebar", sidebar.checked);
      welcome.onchange = () => d.settings.set("showWelcome", welcome.checked);
      main.append(
        h("label", { class: "field" }, sidebar, "Show Windows Sidebar"),
        h(
          "label",
          { class: "field" },
          welcome,
          "Show Welcome Center at startup",
        ),
        button(
          "Clear Recent Programs",
          () => {
            d.settings.set("recentApps", []);
            save();
          },
          "vista-button",
        ),
        h(
          "p",
          {},
          "Quick Launch and labeled taskbar buttons are enabled. Right-click the taskbar to arrange windows.",
        ),
      );
    }
  }
  render();
  return win;
}

function system(d) {
  const { win, main } = controlFrame(d, {
    title: "System",
    id: "system",
    iconName: "computer",
    width: 805,
    height: 595,
  });
  main.append(
    h("h1", {}, "View basic information about your computer"),
    h("h2", {}, "Windows edition"),
    h(
      "div",
      { class: "about-logo" },
      icon("computer", 64),
      h("span", {}, "Windows Vista™ Ultimate"),
    ),
    h("p", {}, "Service Pack 1 appearance"),
    h("h2", {}, "System"),
    h(
      "dl",
      { class: "system-summary" },
      h("dt", {}, "Computer name"),
      h("dd", {}, "VISTA-PC"),
      h("dt", {}, "User"),
      h("dd", {}, d.settings.get("userName", "User")),
      h("dt", {}, "Logical processors"),
      h("dd", {}, navigator.hardwareConcurrency || "Not available"),
      h("dt", {}, "Graphics"),
      h("dd", {}, d.renderer.backend),
      h("dt", {}, "Storage"),
      h("dd", {}, d.fs.db ? "Persistent local IndexedDB" : "Temporary memory"),
      h("dt", {}, "System type"),
      h("dd", {}, "HTML / JavaScript browser desktop"),
      h("dt", {}, "Desktop version"),
      h("dd", {}, "1.0.0"),
    ),
    h("h2", {}, "Windows desktop compatibility"),
    h(
      "p",
      {},
      "A browser recreation of the Vista desktop and its built-in applications. Files and settings belong to this browser profile. Native Windows programs, drivers, and kernel services require a separate machine emulator.",
    ),
    button(
      "View implementation and help",
      () => d.open("help", { topic: "Compatibility" }),
      "link-button",
    ),
  );
  return win;
}

function taskManager(d) {
  const win = d.wm.create({
      title: "Windows Task Manager",
      icon: "computer",
      appId: "taskmanager",
      width: 655,
      height: 475,
      remember: true,
    }),
    tabs = h("div", { class: "tabs" }),
    panel = h("div", { class: "tab-panel" }),
    actions = h("div", { class: "dialog-buttons" }),
    status = statusBar("");
  let active = "Applications",
    selected = null,
    points = [],
    last = performance.now();
  const render = () => {
    tabs.replaceChildren();
    for (const name of ["Applications", "Processes", "Performance"])
      tabs.append(
        button(
          name,
          () => {
            active = name;
            render();
          },
          "tab" + (name === active ? " active" : ""),
        ),
      );
    panel.replaceChildren();
    if (active === "Performance") {
      const memory = performance.memory,
        percent = memory
          ? Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100)
          : 0;
      panel.append(
        h("h3", {}, "JavaScript memory usage"),
        h(
          "div",
          { class: "performance-chart" },
          h("canvas", { width: 560, height: 140 }),
        ),
        h(
          "dl",
          { class: "system-summary" },
          h("dt", {}, "Used heap"),
          h(
            "dd",
            {},
            memory
              ? formatBytes(memory.usedJSHeapSize)
              : "Not reported by this browser",
          ),
          h("dt", {}, "Heap limit"),
          h(
            "dd",
            {},
            memory ? formatBytes(memory.jsHeapSizeLimit) : "Not reported",
          ),
          h("dt", {}, "Graphics backend"),
          h("dd", {}, d.renderer.backend),
          h("dt", {}, "Open windows"),
          h("dd", {}, d.wm.windows.filter((w) => !w.modal).length),
          h("dt", {}, "Virtual file entries"),
          h("dd", {}, d.fs.entries.size),
        ),
      );
      drawGraph();
    } else {
      const table = h(
          "table",
          { class: "data-table" },
          h(
            "thead",
            {},
            h(
              "tr",
              {},
              h(
                "th",
                { style: { width: "65%" } },
                active === "Applications" ? "Task" : "Image Name",
              ),
              h("th", {}, "Status"),
              h("th", {}, "PID"),
            ),
          ),
        ),
        body = h("tbody", {});
      for (const task of d.wm.windows.filter((w) => !w.modal)) {
        const row = h(
          "tr",
          {
            class: task.id === selected ? "selected" : "",
            onclick: () => {
              selected = task.id;
              render();
            },
            ondblclick: () => d.wm.focus(task),
          },
          h(
            "td",
            {},
            icon(task.icon, 16),
            " ",
            active === "Applications" ? task.title : task.appId + ".js",
          ),
          h("td", {}, task.minimized ? "Minimized" : "Running"),
          h("td", {}, task.id),
        );
        body.append(row);
      }
      table.append(body);
      panel.append(table);
    }
    actions.replaceChildren(
      button(
        "End Task",
        async () => {
          const target = d.wm.windows.find((w) => w.id === selected);
          if (target) await target.close();
          render();
        },
        "vista-button",
        { disabled: selected == null },
      ),
      button(
        "Switch To",
        () => {
          const target = d.wm.windows.find((w) => w.id === selected);
          if (target) d.wm.focus(target);
        },
        "vista-button",
        { disabled: selected == null },
      ),
      button("New Task…", () => d.open("run"), "vista-button"),
    );
    status.replaceChildren(
      h(
        "span",
        {},
        "Processes: " + d.wm.windows.filter((w) => !w.modal).length,
      ),
      h("span", {}, "Graphics: " + d.renderer.backend),
    );
  };
  function drawGraph() {
    const canvas = panel.querySelector("canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#34e058";
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((v, i) => {
      const x = (i / 59) * canvas.width,
        y = canvas.height - (v / 100) * canvas.height;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
  }
  const timer = setInterval(() => {
    const memory = performance.memory;
    points.push(
      memory ? (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100 : 0,
    );
    if (points.length > 60) points.shift();
    if (active === "Performance") drawGraph();
  }, 1000);
  win.onCleanup(() => clearInterval(timer));
  d.wm.on("open", render, win.signal);
  d.wm.on("close", render, win.signal);
  win.body.append(
    menuBar([
      {
        label: "File",
        items: [
          { label: "New Task (Run…)", action: () => d.open("run") },
          { label: "Exit Task Manager", action: () => win.close() },
        ],
      },
      { label: "Options", items: [{ label: "Refresh Now", action: render }] },
      { label: "View", items: [{ label: "Refresh Now", action: render }] },
      {
        label: "Windows",
        items: [
          { label: "Cascade", action: () => d.wm.cascade() },
          { label: "Tile Horizontally", action: () => d.wm.tile() },
          { label: "Tile Vertically", action: () => d.wm.tile(true) },
        ],
      },
    ]),
    tabs,
    panel,
    actions,
    status,
  );
  render();
  return win;
}

function backup(d) {
  const { win, main } = controlFrame(d, {
    title: "Backup and Restore Center",
    id: "backup",
    iconName: "drive",
  });
  const details = h("p", { class: "muted" });
  const refresh = async () => {
    const estimate = await navigator.storage?.estimate?.();
    details.textContent = `${d.fs.entries.size} virtual files and folders${estimate?.usage ? " · " + formatBytes(estimate.usage) + " browser storage used" : ""}`;
  };
  const exportAll = async () => {
    const files = JSON.parse(await (await d.fs.backup()).text()),
      data = {
        format: "vista-desktop-backup",
        version: 1,
        created: new Date().toISOString(),
        files,
        settings: d.settings.data,
      };
    downloadBlob(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      "Vista-Desktop-Backup.json",
    );
    d.settings.set("lastBackup", Date.now());
    d.toast(
      "Backup complete",
      "Your desktop backup has been downloaded.",
      "drive",
    );
  };
  const restore = async () => {
    const files = await chooseFiles({ accept: ".json,application/json" });
    if (!files[0]) return;
    let data;
    try {
      data = JSON.parse(await files[0].text());
      if (data.format !== "vista-desktop-backup" && data.format !== "vista-vfs")
        throw new Error("This is not a Vista desktop backup.");
    } catch (e) {
      d.dialog.error(e);
      return;
    }
    if (
      !(await d.dialog.confirm(
        "Restore Backup",
        "Replace the files and settings in this desktop with the selected backup?",
      ))
    )
      return;
    try {
      const payload = data.format === "vista-vfs" ? data : data.files;
      await d.fs.restoreBackup(new Blob([JSON.stringify(payload)]));
      if (data.settings && typeof data.settings === "object")
        for (const [key, value] of Object.entries(data.settings))
          if (!["__proto__", "constructor", "prototype"].includes(key))
            d.settings.set(key, value);
      d.toast(
        "Restore complete",
        "Your files and settings have been restored.",
        "drive",
      );
      refresh();
    } catch (e) {
      d.dialog.error(e);
    }
  };
  main.append(
    h("h1", {}, "Back up files or your entire computer"),
    h(
      "div",
      { class: "control-category" },
      icon("drive", 64),
      h(
        "div",
        {},
        h("h2", {}, "Back up files"),
        h(
          "p",
          {},
          "Save your documents, pictures, music, and desktop settings in one backup file.",
        ),
        button("Back up files", exportAll, "vista-button"),
      ),
    ),
    h("hr", {
      style: { border: 0, borderTop: "1px solid #ddd", margin: "25px 0" },
    }),
    h(
      "div",
      { class: "control-category" },
      icon("folder", 64),
      h(
        "div",
        {},
        h("h2", {}, "Restore files"),
        h("p", {}, "Restore this desktop from a backup you created earlier."),
        button("Restore files", restore, "vista-button"),
      ),
    ),
    h("h2", {}, "Storage"),
    details,
    button(
      "Request persistent storage",
      async () => {
        const granted = await navigator.storage?.persist?.();
        d.dialog.message(
          "Storage",
          granted
            ? "Your browser granted persistent storage."
            : "Your browser manages storage retention. Keep a backup of important files.",
        );
      },
      "link-button",
    ),
    h(
      "p",
      { class: "app-note" },
      "Files are kept in this browser profile. Download a backup before clearing browser data or moving to another device.",
    ),
  );
  refresh();
  return win;
}

function network(d) {
  const { win, main } = controlFrame(d, {
    title: "Network and Sharing Center",
    id: "network",
    iconName: "network",
  });
  function render() {
    const connection = navigator.connection;
    main.replaceChildren(
      h("h1", {}, "View your basic network information"),
      h(
        "div",
        { class: "network-map" },
        h("div", {}, icon("computer", 64), h("span", {}, "VISTA-PC")),
        h(
          "span",
          { class: "network-connection" },
          navigator.onLine ? "────────" : "──── × ────",
        ),
        h("div", {}, icon("network", 64), h("span", {}, "Network")),
        h(
          "span",
          { class: "network-connection" },
          navigator.onLine ? "────────" : "──── × ────",
        ),
        h("div", {}, icon("ie", 64), h("span", {}, "Internet")),
      ),
      h(
        "h2",
        {},
        navigator.onLine
          ? "Connected to the Internet"
          : "You are not connected",
      ),
      h(
        "dl",
        { class: "system-summary" },
        h("dt", {}, "Access"),
        h("dd", {}, navigator.onLine ? "Local and Internet" : "Local only"),
        h("dt", {}, "Connection"),
        h("dd", {}, connection?.effectiveType || "Managed by your browser"),
        h("dt", {}, "Estimated downlink"),
        h(
          "dd",
          {},
          connection?.downlink != null
            ? connection.downlink + " Mbps"
            : "Not reported",
        ),
        h("dt", {}, "Round-trip estimate"),
        h(
          "dd",
          {},
          connection?.rtt != null ? connection.rtt + " ms" : "Not reported",
        ),
      ),
      h("h2", {}, "Tasks"),
      button("Browse the Internet", () => d.open("ie"), "link-button"),
      h(
        "p",
        {},
        "Wi-Fi, Ethernet, VPN, and firewall configuration are managed by the operating system hosting this browser.",
      ),
    );
  }
  window.addEventListener("online", render, { signal: win.signal });
  window.addEventListener("offline", render, { signal: win.signal });
  render();
  return win;
}
function security(d) {
  const { win, main } = controlFrame(d, {
    title: "Windows Security Center",
    id: "security",
    iconName: "security",
  });
  main.append(
    h("h1", {}, "Windows Security Center"),
    h(
      "div",
      { class: "control-category" },
      icon("security", 64),
      h(
        "div",
        {},
        h("h2", {}, "Browser desktop protection"),
        h(
          "p",
          {},
          "Permissions and external content are controlled by your browser.",
        ),
      ),
    ),
    h(
      "div",
      { class: "security-row" },
      h("strong", {}, "Internet browsing"),
      h("span", {}, "Isolated frames"),
    ),
    h(
      "div",
      { class: "security-row" },
      h("strong", {}, "Local files"),
      h("span", {}, "Browser profile storage"),
    ),
    h(
      "div",
      { class: "security-row" },
      h("strong", {}, "Microphone and screen capture"),
      h("span", {}, "Permission required"),
    ),
    h(
      "div",
      { class: "security-row" },
      h("strong", {}, "Native programs"),
      h("span", {}, "Not executed"),
    ),
    h("h2", {}, "Maintain your desktop"),
    button("Back up files and settings", () => d.open("backup"), "link-button"),
    h(
      "p",
      {},
      "This panel describes the browser desktop. Antivirus, firewall, Windows Update, and account permissions on your actual computer are managed by the host operating system.",
    ),
  );
  return win;
}

function registry(d) {
  let data = d.settings.get("registry", {
      HKEY_CLASSES_ROOT: {},
      HKEY_CURRENT_USER: {},
      "HKEY_CURRENT_USER\\Software": {},
      "HKEY_CURRENT_USER\\Software\\VistaDesktop": {
        Theme: { type: "REG_SZ", value: d.settings.get("theme", "aero") },
        UserName: { type: "REG_SZ", value: d.settings.get("userName", "User") },
        ShowWelcome: {
          type: "REG_DWORD",
          value: d.settings.get("showWelcome", true) ? 1 : 0,
        },
      },
      HKEY_LOCAL_MACHINE: {},
      "HKEY_LOCAL_MACHINE\\Software": {},
      HKEY_USERS: {},
      HKEY_CURRENT_CONFIG: {},
    }),
    key = "HKEY_CURRENT_USER\\Software\\VistaDesktop",
    selected = null;
  const win = d.wm.create({
      title: "Registry Editor",
      icon: "control",
      appId: "registry",
      width: 825,
      height: 510,
    }),
    tree = h("div", { class: "registry-tree" }),
    view = h("div", { class: "registry-values" }),
    status = statusBar(key);
  const persist = () => {
    d.settings.set("registry", data);
    const values = data["HKEY_CURRENT_USER\\Software\\VistaDesktop"];
    if (values?.Theme)
      d.settings.set(
        "theme",
        values.Theme.value === "basic" ? "basic" : "aero",
      );
    if (values?.UserName)
      d.settings.set("userName", String(values.UserName.value));
    if (values?.ShowWelcome)
      d.settings.set("showWelcome", Boolean(Number(values.ShowWelcome.value)));
    render();
  };
  async function editValue(name = null) {
    const existing = name ? data[key]?.[name] : null,
      title = h("input", { class: "vista-input", value: name || "New Value" }),
      type = h(
        "select",
        { class: "vista-input" },
        ["REG_SZ", "REG_DWORD", "REG_BINARY"].map((t) =>
          h("option", { value: t, selected: existing?.type === t }, t),
        ),
      ),
      value = h("input", {
        class: "vista-input",
        value: existing?.value ?? "",
      });
    if (
      await d.dialog.form({
        title: existing ? "Edit Value" : "New Value",
        width: 440,
        body: h(
          "div",
          {},
          field("Value name:", title),
          field("Type:", type),
          field("Value data:", value),
        ),
        buttons: [
          { label: "OK", value: true, primary: true },
          { label: "Cancel", value: false },
        ],
      })
    ) {
      if (!title.value.trim()) return;
      if (
        type.value === "REG_DWORD" &&
        !/^(0x[0-9a-f]+|\d+)$/i.test(value.value)
      ) {
        d.dialog.message(
          "Registry Editor",
          "Enter a valid decimal or hexadecimal DWORD value.",
        );
        return;
      }
      if (name) delete data[key][name];
      data[key] ??= {};
      data[key][title.value] = {
        type: type.value,
        value:
          type.value === "REG_DWORD" ? Number(value.value) >>> 0 : value.value,
      };
      persist();
    }
  }
  const newKey = async () => {
    const name = await d.dialog.prompt("New Key", "Key name:", "New Key");
    if (!name) return;
    if (name.includes("\\")) {
      d.dialog.message(
        "Registry Editor",
        "A key name cannot contain a backslash.",
      );
      return;
    }
    const path = key + "\\" + name;
    if (data[path]) {
      d.dialog.message("Registry Editor", "That key already exists.");
      return;
    }
    data[path] = {};
    key = path;
    persist();
  };
  const remove = async () => {
    if (selected != null) {
      if (
        await d.dialog.confirm(
          "Confirm Value Delete",
          `Delete value “${selected}”?`,
        )
      ) {
        delete data[key][selected];
        selected = null;
        persist();
      }
    } else if (
      key.includes("\\") &&
      (await d.dialog.confirm(
        "Confirm Key Delete",
        `Delete the key “${key}” and its subkeys?`,
      ))
    ) {
      for (const path of Object.keys(data))
        if (path === key || path.startsWith(key + "\\")) delete data[path];
      key = key.slice(0, key.lastIndexOf("\\"));
      persist();
    }
  };
  function render() {
    tree.replaceChildren();
    for (const path of Object.keys(data).sort()) {
      const depth = path.split("\\").length - 1;
      tree.append(
        button(
          [icon("folder", 16), path.split("\\").at(-1)],
          () => {
            key = path;
            selected = null;
            render();
          },
          "explorer-side-link" + (key === path ? " active" : ""),
          { style: { paddingLeft: 8 + depth * 16 + "px" } },
        ),
      );
    }
    const table = h(
        "table",
        { class: "data-table" },
        h(
          "thead",
          {},
          h(
            "tr",
            {},
            h("th", {}, "Name"),
            h("th", {}, "Type"),
            h("th", {}, "Data"),
          ),
        ),
      ),
      body = h("tbody", {});
    body.append(
      h(
        "tr",
        {},
        h("td", {}, "(Default)"),
        h("td", {}, "REG_SZ"),
        h("td", {}, "(value not set)"),
      ),
    );
    for (const [name, value] of Object.entries(data[key] || {}))
      body.append(
        h(
          "tr",
          {
            class: selected === name ? "selected" : "",
            onclick: () => {
              selected = name;
              render();
            },
            ondblclick: () => editValue(name),
          },
          h("td", {}, name),
          h("td", {}, value.type),
          h("td", {}, String(value.value)),
        ),
      );
    table.append(body);
    view.replaceChildren(table);
    status.textContent = key;
  }
  win.body.append(
    menuBar([
      {
        label: "File",
        items: [
          {
            label: "Export…",
            action: () =>
              downloadBlob(
                new Blob(
                  [
                    JSON.stringify(
                      { format: "vista-registry", keys: data },
                      null,
                      2,
                    ),
                  ],
                  { type: "application/json" },
                ),
                "Registry.json",
              ),
          },
          {
            label: "Import…",
            action: async () => {
              const files = await chooseFiles({ accept: ".json" });
              if (!files[0]) return;
              try {
                const imported = JSON.parse(await files[0].text());
                if (
                  imported.format !== "vista-registry" ||
                  !imported.keys ||
                  typeof imported.keys !== "object"
                )
                  throw new Error("Choose a Vista registry export.");
                data = Object.fromEntries(
                  Object.entries(imported.keys).filter(
                    ([k, v]) =>
                      /^HKEY_(CLASSES_ROOT|CURRENT_USER|LOCAL_MACHINE|USERS|CURRENT_CONFIG)(\\|$)/.test(
                        k,
                      ) &&
                      v &&
                      typeof v === "object",
                  ),
                );
                persist();
              } catch (e) {
                d.dialog.error(e);
              }
            },
          },
          { label: "Exit", action: () => win.close() },
        ],
      },
      {
        label: "Edit",
        items: [
          { label: "New Key", action: newKey },
          { label: "New Value", action: () => editValue() },
          {
            label: "Modify…",
            action: () => {
              if (selected) editValue(selected);
            },
          },
          { label: "Delete", action: remove },
        ],
      },
      { label: "View", items: [{ label: "Refresh", action: render }] },
      {
        label: "Help",
        items: [
          {
            label: "About Registry Editor",
            action: () =>
              d.dialog.message(
                "Registry Editor",
                "Edit the registry of this browser desktop.\nTheme, UserName, and ShowWelcome under HKEY_CURRENT_USER\\Software\\VistaDesktop are applied to the desktop.\nThe host computer’s registry is not accessed.",
              ),
          },
        ],
      },
    ]),
    h("div", { class: "registry-layout" }, tree, view),
    status,
  );
  render();
  return win;
}

function services(d) {
  const { win, main } = controlFrame(d, { title: "Services", id: "services" }),
    table = h("table", { class: "data-table" });
  const definitions = [
    {
      name: "Windows Sidebar",
      description: "Displays desktop gadgets.",
      key: "sidebar",
      fallback: true,
    },
    {
      name: "Windows Audio",
      description: "Enables desktop system sounds.",
      key: "sounds",
      fallback: true,
    },
    {
      name: "Windows Search",
      description: "Enables file search in Start and Explorer.",
      key: "searchEnabled",
      fallback: true,
    },
  ];
  let selected = 0;
  function render() {
    table.replaceChildren(
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          h("th", {}, "Name"),
          h("th", {}, "Status"),
          h("th", {}, "Startup Type"),
        ),
      ),
    );
    const body = h("tbody", {});
    definitions.forEach((service, i) =>
      body.append(
        h(
          "tr",
          {
            class: selected === i ? "selected" : "",
            onclick: () => {
              selected = i;
              render();
            },
          },
          h("td", {}, service.name),
          h(
            "td",
            {},
            d.settings.get(service.key, service.fallback)
              ? "Started"
              : "Stopped",
          ),
          h("td", {}, "Automatic"),
        ),
      ),
    );
    table.append(body);
    description.textContent = definitions[selected].description;
    start.disabled = d.settings.get(definitions[selected].key, true);
    stop.disabled = !start.disabled;
  }
  const description = h("p", {}),
    start = button(
      "Start",
      () => {
        d.settings.set(definitions[selected].key, true);
        render();
      },
      "vista-button",
    ),
    stop = button(
      "Stop",
      () => {
        d.settings.set(definitions[selected].key, false);
        render();
      },
      "vista-button",
    );
  main.append(
    h("h1", {}, "Services (Local Desktop)"),
    table,
    description,
    h("div", { style: { display: "flex", gap: "8px" } }, start, stop),
    h(
      "p",
      { class: "muted" },
      "These services control features in the browser desktop. Native Windows services are managed by the host operating system.",
    ),
  );
  render();
  return win;
}

function taskScheduler(d) {
  const { win, main } = controlFrame(d, {
      title: "Task Scheduler",
      id: "tasks",
    }),
    table = h("table", { class: "data-table" });
  let tasks = d.settings.get("scheduledTasks", []),
    selected = null;
  const persist = () => {
    d.settings.set("scheduledTasks", tasks);
    render();
  };
  async function create() {
    const name = h("input", { class: "vista-input", value: "New Task" }),
      app = h(
        "select",
        { class: "vista-input" },
        ...d.apps
          .filter((a) => a.id !== "tasks")
          .map((a) => h("option", { value: a.id }, a.name)),
      ),
      delay = h("input", {
        class: "vista-input",
        type: "number",
        min: 1,
        max: 86400,
        value: 60,
      }),
      repeat = h("input", { type: "checkbox" });
    if (
      await d.dialog.form({
        title: "Create Basic Task",
        width: 450,
        body: h(
          "div",
          {},
          field("Name:", name),
          field("Program:", app),
          field("Run after (sec):", delay),
          h("label", { class: "field" }, repeat, "Repeat at this interval"),
          h(
            "p",
            { class: "muted" },
            "Tasks run while this desktop is open and unlocked.",
          ),
        ),
        buttons: [
          { label: "Create", value: true, primary: true },
          { label: "Cancel", value: false },
        ],
      })
    ) {
      const interval =
        Math.max(1, Math.min(86400, Number(delay.value) || 60)) * 1000;
      tasks.push({
        id: crypto.randomUUID(),
        name: name.value || "New Task",
        app: app.value,
        enabled: true,
        next: Date.now() + interval,
        interval: repeat.checked ? interval : 0,
        last: null,
      });
      persist();
    }
  }
  function render() {
    tasks = d.settings.get("scheduledTasks", []);
    table.replaceChildren(
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          h("th", {}, "Name"),
          h("th", {}, "Status"),
          h("th", {}, "Next Run Time"),
          h("th", {}, "Last Run Time"),
        ),
      ),
      h(
        "tbody",
        {},
        ...tasks.map((task) =>
          h(
            "tr",
            {
              class: selected === task.id ? "selected" : "",
              onclick: () => {
                selected = task.id;
                render();
              },
            },
            h("td", {}, task.name),
            h("td", {}, task.enabled ? "Ready" : "Disabled"),
            h(
              "td",
              {},
              task.enabled ? new Date(task.next).toLocaleTimeString() : "—",
            ),
            h(
              "td",
              {},
              task.last ? new Date(task.last).toLocaleTimeString() : "Never",
            ),
          ),
        ),
      ),
    );
  }
  main.append(
    h("h1", {}, "Task Scheduler Library"),
    h(
      "div",
      { class: "toolbar", style: { marginBottom: "15px" } },
      tool("Create Basic Task", "calendar", create),
      tool("Run", "run", () => {
        const task = tasks.find((t) => t.id === selected);
        if (task) d.open(task.app);
      }),
      tool("Enable / Disable", "control", () => {
        const task = tasks.find((t) => t.id === selected);
        if (task) {
          task.enabled = !task.enabled;
          if (task.enabled && task.next < Date.now())
            task.next = Date.now() + 1000;
          persist();
        }
      }),
      tool("Delete", "recycle", () => {
        tasks = tasks.filter((t) => t.id !== selected);
        persist();
      }),
    ),
    table,
    h(
      "p",
      { class: "app-note" },
      "Schedules belong to this browser desktop. Keep it open and unlocked for tasks to run.",
    ),
  );
  d.settings.on(
    "change",
    ({ key }) => {
      if (key === "scheduledTasks") render();
    },
    win.signal,
  );
  render();
  return win;
}

function accessibility(d) {
  const { win, main } = controlFrame(d, {
    title: "Ease of Access Center",
    id: "accessibility",
  });
  main.append(
    h("h1", {}, "Make your computer easier to use"),
    h("h2", {}, "Quick access to common tools"),
    h(
      "div",
      { class: "toolbar" },
      tool("Start Magnifier", "search", () => d.open("magnifier")),
      tool("On-Screen Keyboard", "notepad", () => keyboard(d)),
      tool("Read selected text", "help", () => {
        const text = getSelection()?.toString();
        if (text && window.speechSynthesis) {
          const voice = new SpeechSynthesisUtterance(text);
          speechSynthesis.speak(voice);
        } else
          d.dialog.message(
            "Narrator",
            "Select text in an application, then use “Read selected text.” Your browser must support speech synthesis.",
          );
      }),
    ),
  );
  const contrast = h("input", {
      type: "checkbox",
      checked: d.settings.get("highContrast", false),
    }),
    text = h("input", {
      type: "checkbox",
      checked: d.settings.get("largeText", false),
    });
  contrast.onchange = () => d.settings.set("highContrast", contrast.checked);
  text.onchange = () => d.settings.set("largeText", text.checked);
  main.append(
    h("h2", {}, "Explore all settings"),
    h("label", { class: "field" }, contrast, "Increase contrast"),
    h("label", { class: "field" }, text, "Use larger interface text"),
    h(
      "p",
      {},
      "Keyboard shortcuts: Ctrl+Esc opens Start. Ctrl+Shift+Esc opens Task Manager. Use the Quick Launch window switcher when the browser reserves Alt+Tab.",
    ),
  );
  return win;
}
function keyboard(d) {
  let target = document.activeElement;
  const win = d.wm.create({
      title: "On-Screen Keyboard",
      icon: "notepad",
      appId: "keyboard",
      width: 680,
      height: 260,
    }),
    body = h("div", { class: "onscreen-keyboard" });
  d.host.addEventListener(
    "focusin",
    (e) => {
      if (
        !win.el.contains(e.target) &&
        e.target.matches("input,textarea,[contenteditable]")
      )
        target = e.target;
    },
    { signal: win.signal },
  );
  for (const row of ["1234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm"]) {
    const line = h("div", {});
    for (const key of row) {
      const b = button(
        key,
        () => {
          if (target?.setRangeText) {
            target.setRangeText(
              key,
              target.selectionStart,
              target.selectionEnd,
              "end",
            );
            target.dispatchEvent(new Event("input", { bubbles: true }));
          } else if (target?.isContentEditable) {
            target.focus();
            document.execCommand("insertText", false, key);
          }
        },
        "vista-button",
      );
      b.onmousedown = (e) => e.preventDefault();
      line.append(b);
    }
    body.append(line);
  }
  const space = button(
    "Space",
    () => {
      if (target?.setRangeText) {
        target.setRangeText(
          " ",
          target.selectionStart,
          target.selectionEnd,
          "end",
        );
        target.dispatchEvent(new Event("input", { bubbles: true }));
      }
    },
    "vista-button",
  );
  space.onmousedown = (e) => e.preventDefault();
  body.append(space);
  win.body.append(body);
  return win;
}
function magnifier(d) {
  const win = d.wm.create({
      title: "Magnifier",
      icon: "search",
      appId: "magnifier",
      width: 365,
      height: 205,
      resizable: false,
    }),
    zoom = h("input", {
      type: "range",
      min: 100,
      max: 200,
      step: 25,
      value: 100,
    }),
    label = h("span", {}, "100%");
  const initial = d.workspace.style.zoom;
  zoom.oninput = () => {
    const value = Number(zoom.value);
    label.textContent = value + "%";
    d.workspace.style.zoom = String(value / 100);
    d.wm.reflow();
  };
  win.body.append(
    h(
      "div",
      { class: "dialog-body" },
      h("p", {}, "Increase the size of application windows and text."),
      field("Scale:", zoom),
      label,
      button(
        "Reset",
        () => {
          zoom.value = "100";
          zoom.oninput();
        },
        "vista-button",
        { style: { marginLeft: "18px" } },
      ),
    ),
  );
  win.onCleanup(() => {
    d.workspace.style.zoom = initial;
    d.wm.reflow();
  });
  return win;
}

const HELP_TOPICS = {
  "Getting started": [
    "Welcome to Windows Vista",
    "Use the Start button at the bottom-left to open your programs. Computer shows your files, and Control Panel changes desktop settings.\n\nDouble-click an icon to open it. Drag a window’s title bar to move it; drag its edges to resize. Minimize, maximize, and close buttons are in the upper-right.\n\nFiles and settings are saved in this browser on this device. Use Backup and Restore Center to export them.",
  ],
  "Files and folders": [
    "Working with files",
    "Open Computer to browse the virtual C: drive. Your Documents, Pictures, Music, Videos, and Desktop folders are under C:\\Users\\User.\n\nUse Organize or right-click an item to copy, cut, rename, delete, or view its properties. Deleted items can be restored from Recycle Bin.\n\nImport files from your computer using the Import button or by dropping them onto the desktop. Use Download to export a file.",
  ],
  Programs: [
    "Using your programs",
    "Notepad edits plain text. WordPad edits rich text and HTML. Paint edits raster images and exports PNG.\n\nWindows Media Player plays formats your browser supports. Photo Gallery views, rotates, and edits pictures. Movie Maker creates a storyboard and exports a real browser-encoded video.\n\nCalendar stores appointments and tasks, and exchanges iCalendar files. Contacts supports vCard import and export. Mail keeps local messages and drafts and hands prepared email to your configured email application.",
  ],
  Games: [
    "Games in Windows Vista",
    "Minesweeper, Solitaire, FreeCell, Spider Solitaire, Hearts, Chess Titans, Mahjong Titans, Purble Place, and InkBall are included.\n\nEach game has a Game menu with its own New Game, difficulty, and help commands. Games use native browser input and local rule engines. Chess runs its computer opponent in a worker.",
  ],
  "Keyboard shortcuts": [
    "Using the keyboard",
    "Ctrl+Esc: Open Start\nCtrl+Shift+Esc: Task Manager\nAlt+F4: Close the current window\nAlt+Space: Window menu\nAlt+Tab: Switch windows, where allowed by the browser\nF2: Rename a file / New game\nCtrl+C / Ctrl+X / Ctrl+V: Copy / Cut / Paste\nCtrl+A: Select all\nCtrl+N / Ctrl+O / Ctrl+S: New / Open / Save\nCtrl+Z / Ctrl+Y: Undo / Redo\n\nThe host browser or operating system may reserve some combinations. Equivalent buttons and menus are available.",
  ],
  Compatibility: [
    "About this browser desktop",
    "This is an HTML and JavaScript recreation of Windows Vista Ultimate SP1 at 96 DPI. The interface uses original Vista imagery and a reconstructed Aero theme.\n\nWebGPU renders the wallpaper and accelerates Paint image filters. WebGL2 and Canvas 2D provide fallbacks. The browser renders semantic window controls, text, and glass effects.\n\nIt does not boot the NT kernel or execute native PE/Win32 programs, drivers, ActiveX, DirectX binaries, or arbitrary Windows installers. Host networking, antivirus, device management, real user accounts, optical-disc burning, and Windows activation remain host operating-system functions.\n\nSome applications implement a browser-supported subset of the original formats and workflows. RTF interchange is plain text, movie projects use JSON, and video export uses the browser’s available WebM/MP4 encoder. Original MSWMM and DVD-Video authoring are not implemented.\n\nText rendering depends on the available Segoe UI font and browser rasterizer. Pixel-for-pixel equivalence with every original Vista surface has not been established.",
  ],
  "Privacy and storage": [
    "Your desktop data",
    "Files are stored locally in IndexedDB. Preferences, appointments, contacts, messages, and game statistics are stored in browser preferences for this site.\n\nThe desktop does not connect to your email, calendar, cloud storage, or real Windows account. No connector access is enabled.\n\nMicrophone recording and screen capture require an explicit browser permission when you use those applications. Imported websites run in sandboxed frames.\n\nBrowser data can be cleared or evicted. Export a backup before changing devices or clearing site storage.",
  ],
  About: [
    "Windows Vista browser desktop",
    "Version 1.0.0\n\nA modular desktop recreation built with JavaScript, HTML, CSS, WebGPU, WebGL2, and Canvas 2D.\n\nWindows, Windows Vista, and original graphical assets are trademarks or copyrighted works of Microsoft. This project is an independent browser recreation. Source and asset provenance are documented with the project.",
  ],
};
function help(d, args) {
  const win = d.wm.create({
      title: "Windows Help and Support",
      icon: "help",
      appId: "help",
      width: 805,
      height: 575,
      remember: true,
    }),
    side = h("div", { class: "control-sidebar" }),
    main = h("div", { class: "help-main" }),
    search = h("input", {
      class: "vista-input",
      placeholder: "Search Help",
      "aria-label": "Search Help",
    });
  let topic = HELP_TOPICS[args.topic] ? args.topic : "Getting started";
  function render() {
    side.replaceChildren();
    for (const name of Object.keys(HELP_TOPICS))
      side.append(
        button(
          name,
          () => {
            topic = name;
            render();
          },
          "link-button",
        ),
      );
    const [title, body] = HELP_TOPICS[topic];
    main.replaceChildren(
      h("h1", {}, title),
      h("div", { class: "help-prose" }, body),
    );
  }
  search.oninput = () => {
    const q = search.value.toLowerCase();
    if (!q) {
      render();
      return;
    }
    main.replaceChildren(h("h1", {}, "Search results"));
    for (const [name, [title, body]] of Object.entries(HELP_TOPICS))
      if ((name + " " + title + " " + body).toLowerCase().includes(q))
        main.append(
          button(
            [h("h2", {}, title), h("p", {}, body.slice(0, 150) + "…")],
            () => {
              topic = name;
              search.value = "";
              render();
            },
            "help-result",
          ),
        );
  };
  win.body.append(
    h(
      "div",
      { class: "help-header" },
      icon("help", 36),
      h("span", {}, "Windows Help and Support"),
      search,
    ),
    h("div", { class: "control-layout" }, side, main),
    statusBar("Windows Help and Support"),
  );
  render();
  return win;
}
