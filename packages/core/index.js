/** Platform-neutral services shared by all Vista applications. */
export class EventBus {
  #listeners = new Map();
  on(type, fn, signal) {
    if (signal?.aborted) return () => {};
    if (!this.#listeners.has(type)) this.#listeners.set(type, new Set());
    this.#listeners.get(type).add(fn);
    const off = () => this.#listeners.get(type)?.delete(fn);
    signal?.addEventListener("abort", off, { once: true });
    return off;
  }
  emit(type, value) {
    for (const fn of [...(this.#listeners.get(type) || [])]) fn(value);
  }
}
export class Settings extends EventBus {
  constructor(storage = globalThis.localStorage) {
    super();
    this.storage = storage;
    try {
      this.data = JSON.parse(storage?.getItem("vista.settings.v1") || "{}");
    } catch {
      this.data = {};
    }
  }
  get(key, fallback) {
    return this.data[key] ?? fallback;
  }
  set(key, value) {
    this.data[key] = value;
    try {
      this.storage?.setItem("vista.settings.v1", JSON.stringify(this.data));
    } catch {}
    this.emit("change", { key, value });
  }
}
export function normalizePath(path = "C:/") {
  path = String(path).replaceAll("\\", "/");
  if (!/^[a-z]:/i.test(path)) path = `C:/${path}`;
  const segments = [];
  for (const segment of path.slice(2).split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") segments.pop();
    else segments.push(segment);
  }
  return `${path[0].toUpperCase()}:/${segments.join("/")}`;
}
export function dirname(path) {
  const p = normalizePath(path);
  const n = p.lastIndexOf("/");
  return n <= 2 ? p.slice(0, 3) : p.slice(0, n);
}
export const basename = (path) =>
  normalizePath(path).split("/").pop() || "Local Disk (C:)";
export const extension = (path) =>
  basename(path).includes(".")
    ? basename(path).split(".").pop().toLowerCase()
    : "";
export function resolvePath(input, cwd = "C:/") {
  const value = String(input).replaceAll("\\", "/");
  if (/^[a-z]:\//i.test(value) || /^[a-z]:$/i.test(value))
    return normalizePath(value);
  if (/^[a-z]:/i.test(value))
    return normalizePath(
      (value.slice(0, 2).toLowerCase() === cwd.slice(0, 2).toLowerCase()
        ? cwd
        : value.slice(0, 2) + "/") +
        "/" +
        value.slice(2),
    );
  if (value.startsWith("/")) return normalizePath(cwd.slice(0, 2) + value);
  return normalizePath(cwd + "/" + value);
}
export const joinPath = (parent, child) => resolvePath(child, parent);
export const prettyPath = (path) => normalizePath(path).replaceAll("/", "\\");
export const formatBytes = (bytes) =>
  bytes < 1024
    ? `${bytes} bytes`
    : bytes < 1048576
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / 1048576).toFixed(1)} MB`;

/** Case-insensitive VFS. IndexedDB transactions persist metadata and Blob content together. */
export class VirtualFileSystem extends EventBus {
  constructor() {
    super();
    this.entries = new Map();
    this.db = null;
    this.revision = 0;
    this.queue = Promise.resolve();
    this.lastError = null;
  }
  key(path) {
    return normalizePath(path).toLowerCase();
  }
  async init() {
    if (globalThis.indexedDB)
      try {
        this.db = await new Promise((resolve, reject) => {
          const r = indexedDB.open("vista-desktop", 1);
          r.onupgradeneeded = () =>
            r.result.createObjectStore("entries", { keyPath: "key" });
          r.onerror = () => reject(r.error);
          r.onsuccess = () => resolve(r.result);
        });
        const rows = await new Promise((resolve, reject) => {
          const r = this.db
            .transaction("entries")
            .objectStore("entries")
            .getAll();
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
        });
        for (const row of rows) this.entries.set(row.key, row);
      } catch (error) {
        this.lastError = error;
      }
    if (!this.entries.size) {
      this.seed();
      await this.flush();
    }
    return this;
  }
  seed() {
    const now = Date.now();
    const add = (path, kind = "folder", content = "", mime = "text/plain") => {
      path = normalizePath(path);
      this.entries.set(this.key(path), {
        id: crypto.randomUUID(),
        key: this.key(path),
        path,
        name: basename(path),
        kind,
        content,
        mime,
        created: now,
        modified: now,
      });
    };
    for (const p of [
      "C:/",
      "C:/Users",
      "C:/Users/User",
      "C:/Users/User/Desktop",
      "C:/Users/User/Documents",
      "C:/Users/User/Pictures",
      "C:/Users/User/Music",
      "C:/Users/User/Videos",
      "C:/Users/User/Downloads",
      "C:/Users/User/Contacts",
      "C:/Windows",
      "C:/Windows/System32",
      "C:/Program Files",
      "C:/$Recycle.Bin",
    ])
      add(p);
    add(
      "C:/Users/User/Documents/Welcome.txt",
      "file",
      "Welcome to Windows Vista\r\n\r\nYour desktop is ready.\r\n\r\nOpen the Start menu to find your programs.\r\nUse Computer to browse, create, import, and organize your files.\r\nSave documents from Notepad, WordPad, and Paint into Documents.\r\nChange your desktop in Control Panel > Personalization.\r\nYour files and settings stay in this browser on this device.\r\n\r\nKeyboard shortcuts\r\nCtrl+Esc: Start menu\r\nAlt+Tab: Switch windows (if allowed by your browser)\r\nF2: Rename selected file\r\nCtrl+S: Save the current document\r\nCtrl+Shift+Esc: Task Manager\r\n\r\nThis browser recreation does not execute native Windows programs.",
    );
    add(
      "C:/Users/User/Documents/Shopping list.txt",
      "file",
      "Groceries\r\n========\r\nMilk\r\nBread\r\nCoffee\r\nApples\r\n\r\nRemember to bring the reusable bags.\r\n",
    );
    add(
      "C:/Users/User/Documents/Getting started.html",
      "file",
      "<h1>Getting started</h1><p>A familiar place for your ideas.</p><p>Open <strong>WordPad</strong> to write and format a document, then save it here.</p>",
      "text/html",
    );
    for (const [name, asset] of [
      ["Windows Vista", "/assets/wallpaper.jpg"],
      ["Mountain lake", "/assets/lake.jpg"],
      ["Landscape", "/assets/forest.jpg"],
    ])
      add(
        `C:/Users/User/Pictures/${name}.jpg`,
        "file",
        asset,
        "image/x-vista-asset",
      );
  }
  stat(path) {
    return this.entries.get(this.key(path)) || null;
  }
  byId(id) {
    return [...this.entries.values()].find((e) => e.id === id) || null;
  }
  exists(path) {
    return !!this.stat(path);
  }
  list(path) {
    const parent = this.key(path),
      prefix = parent.endsWith("/") ? parent : parent + "/";
    return [...this.entries.values()]
      .filter(
        (e) =>
          e.key.startsWith(prefix) &&
          !e.key.slice(prefix.length).includes("/") &&
          e.key !== parent,
      )
      .sort(
        (a, b) =>
          (a.kind === b.kind ? 0 : a.kind === "folder" ? -1 : 1) ||
          a.name.localeCompare(b.name, undefined, { numeric: true }),
      );
  }
  search(query, root = "C:/Users/User") {
    const q = query.trim().toLowerCase(),
      prefix = this.key(root),
      boundary = prefix.endsWith("/") ? prefix : prefix + "/";
    return [...this.entries.values()]
      .filter(
        (e) =>
          (e.key === prefix || e.key.startsWith(boundary)) &&
          e.name.toLowerCase().includes(q),
      )
      .slice(0, 200);
  }
  read(path) {
    const e = this.stat(path);
    if (!e || e.kind !== "file")
      throw new Error(`File not found: ${prettyPath(path)}`);
    return e.content;
  }
  validateName(name) {
    if (
      !name ||
      /[<>:"/\\|?*\x00-\x1f]/.test(name) ||
      /^\.+$/.test(name) ||
      /[. ]$/.test(name)
    )
      throw new Error(
        'A file name cannot contain these characters: \\ / : * ? " < > |',
      );
  }
  mkdir(path) {
    path = normalizePath(path);
    if (this.exists(path))
      throw new Error("A file or folder with this name already exists.");
    this.validateName(basename(path));
    if (this.stat(dirname(path))?.kind !== "folder")
      throw new Error("The destination folder does not exist.");
    const now = Date.now();
    this.entries.set(this.key(path), {
      id: crypto.randomUUID(),
      key: this.key(path),
      path,
      name: basename(path),
      kind: "folder",
      created: now,
      modified: now,
    });
    this.changed();
    return this.stat(path);
  }
  write(path, content, mime = "text/plain") {
    path = normalizePath(path);
    this.validateName(basename(path));
    if (this.stat(dirname(path))?.kind !== "folder")
      throw new Error("The destination folder does not exist.");
    const old = this.stat(path);
    if (old?.kind === "folder") throw new Error("The destination is a folder.");
    const now = Date.now();
    this.entries.set(this.key(path), {
      id: old?.id || crypto.randomUUID(),
      key: this.key(path),
      path,
      name: basename(path),
      kind: "file",
      content,
      mime,
      created: old?.created || now,
      modified: now,
    });
    this.changed();
    return this.stat(path);
  }
  uniquePath(parent, name) {
    if (!this.exists(joinPath(parent, name))) return joinPath(parent, name);
    const dot = name.lastIndexOf("."),
      stem = dot > 0 ? name.slice(0, dot) : name,
      suffix = dot > 0 ? name.slice(dot) : "";
    for (let n = 2; ; n++) {
      const p = joinPath(parent, `${stem} (${n})${suffix}`);
      if (!this.exists(p)) return p;
    }
  }
  move(source, target, copy = false) {
    source = normalizePath(source);
    target = normalizePath(target);
    const entry = this.stat(source),
      from = this.key(source),
      to = this.key(target);
    if (!entry) throw new Error("The source does not exist.");
    if (
      source === "C:/" ||
      /^C:\/(Users|Windows|Program Files|\$Recycle\.Bin)$/i.test(source)
    )
      throw new Error("This system folder cannot be moved.");
    if (from === to) {
      if (source === target) return entry;
    } else if (this.exists(target))
      throw new Error("A file with that name already exists.");
    if (to.startsWith(from + "/"))
      throw new Error("A folder cannot be placed inside itself.");
    if (this.stat(dirname(target))?.kind !== "folder")
      throw new Error("The destination folder does not exist.");
    this.validateName(basename(target));
    const rows = [...this.entries.values()].filter(
      (e) => e.key === from || e.key.startsWith(from + "/"),
    );
    const next = rows.map((e) => {
      const path = target + e.path.slice(source.length);
      return {
        ...e,
        id: copy ? crypto.randomUUID() : e.id,
        key: this.key(path),
        path,
        name: basename(path),
        modified: Date.now(),
      };
    });
    if (!copy) for (const e of rows) this.entries.delete(e.key);
    for (const e of next) this.entries.set(e.key, e);
    this.changed();
    return this.stat(target);
  }
  remove(path, permanent = false) {
    const e = this.stat(path);
    if (!e) return;
    if (
      normalizePath(path) === "C:/" ||
      /^C:\/(Users|Windows|Program Files|\$Recycle\.Bin)$/i.test(e.path)
    )
      throw new Error("This system folder cannot be deleted.");
    if (!permanent && !e.key.startsWith("c:/$recycle.bin/")) {
      const target = this.uniquePath("C:/$Recycle.Bin", e.name);
      this.move(e.path, target);
      this.stat(target).originalPath = e.path;
      this.changed();
      return;
    }
    for (const key of [...this.entries.keys()])
      if (key === e.key || key.startsWith(e.key + "/"))
        this.entries.delete(key);
    this.changed();
  }
  restore(path) {
    const e = this.stat(path);
    if (!e?.originalPath) throw new Error("This item has no restore location.");
    const parent =
      this.stat(dirname(e.originalPath))?.kind === "folder"
        ? dirname(e.originalPath)
        : "C:/Users/User/Documents";
    const target = this.uniquePath(parent, basename(e.originalPath));
    this.move(path, target);
    delete this.stat(target).originalPath;
    this.changed();
    return target;
  }
  transaction(fn) {
    if (this.batchDepth) return fn();
    const previous = new Map(
      [...this.entries].map(([key, value]) => [key, { ...value }]),
    );
    this.batchDepth = 1;
    this.batchChanged = false;
    try {
      const result = fn();
      if (result && typeof result.then === "function")
        throw new Error("File transactions must be synchronous.");
      this.batchDepth = 0;
      if (this.batchChanged) this.changed();
      return result;
    } catch (error) {
      this.entries = previous;
      this.batchDepth = 0;
      this.batchChanged = false;
      throw error;
    }
  }
  changed() {
    if (this.batchDepth) {
      this.batchChanged = true;
      return;
    }
    this.revision++;
    this.emit("change", { revision: this.revision });
    this.flush().catch((error) => {
      this.lastError = error;
      this.emit("error", error);
    });
  }
  flush() {
    if (!this.db) return Promise.resolve();
    const rows = [...this.entries.values()].map((e) => ({ ...e }));
    this.queue = this.queue
      .catch(() => {})
      .then(
        () =>
          new Promise((resolve, reject) => {
            const tx = this.db.transaction("entries", "readwrite"),
              store = tx.objectStore("entries");
            store.clear();
            for (const row of rows) store.put(row);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
          }),
      );
    return this.queue;
  }
  async importFiles(files, destination) {
    const added = [];
    for (const file of files) {
      const path = this.uniquePath(
        destination,
        file.name.replace(/[<>:"/\\|?*]/g, "_"),
      );
      if (
        file.type.startsWith("text/") ||
        /\.(txt|md|json|csv|html|css|js|xml|log|bat|ini)$/i.test(file.name)
      )
        this.write(path, await file.text(), file.type || "text/plain");
      else this.write(path, file, file.type || "application/octet-stream");
      added.push(path);
    }
    await this.flush();
    return added;
  }
  async exportBlob(path) {
    const e = this.stat(path);
    if (!e || e.kind !== "file") throw new Error("Select a file to download.");
    if (e.content instanceof Blob) return e.content;
    if (e.mime === "image/x-vista-asset")
      return (await fetch(e.content)).blob();
    return new Blob([e.content || ""], {
      type: e.mime || "application/octet-stream",
    });
  }
  async backup() {
    const rows = [];
    for (const e of this.entries.values()) {
      if (e.content instanceof Blob) {
        const bytes = new Uint8Array(await e.content.arrayBuffer());
        let str = "";
        for (const byte of bytes) str += String.fromCharCode(byte);
        rows.push({ ...e, content: btoa(str), encoding: "base64" });
      } else rows.push(e);
    }
    return new Blob(
      [
        JSON.stringify(
          { format: "vista-vfs", version: 1, entries: rows },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
  }
  async restoreBackup(blob) {
    const data = JSON.parse(await blob.text());
    if (
      data.format !== "vista-vfs" ||
      data.version !== 1 ||
      !Array.isArray(data.entries)
    )
      throw new Error("This is not a Vista desktop backup.");
    const restored = new Map();
    for (const row of data.entries) {
      if (
        !row ||
        typeof row.path !== "string" ||
        !["file", "folder"].includes(row.kind)
      )
        throw new Error("Invalid file entry.");
      const path = normalizePath(row.path),
        entry = {
          ...row,
          path,
          key: this.key(path),
          name: basename(path),
          id: row.id || crypto.randomUUID(),
        };
      if (row.encoding === "base64") {
        entry.content = new Blob(
          [Uint8Array.from(atob(row.content), (c) => c.charCodeAt(0))],
          { type: row.mime },
        );
        delete entry.encoding;
      }
      restored.set(entry.key, entry);
    }
    if (restored.get("c:/")?.kind !== "folder")
      throw new Error("The backup has no root folder.");
    for (const e of restored.values())
      if (
        e.key !== "c:/" &&
        restored.get(this.key(dirname(e.path)))?.kind !== "folder"
      )
        throw new Error("The backup contains an orphaned file.");
    this.entries = restored;
    this.changed();
    await this.flush();
  }
}
export class ClipboardService extends EventBus {
  constructor() {
    super();
    this.files = [];
    this.cut = false;
  }
  setFiles(paths, cut = false) {
    this.files = [...paths];
    this.cut = cut;
    this.emit("change");
  }
  paste(fs, destination) {
    const unique = [...new Set(this.files)].filter((path) => fs.exists(path));
    const roots = unique.filter(
      (path) =>
        !unique.some(
          (other) =>
            fs.key(path) !== fs.key(other) &&
            fs.key(path).startsWith(fs.key(other) + "/"),
        ),
    );
    const results = fs.transaction(() => {
      const copied = [];
      for (const path of roots) {
        const e = fs.stat(path);
        if (!e) continue;
        if (this.cut && fs.key(dirname(path)) === fs.key(destination)) {
          copied.push(path);
          continue;
        }
        const target = fs.uniquePath(destination, e.name);
        copied.push(fs.move(path, target, !this.cut).path);
      }
      return copied;
    });
    if (this.cut) this.setFiles([]);
    return results;
  }
}
export class UndoStack {
  constructor(limit = 60) {
    this.limit = limit;
    this.past = [];
    this.future = [];
  }
  push(state) {
    this.past.push(state);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  undo(current) {
    if (!this.past.length) return null;
    this.future.push(current);
    return this.past.pop();
  }
  redo(current) {
    if (!this.future.length) return null;
    this.past.push(current);
    return this.future.pop();
  }
}
export function downloadBlob(blob, name) {
  const a = document.createElement("a"),
    url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function contentURL(entry) {
  if (entry.content instanceof Blob)
    return { url: URL.createObjectURL(entry.content), release: true };
  if (entry.mime === "image/x-vista-asset")
    return { url: entry.content, release: false };
  return {
    url:
      "data:" +
      (entry.mime || "text/plain") +
      ";charset=utf-8," +
      encodeURIComponent(entry.content || ""),
    release: false,
  };
}
