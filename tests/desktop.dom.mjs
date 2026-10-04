/** DOM integration tests. Canvas, layout and device permissions are mocked;
 * these tests do not establish visual fidelity or browser/GPU compatibility. */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { createDesktop, APPLICATIONS } from "../packages/shell/index.js";

let window, desktop;
const timers = new Set();
const realInterval = globalThis.setInterval;
const settle = () => new Promise((resolve) => setTimeout(resolve, 15));
function clickText(root, text) {
  const match = [...root.querySelectorAll("button")].find(
    (b) => b.textContent.trim() === text,
  );
  assert.ok(match, `Button ${text} exists`);
  match.click();
  return match;
}
before(async () => {
  window = new Window({
    url: "https://vista.test/",
    width: 1366,
    height: 768,
    settings: {
      disableCSSFileLoading: true,
      disableJavaScriptFileLoading: true,
    },
  });
  for (const name of [
    "window",
    "document",
    "navigator",
    "Node",
    "HTMLElement",
    "HTMLCanvasElement",
    "HTMLMediaElement",
    "Event",
    "KeyboardEvent",
    "CustomEvent",
    "MouseEvent",
    "DOMParser",
    "FileReader",
    "localStorage",
    "getSelection",
  ]) {
    const value =
      name === "window"
        ? window
        : name === "getSelection"
          ? window.getSelection.bind(window)
          : window[name];
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  }
  globalThis.innerWidth = 1366;
  globalThis.innerHeight = 768;
  globalThis.devicePixelRatio = 1;
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  globalThis.setInterval = (fn, delay) => {
    const timer = realInterval(fn, delay);
    timers.add(timer);
    return timer;
  };
  globalThis.Image = class {
    constructor() {
      this.naturalWidth = this.width = 1920;
      this.naturalHeight = this.height = 1200;
    }
    decode() {
      return Promise.resolve();
    }
  };
  globalThis.Audio = class {
    addEventListener() {}
    play() {
      return Promise.resolve();
    }
    pause() {}
  };
  globalThis.ImageData = class {
    constructor(data, width, height) {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  };
  Object.defineProperties(window.HTMLElement.prototype, {
    clientWidth: {
      get() {
        return parseFloat(this.style.width) || 1366;
      },
    },
    clientHeight: {
      get() {
        return parseFloat(this.style.height) || 734;
      },
    },
  });
  const gradient = { addColorStop() {} };
  const context = new Proxy(
    {
      getImageData(x, y, w, h) {
        return new ImageData(new Uint8ClampedArray(w * h * 4), w, h);
      },
      createRadialGradient() {
        return gradient;
      },
      createLinearGradient() {
        return gradient;
      },
      measureText() {
        return { width: 20 };
      },
    },
    {
      get(target, key) {
        return key in target ? target[key] : () => {};
      },
      set(target, key, value) {
        target[key] = value;
        return true;
      },
    },
  );
  window.HTMLCanvasElement.prototype.getContext = function (type) {
    return type === "2d" ? context : null;
  };
  window.HTMLCanvasElement.prototype.toBlob = function (callback, type) {
    callback(new Blob(["test image"], { type }));
  };
  window.HTMLMediaElement.prototype.pause = function () {};
  window.HTMLMediaElement.prototype.load = function () {};
  window.localStorage.setItem(
    "vista.settings.v1",
    JSON.stringify({
      showWelcome: false,
      sidebar: false,
      renderer: "canvas2d",
    }),
  );
  const root = window.document.createElement("main");
  window.document.body.append(root);
  desktop = await createDesktop(root);
});
after(async () => {
  desktop?.dispose();
  for (const timer of timers) clearInterval(timer);
  globalThis.setInterval = realInterval;
  await window.happyDOM.abort();
});

test("Every registered application opens a populated window and cleans up", async () => {
  for (const app of APPLICATIONS) {
    const win = await desktop.open(app.id);
    await settle();
    assert.ok(win, `${app.name} launched`);
    assert.equal(win.appId, app.id, `${app.name} returns its own window`);
    assert.ok(win.body.childElementCount, `${app.name} has content`);
    await win.forceClose();
    assert.ok(!win.el.isConnected, `${app.name} closes`);
  }
  assert.equal(desktop.wm.windows.length, 0);
});
test("Owned dialogs block their parent and restore focus on cancellation", async () => {
  const win = await desktop.open("notepad");
  const editor = win.body.querySelector("textarea");
  editor.focus();
  const pending = desktop.dialog.prompt("Test prompt", "Value:", "before");
  await settle();
  assert.equal(win.el.inert, true);
  const modal = desktop.wm.windows.find((w) => w.modal);
  assert.ok(modal);
  assert.equal(modal.owner, win);
  await modal.forceClose();
  assert.equal(await pending, null);
  assert.equal(win.el.inert, false);
  assert.equal(desktop.wm.active, win);
  await win.forceClose();
});
test("Notepad saves a snapshot, preserves edits during flush, and reopens saved text", async () => {
  const win = await desktop.open("notepad", {
      path: "C:/Users/User/Documents/Welcome.txt",
    }),
    editor = win.body.querySelector("textarea");
  editor.value = "Saved snapshot";
  editor.dispatchEvent(new Event("input", { bubbles: true }));
  const originalFlush = desktop.fs.flush;
  let finish;
  desktop.fs.flush = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  editor.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "s",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }),
  );
  await settle();
  editor.value = "New edit while saving";
  editor.dispatchEvent(new Event("input", { bubbles: true }));
  finish();
  await settle();
  desktop.fs.flush = originalFlush;
  assert.equal(
    desktop.fs.read("C:/Users/User/Documents/Welcome.txt"),
    "Saved snapshot",
  );
  assert.equal(win.dirty, true);
  await win.forceClose();
  const reopened = await desktop.open("notepad", {
    path: "C:/Users/User/Documents/Welcome.txt",
  });
  assert.equal(reopened.body.querySelector("textarea").value, "Saved snapshot");
  await reopened.forceClose();
});
test("Keyboard shortcuts open Start and Task Manager separately; lock suppresses launches", async () => {
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }),
  );
  assert.ok(desktop.start);
  desktop.closeStart();
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    }),
  );
  await settle();
  assert.ok(desktop.wm.windows.some((w) => w.appId === "taskmanager"));
  await desktop.session("lock");
  assert.equal(desktop.sessionActive, true);
  assert.equal(await desktop.open("calculator"), null);
  clickText(desktop.host.querySelector(".session-overlay"), "Unlock");
  assert.equal(desktop.sessionActive, false);
  for (const win of [...desktop.wm.windows]) await win.forceClose();
});

test("Save dialogs confirm the normalized destination before overwriting", async () => {
  const owner = await desktop.open("paint");
  desktop.fs.write("C:/Users/User/Pictures/drawing.png", "original");
  const pending = desktop.dialog.file({
    mode: "save",
    path: "C:/Users/User/Pictures",
    name: "drawing.jpg",
    normalizeTarget: (path) => path.replace(/\.jpg$/i, ".png"),
  });
  await settle();
  clickText(desktop.wm.active.body, "Save");
  await settle();
  assert.equal(desktop.wm.active.title, "Confirm Save As");
  assert.match(desktop.wm.active.body.textContent, /drawing\.png/);
  assert.equal(owner.el.inert, true);
  clickText(desktop.wm.active.body, "Yes");
  assert.equal(await pending, "C:/Users/User/Pictures/drawing.png");
  await owner.forceClose();
});

test("WordPad preserves new edits made while a save flush is pending", async () => {
  const win = await desktop.open("wordpad", {
      path: "C:/Users/User/Documents/Getting started.html",
    }),
    editor = win.body.querySelector("[contenteditable]");
  editor.innerHTML = "<p>First revision</p>";
  editor.dispatchEvent(new Event("input", { bubbles: true }));
  const originalFlush = desktop.fs.flush;
  let finish;
  desktop.fs.flush = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  editor.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "s",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }),
  );
  await settle();
  editor.innerHTML = "<p>Second revision</p>";
  editor.dispatchEvent(new Event("input", { bubbles: true }));
  finish();
  await settle();
  desktop.fs.flush = originalFlush;
  assert.equal(win.dirty, true);
  assert.equal(
    desktop.fs.read("C:/Users/User/Documents/Getting started.html"),
    "<p>First revision</p>",
  );
  await win.forceClose();
});

test("Task Scheduler executes a due one-time task and records completion", async () => {
  desktop.settings.set("scheduledTasks", [
    {
      id: "test-task",
      name: "Open calculator",
      app: "calculator",
      enabled: true,
      next: Date.now() - 1,
      interval: 0,
      last: null,
    },
  ]);
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.ok(desktop.wm.windows.some((w) => w.appId === "calculator"));
  const task = desktop.settings.get("scheduledTasks")[0];
  assert.equal(task.enabled, false);
  assert.ok(task.last > 0);
  desktop.settings.set("scheduledTasks", []);
  for (const win of [...desktop.wm.windows]) await win.forceClose();
});
