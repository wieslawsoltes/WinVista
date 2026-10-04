import {
  basename,
  dirname,
  extension,
  joinPath,
  normalizePath,
  prettyPath,
  formatBytes,
  downloadBlob,
} from "../core/index.js";
import {
  h,
  icon,
  fileIcon,
  button,
  tool,
  showMenu,
  statusBar,
} from "../ui/index.js";

export function launch(d, id, args = {}) {
  return openExplorer(d, args);
}
export function openExplorer(d, args = {}) {
  const fs = d.fs,
    win = d.wm.create({
      title: "Computer",
      icon: "computer",
      appId: "explorer",
      width: 820,
      height: 535,
      remember: true,
    });
  let current = args.path ? normalizePath(args.path) : "computer",
    query = "",
    selection = new Set(args.select ? [args.select] : []),
    view = d.settings.get("explorerView", "icons"),
    sort = "name",
    sortDirection = 1,
    history = [current],
    historyIndex = 0,
    rows = [],
    anchor = 0;
  const back = button("‹", () => goHistory(-1), "nav-button", {
      title: "Back",
      "aria-label": "Back",
    }),
    forward = button("›", () => goHistory(1), "nav-button", {
      title: "Forward",
      "aria-label": "Forward",
    }),
    crumb = h("div", { class: "breadcrumb" }),
    search = h("input", {
      class: "vista-input",
      placeholder: "Search Computer",
      "aria-label": "Search files",
    });
  const address = h(
      "div",
      { class: "explorer-address" },
      back,
      forward,
      crumb,
      h("div", { class: "explorer-search" }, search, icon("search", 16)),
    ),
    bar = h("div", { class: "toolbar" }),
    sidebar = h("nav", {
      class: "explorer-sidebar",
      "aria-label": "Favorite links",
    }),
    content = h("div", { class: "explorer-content", tabIndex: 0 }),
    details = h("div", { class: "explorer-details" }),
    status = statusBar("");
  win.body.append(
    address,
    bar,
    h("div", { class: "explorer-main" }, sidebar, content),
    details,
    status,
  );
  const guard =
    (fn) =>
    async (...params) => {
      try {
        return await fn(...params);
      } catch (error) {
        d.dialog.error(error);
      }
    };
  function selectedEntries() {
    return [...selection].map((p) => fs.stat(p)).filter(Boolean);
  }
  function navigate(path, record = true) {
    if (path !== "computer") {
      const e = fs.stat(path);
      if (!e || e.kind !== "folder") {
        d.dialog.error(new Error("The folder does not exist."));
        return;
      }
      path = e.path;
    }
    current = path;
    selection.clear();
    query = "";
    search.value = "";
    if (record) {
      history = history.slice(0, historyIndex + 1);
      history.push(path);
      historyIndex = history.length - 1;
    }
    render();
  }
  function goHistory(delta) {
    const next = historyIndex + delta;
    if (next < 0 || next >= history.length) return;
    historyIndex = next;
    navigate(history[next], false);
  }
  function selectedPath() {
    return selectedEntries()[0]?.path;
  }
  const openSelected = () => {
    for (const entry of selectedEntries()) {
      if (entry.kind === "folder") navigate(entry.path);
      else d.openFile(entry.path);
    }
  };
  const copy = (cut) => d.clipboard.setFiles([...selection], cut);
  const paste = guard(() => {
    const result = d.clipboard.paste(
      fs,
      current === "computer" ? "C:/Users/User/Documents" : current,
    );
    selection = new Set(result);
    renderContent();
  });
  const newFolder = guard(async () => {
    if (current === "computer") navigate("C:/Users/User");
    const name = await d.dialog.prompt(
      "New folder",
      "Folder name:",
      "New folder",
    );
    if (!name) return;
    fs.validateName(name);
    const entry = fs.mkdir(joinPath(current, name));
    selection = new Set([entry.path]);
    renderContent();
  });
  const rename = guard(async () => {
    const entry = selectedEntries()[0];
    if (!entry) return;
    const name = await d.dialog.prompt("Rename", "File name:", entry.name);
    if (!name || name === entry.name) return;
    fs.validateName(name);
    const result = fs.move(entry.path, joinPath(dirname(entry.path), name));
    selection = new Set([result.path]);
    renderContent();
  });
  const remove = guard(async (permanent = false) => {
    const entries = selectedEntries();
    if (!entries.length) return;
    const recycle = current === "C:/$Recycle.Bin";
    if (
      !(await d.dialog.confirm(
        recycle || permanent ? "Delete permanently" : "Delete",
        `Are you sure you want to ${recycle || permanent ? "permanently delete" : "move to the Recycle Bin"} ${entries.length === 1 ? "“" + entries[0].name + "”" : entries.length + " items"}?`,
      ))
    )
      return;
    for (const e of entries) fs.remove(e.path, recycle || permanent);
    selection.clear();
    renderContent();
  });
  const restore = guard(() => {
    for (const e of selectedEntries()) fs.restore(e.path);
    selection.clear();
    renderContent();
  });
  const download = guard(async () => {
    for (const e of selectedEntries()) {
      if (e.kind === "file") downloadBlob(await fs.exportBlob(e.path), e.name);
    }
  });
  const properties = () =>
    showProperties(d, selectedEntries()[0] || fs.stat(current));
  const contextItems = () => {
    if (current === "C:/$Recycle.Bin")
      return [
        { label: "Restore", disabled: !selection.size, action: restore },
        {
          label: "Delete",
          disabled: !selection.size,
          action: () => remove(true),
        },
        null,
        {
          label: "Empty Recycle Bin",
          action: guard(async () => {
            if (
              await d.dialog.confirm(
                "Empty Recycle Bin",
                "Permanently delete all items in the Recycle Bin?",
              )
            )
              for (const e of fs.list(current)) fs.remove(e.path, true);
          }),
        },
        {
          label: "Properties",
          disabled: selection.size !== 1,
          action: properties,
        },
      ];
    return [
      { label: "Open", disabled: !selection.size, action: openSelected },
      {
        label: "Open with",
        disabled:
          selection.size !== 1 || selectedEntries()[0]?.kind === "folder",
        items: [
          {
            label: "Notepad",
            icon: "notepad",
            action: () => d.open("notepad", { path: selectedPath() }),
          },
          {
            label: "WordPad",
            icon: "wordpad",
            action: () => d.open("wordpad", { path: selectedPath() }),
          },
          {
            label: "Paint",
            icon: "paint",
            action: () => d.open("paint", { path: selectedPath() }),
          },
          {
            label: "Windows Media Player",
            icon: "media",
            action: () => d.open("media", { path: selectedPath() }),
          },
        ],
      },
      null,
      {
        label: "Cut",
        shortcut: "Ctrl+X",
        disabled: !selection.size,
        action: () => copy(true),
      },
      {
        label: "Copy",
        shortcut: "Ctrl+C",
        disabled: !selection.size,
        action: () => copy(false),
      },
      {
        label: "Paste",
        shortcut: "Ctrl+V",
        disabled: !d.clipboard.files.length,
        action: paste,
      },
      null,
      {
        label: "Delete",
        shortcut: "Del",
        disabled: !selection.size,
        action: () => remove(),
      },
      {
        label: "Rename",
        shortcut: "F2",
        disabled: selection.size !== 1,
        action: rename,
      },
      null,
      { label: "New folder", icon: "folder", action: newFolder },
      {
        label: "New text document",
        icon: "notepad",
        action: guard(() => {
          if (current === "computer") navigate("C:/Users/User/Documents");
          const path = fs.uniquePath(current, "New Text Document.txt");
          fs.write(path, "");
          selection = new Set([path]);
          renderContent();
        }),
      },
      {
        label: "Import files…",
        action: () =>
          d.importFiles(
            current === "computer" ? "C:/Users/User/Downloads" : current,
          ),
      },
      {
        label: "Download",
        disabled: !selectedEntries().some((e) => e.kind === "file"),
        action: download,
      },
      null,
      {
        label: "Properties",
        disabled: selection.size !== 1 && current === "computer",
        action: properties,
      },
    ];
  };
  function renderBar() {
    bar.replaceChildren();
    const menuButton = (label, items) =>
      button(
        label,
        (e) => {
          const r = e.currentTarget.getBoundingClientRect();
          showMenu(
            typeof items === "function" ? items() : items,
            r.left,
            r.bottom,
          );
        },
        "toolbar-button",
      );
    bar.append(
      menuButton("Organize ▾", contextItems),
      menuButton("Views ▾", [
        {
          label: "Large Icons",
          checked: view === "icons",
          action: () => {
            view = "icons";
            d.settings.set("explorerView", view);
            renderContent();
          },
        },
        {
          label: "Details",
          checked: view === "details",
          action: () => {
            view = "details";
            d.settings.set("explorerView", view);
            renderContent();
          },
        },
      ]),
    );
    if (current === "computer")
      bar.append(
        tool("System properties", "computer", () => d.open("system")),
        tool("Open Control Panel", "control", () => d.open("control")),
      );
    else if (current === "C:/$Recycle.Bin")
      bar.append(
        tool("Restore selected items", "recycle", restore),
        tool("Empty Recycle Bin", "recycle", contextItems()[3].action),
      );
    else
      bar.append(
        tool("New folder", "folder", newFolder),
        tool("Import", "documents", () => d.importFiles(current)),
        tool("Download", "drive", download),
      );
    bar.append(
      h("span", { class: "spacer" }),
      tool("Help", "help", () =>
        d.open("help", { topic: "Files and folders" }),
      ),
    );
  }
  function renderSidebar() {
    sidebar.replaceChildren(
      h("div", { class: "group-label" }, "Favorite Links"),
    );
    const links = [
      ["Documents", "documents", "C:/Users/User/Documents"],
      ["Pictures", "pictures", "C:/Users/User/Pictures"],
      ["Music", "music", "C:/Users/User/Music"],
      ["Recently Changed", "folder", "C:/Users/User/Documents"],
      ["Searches", "search", "C:/Users/User"],
      ["Public", "users", "C:/Users"],
      ["Desktop", "desktop", "C:/Users/User/Desktop"],
      ["Downloads", "folder", "C:/Users/User/Downloads"],
    ];
    for (const [name, ico, path] of links)
      sidebar.append(
        button(
          [icon(ico, 16), name],
          () => navigate(path),
          "explorer-side-link" + (current === path ? " active" : ""),
        ),
      );
    sidebar.append(
      h(
        "div",
        {
          class: "group-label",
          style: { marginTop: "18px", borderTop: "1px solid #c3d4e2" },
        },
        "Folders",
      ),
    );
    for (const [name, ico, path] of [
      ["Computer", "computer", "computer"],
      ["Local Disk (C:)", "drive", "C:/"],
      ["Users", "users", "C:/Users"],
      ["User", "user", "C:/Users/User"],
      ["Windows", "folder", "C:/Windows"],
      ["Recycle Bin", "recycle", "C:/$Recycle.Bin"],
    ])
      sidebar.append(
        button(
          [icon(ico, 16), name],
          () => navigate(path),
          "explorer-side-link tree" + (current === path ? " active" : ""),
        ),
      );
  }
  function renderAddress() {
    back.disabled = historyIndex === 0;
    forward.disabled = historyIndex === history.length - 1;
    crumb.replaceChildren(
      icon(
        current === "computer"
          ? "computer"
          : current === "C:/$Recycle.Bin"
            ? "recycle"
            : fileIcon(fs.stat(current) || { kind: "folder", name: "" }),
        16,
      ),
    );
    const link = (name, path) => {
      crumb.append(
        button(name, () => navigate(path), ""),
        h("span", { class: "crumb-arrow" }, "▶"),
      );
    };
    link("Computer", "computer");
    if (current !== "computer") {
      link("Local Disk (C:)", "C:/");
      const segments = current.slice(3).split("/").filter(Boolean);
      let path = "C:/";
      for (const segment of segments) {
        path = joinPath(path, segment);
        link(segment === "$Recycle.Bin" ? "Recycle Bin" : segment, path);
      }
    }
    const edit = h("span", {
      class: "spacer",
      style: { height: "22px", minWidth: "15px" },
    });
    crumb.append(edit);
    edit.onclick = () => {
      const input = h("input", {
        value: current === "computer" ? "Computer" : prettyPath(current),
        "aria-label": "Address",
      });
      crumb.replaceChildren(input);
      input.focus();
      input.select();
      input.onblur = renderAddress;
      input.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          navigate(
            input.value.toLowerCase() === "computer" ? "computer" : input.value,
          );
        }
        if (e.key === "Escape") renderAddress();
      };
    };
    search.placeholder =
      "Search " + (current === "computer" ? "Computer" : basename(current));
  }
  function select(entry, event, index) {
    if (event.shiftKey) {
      const from = Math.min(anchor, index),
        to = Math.max(anchor, index);
      selection = new Set(rows.slice(from, to + 1).map((e) => e.path));
    } else if (event.ctrlKey || event.metaKey) {
      if (selection.has(entry.path)) selection.delete(entry.path);
      else selection.add(entry.path);
      anchor = index;
    } else {
      selection = new Set([entry.path]);
      anchor = index;
    }
    updateSelection();
  }
  function updateSelection() {
    for (const el of content.querySelectorAll("[data-path]"))
      el.classList.toggle("selected", selection.has(el.dataset.path));
    renderDetails();
  }
  function bindEntry(el, entry, index) {
    el.dataset.path = entry.path;
    el.classList.toggle("selected", selection.has(entry.path));
    el.draggable = true;
    el.onclick = (e) => {
      e.stopPropagation();
      select(entry, e, index);
    };
    el.ondblclick = (e) => {
      e.stopPropagation();
      entry.kind === "folder" ? navigate(entry.path) : d.openFile(entry.path);
    };
    el.oncontextmenu = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!selection.has(entry.path)) {
        selection = new Set([entry.path]);
        updateSelection();
      }
      showMenu(contextItems(), e.clientX, e.clientY);
    };
    el.ondragstart = (e) => {
      if (!selection.has(entry.path)) {
        selection = new Set([entry.path]);
        updateSelection();
      }
      e.dataTransfer.setData(
        "application/x-vista-files",
        JSON.stringify([...selection]),
      );
      e.dataTransfer.effectAllowed = "copyMove";
    };
    if (entry.kind === "folder") {
      el.ondragover = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = e.ctrlKey ? "copy" : "move";
      };
      el.ondrop = guard(async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files.length) {
          await fs.importFiles(e.dataTransfer.files, entry.path);
          return;
        }
        const paths = JSON.parse(
          e.dataTransfer.getData("application/x-vista-files") || "[]",
        );
        for (const path of paths)
          fs.move(path, fs.uniquePath(entry.path, basename(path)), e.ctrlKey);
      });
    }
  }
  function renderComputer() {
    const root = h("div", {}),
      section = h(
        "div",
        { class: "computer-section" },
        h("h2", { class: "section-heading" }, "Hard Disk Drives (1)"),
      );
    const used = [...fs.entries.values()].reduce(
      (n, e) =>
        n +
        (e.content instanceof Blob
          ? e.content.size
          : typeof e.content === "string"
            ? e.content.length
            : 0),
      0,
    );
    const drive = button(
      [
        icon("drive", 48),
        h(
          "div",
          { class: "drive-info" },
          h("div", {}, "Local Disk (C:)"),
          h(
            "div",
            { class: "storage-bar" },
            h("span", {
              style: {
                width: Math.max(2, Math.min(100, used / 1048576)) + "%",
              },
            }),
          ),
          h("small", {}, formatBytes(used) + " used · Local browser storage"),
        ),
      ],
      () => navigate("C:/"),
      "drive-tile",
    );
    section.append(drive);
    root.append(section);
    const user = h(
        "div",
        { class: "computer-section" },
        h("h2", { class: "section-heading" }, "Files Stored on This Computer"),
      ),
      shortcuts = h("div", { class: "library-shortcuts" });
    for (const [name, ico, path] of [
      ["User", "user", "C:/Users/User"],
      ["Documents", "documents", "C:/Users/User/Documents"],
      ["Pictures", "pictures", "C:/Users/User/Pictures"],
      ["Music", "music", "C:/Users/User/Music"],
    ])
      shortcuts.append(button([icon(ico, 40), name], () => navigate(path), ""));
    user.append(shortcuts);
    root.append(user);
    content.append(root);
  }
  function renderContent() {
    content.replaceChildren();
    selection = new Set([...selection].filter((p) => fs.exists(p)));
    if (current === "computer" && !query) {
      rows = [];
      renderComputer();
      renderDetails();
      return;
    }
    rows = query
      ? d.settings.get("searchEnabled", true)
        ? fs.search(query, current === "computer" ? "C:/" : current)
        : []
      : fs.list(current);
    rows.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      let result;
      if (sort === "modified") result = a.modified - b.modified;
      else if (sort === "size") result = byteSize(a) - byteSize(b);
      else
        result = a[sort].localeCompare(b[sort], undefined, { numeric: true });
      return result * sortDirection;
    });
    if (!rows.length) {
      content.append(
        h(
          "div",
          { class: "explorer-empty" },
          query
            ? d.settings.get("searchEnabled", true)
              ? "No items match your search."
              : "Windows Search is stopped. Start it in Services to search files."
            : current === "C:/$Recycle.Bin"
              ? "The Recycle Bin is empty."
              : "This folder is empty.",
        ),
      );
      renderDetails();
      return;
    }
    if (view === "details") {
      const table = h("table", { class: "files-list" }),
        head = h("tr", {});
      for (const [label, key] of [
        ["Name", "name"],
        ["Date modified", "modified"],
        ["Type", "kind"],
        ["Size", "size"],
      ])
        head.append(
          h(
            "th",
            {},
            button(
              label + (sort === key ? (sortDirection === 1 ? " ▴" : " ▾") : ""),
              () => {
                sortDirection = sort === key ? -sortDirection : 1;
                sort = key;
                renderContent();
              },
              "",
            ),
          ),
        );
      table.append(h("thead", {}, head));
      const body = h("tbody", {});
      rows.forEach((entry, index) => {
        const tr = h(
          "tr",
          {},
          h("td", {}, icon(fileIcon(entry), 16), entry.name),
          h("td", {}, new Date(entry.modified).toLocaleDateString()),
          h(
            "td",
            {},
            entry.kind === "folder"
              ? "File folder"
              : (extension(entry.name).toUpperCase() || "Unknown") + " File",
          ),
          h(
            "td",
            {},
            entry.kind === "folder" ? "" : formatBytes(byteSize(entry)),
          ),
        );
        bindEntry(tr, entry, index);
        body.append(tr);
      });
      table.append(body);
      content.append(table);
    } else {
      const grid = h("div", { class: "files-grid" });
      rows.forEach((entry, index) => {
        const tile = button(
          [icon(fileIcon(entry), 48), h("span", {}, entry.name)],
          null,
          "file-tile",
        );
        bindEntry(tile, entry, index);
        grid.append(tile);
      });
      content.append(grid);
    }
    renderDetails();
  }
  function renderDetails() {
    const selected = selectedEntries(),
      item = selected[0],
      title =
        selected.length > 1
          ? selected.length + " items selected"
          : item?.name ||
            (current === "computer"
              ? "Computer"
              : basename(current) === "$Recycle.Bin"
                ? "Recycle Bin"
                : basename(current));
    details.replaceChildren(
      icon(
        item
          ? fileIcon(item)
          : current === "computer"
            ? "computer"
            : current === "C:/$Recycle.Bin"
              ? "recycle"
              : "folder",
        40,
      ),
      h(
        "div",
        {},
        h("div", { class: "detail-label" }, title),
        h(
          "div",
          { class: "muted", style: { marginTop: "4px" } },
          selected.length === 1
            ? item.kind === "folder"
              ? "File folder"
              : formatBytes(byteSize(item)) + " · " + (item.mime || "File")
            : current === "computer"
              ? "Browse the files and folders on your computer"
              : rows.length + " items",
        ),
      ),
    );
    status.replaceChildren(
      h(
        "span",
        {},
        selected.length
          ? selected.length + " item(s) selected"
          : rows.length + " item(s)",
      ),
      h("span", { class: "spacer" }),
      h("span", {}, current === "computer" ? "Computer" : prettyPath(current)),
    );
  }
  function render() {
    win.setTitle(
      current === "computer"
        ? "Computer"
        : current === "C:/$Recycle.Bin"
          ? "Recycle Bin"
          : basename(current),
    );
    renderAddress();
    renderSidebar();
    renderBar();
    renderContent();
  }
  content.oncontextmenu = (e) => {
    e.preventDefault();
    showMenu(contextItems(), e.clientX, e.clientY);
  };
  content.onclick = (e) => {
    if (!e.target.closest("[data-path]")) {
      selection.clear();
      updateSelection();
    }
  };
  content.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && key === "a") {
      e.preventDefault();
      selection = new Set(rows.map((e) => e.path));
      updateSelection();
    } else if ((e.ctrlKey || e.metaKey) && key === "c") {
      e.preventDefault();
      copy(false);
    } else if ((e.ctrlKey || e.metaKey) && key === "x") {
      e.preventDefault();
      copy(true);
    } else if ((e.ctrlKey || e.metaKey) && key === "v") {
      e.preventDefault();
      paste();
    } else if (key === "delete") {
      e.preventDefault();
      remove(e.shiftKey);
    } else if (key === "f2") {
      e.preventDefault();
      rename();
    } else if (key === "enter") {
      e.preventDefault();
      openSelected();
    } else if (e.altKey && key === "arrowup") {
      e.preventDefault();
      navigate(
        current === "computer"
          ? "computer"
          : current === "C:/"
            ? "computer"
            : dirname(current),
      );
    } else if (
      ["arrowdown", "arrowup", "arrowleft", "arrowright"].includes(key)
    ) {
      e.preventDefault();
      let i = rows.findIndex((e) => selection.has(e.path));
      i = Math.max(
        0,
        Math.min(
          rows.length - 1,
          i + (["arrowdown", "arrowright"].includes(key) ? 1 : -1),
        ),
      );
      if (rows[i]) {
        selection = new Set([rows[i].path]);
        updateSelection();
        content
          .querySelector("[data-path].selected")
          ?.scrollIntoView({ block: "nearest" });
      }
    }
  });
  content.ondragover = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  content.ondrop = guard(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const target = current === "computer" ? "C:/Users/User/Desktop" : current;
    if (e.dataTransfer.files.length) {
      await fs.importFiles(e.dataTransfer.files, target);
      return;
    }
    const paths = JSON.parse(
      e.dataTransfer.getData("application/x-vista-files") || "[]",
    );
    for (const path of paths)
      fs.move(path, fs.uniquePath(target, basename(path)), e.ctrlKey);
  });
  d.settings.on(
    "change",
    ({ key }) => {
      if (key === "searchEnabled") renderContent();
    },
    win.signal,
  );
  search.oninput = () => {
    query = search.value.trim();
    renderContent();
  };
  win.el.addEventListener("keydown", (e) => {
    if (e.key === "F5") {
      e.preventDefault();
      render();
    }
    if (e.altKey && e.key === "ArrowLeft") {
      e.preventDefault();
      goHistory(-1);
    }
    if (e.altKey && e.key === "ArrowRight") {
      e.preventDefault();
      goHistory(1);
    }
  });
  fs.on(
    "change",
    () => {
      if (current !== "computer" && !fs.exists(current)) {
        navigate("computer");
        return;
      }
      renderContent();
    },
    win.signal,
  );
  render();
  return win;
}
function byteSize(entry) {
  return entry.content instanceof Blob
    ? entry.content.size
    : typeof entry.content === "string"
      ? new Blob([entry.content]).size
      : 0;
}
export async function showProperties(d, entry) {
  if (!entry) return;
  const total =
    entry.kind === "folder"
      ? [...d.fs.entries.values()]
          .filter((e) => e.path.startsWith(entry.path + "/"))
          .reduce((n, e) => n + byteSize(e), 0)
      : byteSize(entry);
  const body = h(
    "div",
    {},
    h(
      "div",
      { class: "dialog-message", style: { alignItems: "center" } },
      icon(fileIcon(entry), 48),
      h("strong", {}, entry.name),
    ),
    h("hr", {
      style: { border: 0, borderTop: "1px solid #ddd", margin: "15px 0" },
    }),
    h(
      "dl",
      { class: "system-summary" },
      h("dt", {}, "Type:"),
      h(
        "dd",
        {},
        entry.kind === "folder" ? "File folder" : entry.mime || "File",
      ),
      h("dt", {}, "Location:"),
      h("dd", {}, prettyPath(dirname(entry.path))),
      h("dt", {}, "Size:"),
      h("dd", {}, formatBytes(total)),
      h("dt", {}, "Created:"),
      h("dd", {}, new Date(entry.created).toLocaleString()),
      h("dt", {}, "Modified:"),
      h("dd", {}, new Date(entry.modified).toLocaleString()),
      ...(entry.originalPath
        ? [
            h("dt", {}, "Original location:"),
            h("dd", {}, prettyPath(entry.originalPath)),
          ]
        : []),
    ),
  );
  return d.dialog.form({
    title: entry.name + " Properties",
    width: 465,
    body,
    buttons: [{ label: "OK", value: true, primary: true }],
  });
}
