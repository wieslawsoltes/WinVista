import {
  basename,
  dirname,
  joinPath,
  normalizePath,
  resolvePath,
  prettyPath,
  extension,
  UndoStack,
  downloadBlob,
  contentURL,
} from "../core/index.js";
import {
  h,
  icon,
  button,
  tool,
  field,
  menuBar,
  statusBar,
  chooseFiles,
  DialogService,
} from "../ui/index.js";
import {
  CalculatorEngine,
  floodFill,
  tokenizeCommand,
  splitCommands,
  encodeRTF,
  decodeRTF,
} from "./engines.js";

export function launch(d, id, args = {}) {
  if (id === "notepad") return notepad(d, args);
  if (id === "wordpad") return wordpad(d, args);
  if (id === "paint" || id === "journal")
    return paint(d, { ...args, journal: id === "journal" });
  if (id === "calculator") return calculator(d);
  if (id === "terminal") return terminal(d);
  if (id === "charactermap") return characterMap(d);
  if (id === "snipping") return snipping(d);
}
async function confirmDirty(d, win, save) {
  if (!win.dirty) return true;
  const choice = await d.dialog.message(
    win.title,
    "Do you want to save changes to this document?",
    {
      buttons: [
        { label: "Save", value: "save", primary: true },
        { label: "Don't Save", value: "discard" },
        { label: "Cancel", value: null },
      ],
    },
  );
  if (choice === "save") return !!(await save()) && !win.dirty;
  return choice === "discard";
}

export async function notepad(d, args = {}) {
  const win = d.wm.create({
      title: "Untitled - Notepad",
      icon: "notepad",
      appId: "notepad",
      width: 660,
      height: 460,
      remember: true,
    }),
    editor = h("textarea", {
      class: "notepad-editor",
      spellcheck: "false",
      "aria-label": "Notepad document",
    }),
    status = statusBar(h("span", {}, "Ln 1, Col 1"), h("span", {}, "UTF-8"));
  let path = null,
    fileId = null,
    baseline = "",
    newline = "\r\n",
    wrap = d.settings.get("notepadWrap", false),
    undo = new UndoStack(150),
    previous = "",
    generation = 0;
  const dirty = () => {
    win.dirty = editor.value !== baseline;
    win.setTitle(
      (win.dirty ? "*" : "") +
        (path ? basename(path) : "Untitled") +
        " - Notepad",
    );
  };
  const updateStatus = () => {
    const text = editor.value.slice(0, editor.selectionStart),
      line = text.split("\n").length,
      column = text.length - (text.lastIndexOf("\n") + 1) + 1;
    status.firstChild.textContent = `Ln ${line}, Col ${column}`;
  };
  const apply = () => {
    editor.classList.toggle("wrap", wrap);
    editor.style.fontFamily = d.settings.get(
      "notepadFont",
      "Consolas, monospace",
    );
    editor.style.fontSize = d.settings.get("notepadSize", 14) + "px";
  };
  const load = async (file) => {
    const token = ++generation;
    let content = d.fs.read(file);
    if (content instanceof Blob) content = await content.text();
    if (win.closed || token !== generation) return;
    path = file;
    fileId = d.fs.stat(file).id;
    newline = String(content).includes("\r\n") ? "\r\n" : "\n";
    editor.value = String(content).replaceAll("\r\n", "\n");
    baseline = previous = editor.value;
    undo = new UndoStack(150);
    dirty();
    updateStatus();
  };
  const save = async (as = false) => {
    try {
      if (fileId && !as) {
        const current = d.fs.byId(fileId);
        if (current) path = current.path;
      }
      let target = path;
      if (!target || as)
        target = await d.dialog.file({
          mode: "save",
          path: path ? dirname(path) : "C:/Users/User/Documents",
          name: path ? basename(path) : "Untitled.txt",
          types: "Text Documents (*.txt)",
        });
      if (!target) return false;
      const saved = editor.value,
        token = generation;
      const file = d.fs.write(
        target,
        saved.replaceAll("\n", newline),
        "text/plain",
      );
      await d.fs.flush();
      if (win.closed || token !== generation) return false;
      path = target;
      fileId = file.id;
      baseline = saved;
      dirty();
      return true;
    } catch (e) {
      d.dialog.error(e);
      return false;
    }
  };
  const open = async () => {
    if (!(await confirmDirty(d, win, () => save()))) return;
    const selected = await d.dialog.file({
      mode: "open",
      path: path ? dirname(path) : "C:/Users/User/Documents",
    });
    if (selected)
      try {
        await load(selected);
      } catch (e) {
        d.dialog.error(e);
      }
  };
  const fresh = async () => {
    if (!(await confirmDirty(d, win, () => save()))) return;
    generation++;
    path = null;
    fileId = null;
    editor.value = "";
    baseline = previous = "";
    undo = new UndoStack(150);
    dirty();
  };
  const replaceSelection = (text) => {
    undo.push({
      text: editor.value,
      start: editor.selectionStart,
      end: editor.selectionEnd,
    });
    editor.setRangeText(
      text,
      editor.selectionStart,
      editor.selectionEnd,
      "end",
    );
    previous = editor.value;
    dirty();
    updateStatus();
    editor.focus();
  };
  const doUndo = (redo) => {
    const state = {
        text: editor.value,
        start: editor.selectionStart,
        end: editor.selectionEnd,
      },
      next = redo ? undo.redo(state) : undo.undo(state);
    if (next) {
      editor.value = next.text;
      editor.setSelectionRange(next.start, next.end);
      previous = editor.value;
      dirty();
      updateStatus();
      editor.focus();
    }
  };
  const clipboard = async (action) => {
    try {
      if (action === "paste") {
        replaceSelection(await navigator.clipboard.readText());
        return;
      }
      const text = editor.value.slice(
        editor.selectionStart,
        editor.selectionEnd,
      );
      await navigator.clipboard.writeText(text);
      if (action === "cut") replaceSelection("");
    } catch {
      d.dialog.message(
        "Clipboard",
        "Use your keyboard to copy and paste text: Ctrl+C, Ctrl+X, and Ctrl+V.",
      );
    }
  };
  let lastFind = "";
  const find = async (replace) => {
    const needle = h("input", {
        class: "vista-input",
        value: lastFind,
        "aria-label": "Find what",
      }),
      replacement = h("input", {
        class: "vista-input",
        "aria-label": "Replace with",
      }),
      match = h("input", { type: "checkbox" }),
      body = h(
        "div",
        {},
        field("Find what:", needle),
        replace ? field("Replace with:", replacement) : null,
        h("label", {}, match, " Match case"),
      );
    const run = (all = false) => {
      const value = needle.value;
      if (!value) return DialogService.KEEP_OPEN;
      lastFind = value;
      const hay = match.checked ? editor.value : editor.value.toLowerCase(),
        n = match.checked ? value : value.toLowerCase();
      if (all) {
        let cursor = 0,
          index,
          result = "";
        while ((index = hay.indexOf(n, cursor)) >= 0) {
          result += editor.value.slice(cursor, index) + replacement.value;
          cursor = index + value.length;
        }
        result += editor.value.slice(cursor);
        undo.push({ text: editor.value, start: 0, end: 0 });
        editor.value = result;
        previous = result;
        dirty();
        return true;
      }
      let index = hay.indexOf(n, editor.selectionEnd);
      if (index < 0) index = hay.indexOf(n);
      if (index < 0) {
        d.dialog.message("Notepad", `Cannot find “${value}”.`);
        return DialogService.KEEP_OPEN;
      }
      if (
        replace &&
        editor.value
          .slice(editor.selectionStart, editor.selectionEnd)
          .toLowerCase() === value.toLowerCase()
      ) {
        replaceSelection(replacement.value);
        return true;
      }
      editor.focus();
      editor.setSelectionRange(index, index + value.length);
      updateStatus();
      return true;
    };
    await d.dialog.form({
      title: replace ? "Replace" : "Find",
      width: 400,
      body,
      focus: needle,
      buttons: [
        {
          label: replace ? "Find / Replace" : "Find Next",
          primary: true,
          value: () => run(false),
        },
        ...(replace ? [{ label: "Replace All", value: () => run(true) }] : []),
        { label: "Cancel", value: null },
      ],
    });
  };
  const goTo = async () => {
    const input = await d.dialog.prompt("Go To Line", "Line number:", "1");
    if (!input) return;
    const line = Math.max(
      1,
      Math.min(editor.value.split("\n").length, parseInt(input) || 1),
    );
    const pos = editor.value
      .split("\n")
      .slice(0, line - 1)
      .reduce((n, s) => n + s.length + 1, 0);
    editor.focus();
    editor.setSelectionRange(pos, pos);
    updateStatus();
  };
  const font = async () => {
    const family = h(
        "select",
        { class: "vista-input" },
        [
          "Consolas, monospace",
          "Courier New, monospace",
          "Lucida Console, monospace",
          "Arial, sans-serif",
          "Segoe UI, sans-serif",
        ].map((x) =>
          h(
            "option",
            {
              value: x,
              selected:
                d.settings.get("notepadFont", "Consolas, monospace") === x,
            },
            x.split(",")[0],
          ),
        ),
      ),
      size = h("input", {
        class: "vista-input",
        type: "number",
        min: 8,
        max: 72,
        value: d.settings.get("notepadSize", 14),
      });
    if (
      await d.dialog.form({
        title: "Font",
        width: 360,
        body: h("div", {}, field("Font:", family), field("Size:", size)),
        buttons: [
          { label: "OK", value: true, primary: true },
          { label: "Cancel", value: false },
        ],
      })
    ) {
      d.settings.set("notepadFont", family.value);
      d.settings.set(
        "notepadSize",
        Math.max(8, Math.min(72, Number(size.value) || 14)),
      );
      apply();
    }
  };
  win.body.append(
    menuBar([
      {
        label: "File",
        items: [
          { label: "New", shortcut: "Ctrl+N", action: fresh },
          { label: "Open…", shortcut: "Ctrl+O", action: open },
          { label: "Save", shortcut: "Ctrl+S", action: () => save() },
          { label: "Save As…", action: () => save(true) },
          null,
          { label: "Print…", shortcut: "Ctrl+P", action: () => window.print() },
          null,
          { label: "Exit", action: () => win.close() },
        ],
      },
      {
        label: "Edit",
        items: () => [
          { label: "Undo", shortcut: "Ctrl+Z", action: () => doUndo(false) },
          { label: "Redo", shortcut: "Ctrl+Y", action: () => doUndo(true) },
          null,
          { label: "Cut", shortcut: "Ctrl+X", action: () => clipboard("cut") },
          {
            label: "Copy",
            shortcut: "Ctrl+C",
            action: () => clipboard("copy"),
          },
          {
            label: "Paste",
            shortcut: "Ctrl+V",
            action: () => clipboard("paste"),
          },
          { label: "Delete", action: () => replaceSelection("") },
          null,
          { label: "Find…", shortcut: "Ctrl+F", action: () => find(false) },
          { label: "Replace…", shortcut: "Ctrl+H", action: () => find(true) },
          { label: "Go To…", shortcut: "Ctrl+G", action: goTo },
          {
            label: "Select All",
            shortcut: "Ctrl+A",
            action: () => {
              editor.focus();
              editor.select();
            },
          },
          {
            label: "Time/Date",
            shortcut: "F5",
            action: () => replaceSelection(new Date().toLocaleString()),
          },
        ],
      },
      {
        label: "Format",
        items: () => [
          {
            label: "Word Wrap",
            checked: wrap,
            action: () => {
              wrap = !wrap;
              d.settings.set("notepadWrap", wrap);
              apply();
            },
          },
          { label: "Font…", action: font },
        ],
      },
      {
        label: "View",
        items: [
          {
            label: "Status Bar",
            checked: true,
            action: () => (status.hidden = !status.hidden),
          },
        ],
      },
      {
        label: "Help",
        items: [
          {
            label: "View Help",
            action: () => d.open("help", { topic: "Notepad" }),
          },
          {
            label: "About Notepad",
            action: () =>
              d.dialog.message(
                "About Notepad",
                "Notepad\nA plain text editor for your Windows Vista desktop.\nFiles are saved as UTF-8.",
              ),
          },
        ],
      },
    ]),
    editor,
    status,
  );
  editor.addEventListener("input", () => {
    undo.push({
      text: previous,
      start: Math.min(editor.selectionStart, previous.length),
      end: Math.min(editor.selectionStart, previous.length),
    });
    previous = editor.value;
    dirty();
    updateStatus();
  });
  editor.addEventListener("click", updateStatus);
  editor.addEventListener("keyup", updateStatus);
  win.el.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();
    if (e.ctrlKey || e.metaKey) {
      const commands = {
        s: () => save(e.shiftKey),
        o: open,
        n: fresh,
        f: () => find(false),
        h: () => find(true),
        g: goTo,
        z: () => doUndo(e.shiftKey),
        y: () => doUndo(true),
        p: () => window.print(),
      };
      if (commands[key]) {
        e.preventDefault();
        e.stopPropagation();
        commands[key]();
      }
    }
    if (e.key === "F5") {
      e.preventDefault();
      replaceSelection(new Date().toLocaleString());
    }
    if (e.key === "Tab" && e.target === editor) {
      e.preventDefault();
      replaceSelection("\t");
    }
  });
  win.beforeClose = () => confirmDirty(d, win, () => save());
  apply();
  if (args.path) await load(args.path);
  editor.focus();
  return win;
}

function sanitizeHTML(html) {
  const doc = new DOMParser().parseFromString(html, "text/html"),
    allowed = new Set([
      "P",
      "DIV",
      "SPAN",
      "B",
      "STRONG",
      "I",
      "EM",
      "U",
      "S",
      "BR",
      "H1",
      "H2",
      "H3",
      "H4",
      "UL",
      "OL",
      "LI",
      "BLOCKQUOTE",
      "PRE",
      "A",
      "IMG",
      "TABLE",
      "TBODY",
      "TR",
      "TD",
      "TH",
      "HR",
      "FONT",
    ]);
  for (const el of [...doc.body.querySelectorAll("*")]) {
    if (!allowed.has(el.tagName)) {
      if (
        ["SCRIPT", "STYLE", "IFRAME", "OBJECT", "FORM", "SVG", "MATH"].includes(
          el.tagName,
        )
      )
        el.remove();
      else el.replaceWith(...el.childNodes);
      continue;
    }
    for (const attr of [...el.attributes]) {
      if (attr.name === "style") {
        const safe = [
          "font-family",
          "font-size",
          "font-weight",
          "font-style",
          "text-decoration",
          "text-align",
          "color",
          "background-color",
          "margin-left",
        ];
        const style = el.style,
          values = safe
            .map((p) => [p, style.getPropertyValue(p)])
            .filter(([, v]) => v && !/url\(|expression/i.test(v));
        el.removeAttribute("style");
        for (const [p, v] of values) el.style.setProperty(p, v);
      } else if (
        ![
          "href",
          "src",
          "size",
          "face",
          "color",
          "width",
          "height",
          "colspan",
          "rowspan",
        ].includes(attr.name)
      )
        el.removeAttribute(attr.name);
    }
    if (
      el.tagName === "A" &&
      !/^(https?:|mailto:)/i.test(el.getAttribute("href") || "")
    )
      el.removeAttribute("href");
    if (
      el.tagName === "IMG" &&
      !/^data:image\/(png|jpeg|gif|webp|bmp);base64,/i.test(
        el.getAttribute("src") || "",
      )
    )
      el.remove();
  }
  return doc.body.innerHTML;
}
export async function wordpad(d, args = {}) {
  const win = d.wm.create({
    title: "Document - WordPad",
    icon: "wordpad",
    appId: "wordpad",
    width: 790,
    height: 570,
    remember: true,
  });
  let editor = h("div", {
    class: "richtext-editor",
    contentEditable: "true",
    role: "textbox",
    "aria-multiline": "true",
    "aria-label": "WordPad document",
  });
  const format = h("div", { class: "toolbar wordpad-toolbar" }),
    status = statusBar("WordPad", "HTML / RTF / Plain text");
  let path = null,
    fileId = null,
    baseline = "",
    range = null,
    generation = 0;
  const remember = () => {
    const selection = getSelection();
    if (selection?.rangeCount && editor.contains(selection.anchorNode))
      range = selection.getRangeAt(0).cloneRange();
  };
  document.addEventListener("selectionchange", remember, {
    signal: win.signal,
  });
  const dirty = () => {
    win.dirty = editor.innerHTML !== baseline;
    win.setTitle(
      (win.dirty ? "*" : "") +
        (path ? basename(path) : "Document") +
        " - WordPad",
    );
  };
  const command = (name, value) => {
    editor.focus();
    if (range) {
      const sel = getSelection();
      sel.removeAllRanges();
      try {
        sel.addRange(range);
      } catch {}
    }
    document.execCommand(name, false, value);
    remember();
    dirty();
  };
  const load = async (file) => {
    const token = ++generation,
      entry = d.fs.stat(file);
    if (!entry) throw new Error("File not found.");
    let content = entry.content;
    if (content instanceof Blob) content = await content.text();
    if (win.closed || token !== generation) return;
    resetEditor();
    path = file;
    fileId = entry.id;
    if (extension(file) === "rtf") {
      editor.textContent = decodeRTF(String(content));
      editor.style.whiteSpace = "pre-wrap";
    } else if (["html", "htm"].includes(extension(file))) {
      editor.innerHTML = sanitizeHTML(String(content));
      editor.style.whiteSpace = "normal";
    } else {
      editor.textContent = String(content);
      editor.style.whiteSpace = "pre-wrap";
    }
    baseline = editor.innerHTML;
    dirty();
  };
  const save = async (as = false) => {
    try {
      if (fileId && !as) path = d.fs.byId(fileId)?.path || path;
      let target = path;
      if (!target || as)
        target = await d.dialog.file({
          mode: "save",
          path: path ? dirname(path) : "C:/Users/User/Documents",
          name: path ? basename(path) : "Document.html",
          types: "HTML documents (*.html), Rich Text (*.rtf), Text (*.txt)",
        });
      if (!target) return false;
      const saved = editor.innerHTML,
        token = generation,
        ext = extension(target),
        content =
          ext === "txt"
            ? editor.innerText
            : ext === "rtf"
              ? encodeRTF(editor.innerText)
              : sanitizeHTML(editor.innerHTML),
        mime =
          ext === "txt"
            ? "text/plain"
            : ext === "rtf"
              ? "application/rtf"
              : "text/html";
      const file = d.fs.write(target, content, mime);
      await d.fs.flush();
      if (win.closed || token !== generation) return false;
      path = target;
      fileId = file.id;
      baseline = saved;
      dirty();
      return true;
    } catch (e) {
      d.dialog.error(e);
      return false;
    }
  };
  const open = async () => {
    if (!(await confirmDirty(d, win, () => save()))) return;
    const file = await d.dialog.file({ mode: "open" });
    if (file) await load(file);
  };
  const fresh = async () => {
    if (!(await confirmDirty(d, win, () => save()))) return;
    generation++;
    path = fileId = null;
    resetEditor();
    editor.innerHTML = "";
    baseline = "";
    dirty();
  };
  const insertImage = async () => {
    const files = await chooseFiles({ accept: "image/*" });
    if (!files[0]) return;
    const url = await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(files[0]);
    });
    command("insertImage", url);
  };
  const family = h(
      "select",
      { class: "format-select", "aria-label": "Font family" },
      [
        "Arial",
        "Times New Roman",
        "Courier New",
        "Segoe UI",
        "Georgia",
        "Verdana",
      ].map((v) => h("option", { value: v }, v)),
    ),
    size = h(
      "select",
      { class: "format-select", "aria-label": "Font size" },
      [8, 10, 12, 14, 18, 24, 36, 48].map((v, i) =>
        h("option", { value: i + 1, selected: v === 12 }, v),
      ),
    );
  family.onchange = () => command("fontName", family.value);
  size.onchange = () => command("fontSize", size.value);
  format.append(family, size, h("div", { class: "toolbar-divider" }));
  for (const [label, name, title] of [
    ["B", "bold", "Bold"],
    ["I", "italic", "Italic"],
    ["U", "underline", "Underline"],
    ["≡", "justifyLeft", "Align left"],
    ["≡", "justifyCenter", "Center"],
    ["≡", "justifyRight", "Align right"],
    ["•", "insertUnorderedList", "Bullets"],
    ["1.", "insertOrderedList", "Numbering"],
    ["⇥", "indent", "Increase indent"],
    ["⇤", "outdent", "Decrease indent"],
  ]) {
    const b = button(label, () => command(name), "toolbar-button", {
      title,
      "aria-label": title,
    });
    if (name === "bold") b.style.fontWeight = "bold";
    if (name === "italic") b.style.fontStyle = "italic";
    if (name === "underline") b.style.textDecoration = "underline";
    b.onmousedown = (e) => e.preventDefault();
    format.append(b);
  }
  const color = h("input", {
    type: "color",
    value: "#000000",
    title: "Text color",
    "aria-label": "Text color",
    style: {
      width: "27px",
      height: "24px",
      padding: "0",
      border: "1px solid #aaa",
    },
  });
  color.oninput = () => command("foreColor", color.value);
  format.append(color);
  win.body.append(
    menuBar([
      {
        label: "File",
        items: [
          { label: "New", shortcut: "Ctrl+N", action: fresh },
          { label: "Open…", shortcut: "Ctrl+O", action: open },
          { label: "Save", shortcut: "Ctrl+S", action: () => save() },
          { label: "Save As…", action: () => save(true) },
          null,
          { label: "Print…", shortcut: "Ctrl+P", action: () => window.print() },
          null,
          { label: "Exit", action: () => win.close() },
        ],
      },
      {
        label: "Edit",
        items: [
          { label: "Undo", shortcut: "Ctrl+Z", action: () => command("undo") },
          { label: "Redo", shortcut: "Ctrl+Y", action: () => command("redo") },
          null,
          { label: "Cut", action: () => command("cut") },
          { label: "Copy", action: () => command("copy") },
          {
            label: "Paste",
            action: async () => {
              try {
                command("insertText", await navigator.clipboard.readText());
              } catch {
                d.dialog.message(
                  "Paste",
                  "Press Ctrl+V to paste into your document.",
                );
              }
            },
          },
          { label: "Select All", action: () => command("selectAll") },
        ],
      },
      {
        label: "View",
        items: [
          {
            label: "Formatting Bar",
            checked: true,
            action: () => (format.hidden = !format.hidden),
          },
          {
            label: "Ruler",
            checked: true,
            action: () => (ruler.hidden = !ruler.hidden),
          },
        ],
      },
      {
        label: "Insert",
        items: [
          {
            label: "Date and Time…",
            action: () => command("insertText", new Date().toLocaleString()),
          },
          { label: "Picture…", action: insertImage },
          {
            label: "Horizontal line",
            action: () => command("insertHorizontalRule"),
          },
        ],
      },
      {
        label: "Format",
        items: [
          { label: "Bold", action: () => command("bold") },
          { label: "Italic", action: () => command("italic") },
          { label: "Underline", action: () => command("underline") },
          {
            label: "Bullet Style",
            action: () => command("insertUnorderedList"),
          },
          { label: "Remove Formatting", action: () => command("removeFormat") },
        ],
      },
      {
        label: "Help",
        items: [
          {
            label: "About WordPad",
            action: () =>
              d.dialog.message(
                "About WordPad",
                "WordPad\nRich text editing with HTML save and reopen. Plain text and basic RTF interchange are also available.",
              ),
          },
        ],
      },
    ]),
    h(
      "div",
      { class: "toolbar" },
      tool("New", "documents", fresh),
      tool("Open", "folder", open),
      tool("Save", "drive", () => save()),
      h("div", { class: "toolbar-divider" }),
      tool("Print", "documents", () => window.print()),
      tool("Insert Picture", "pictures", insertImage),
    ),
    format,
  );
  const ruler = h("div", { class: "richtext-ruler" });
  win.body.append(ruler, h("div", { class: "richtext-wrap" }, editor), status);
  const bindEditor = () => {
    editor.oninput = dirty;
    editor.addEventListener("paste", (e) => {
      if (e.clipboardData?.types.includes("text/html")) {
        e.preventDefault();
        command(
          "insertHTML",
          sanitizeHTML(e.clipboardData.getData("text/html")),
        );
      }
    });
  };
  const resetEditor = () => {
    const next = editor.cloneNode(false);
    editor.replaceWith(next);
    editor = next;
    range = null;
    bindEditor();
  };
  bindEditor();
  win.el.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase(),
        map = {
          s: () => save(e.shiftKey),
          o: open,
          n: fresh,
          p: () => window.print(),
        };
      if (map[key]) {
        e.preventDefault();
        e.stopPropagation();
        map[key]();
      }
    }
  });
  win.beforeClose = () => confirmDirty(d, win, () => save());
  if (args.path) await load(args.path);
  editor.focus();
  return win;
}

export function calculator(d) {
  const engine = new CalculatorEngine(),
    win = d.wm.create({
      title: "Calculator",
      icon: "calculator",
      appId: "calculator",
      width: 345,
      height: 343,
      resizable: false,
    }),
    display = h(
      "output",
      {
        class: "calc-display",
        "aria-live": "polite",
        "aria-label": "Calculator display",
      },
      "0",
    ),
    history = h("div", { class: "calc-history" }),
    keys = h("div", { class: "calc-keys" });
  let scientific = false;
  const update = () => {
    display.textContent = engine.display;
    history.textContent =
      (engine.memory ? "M   " : "") +
      (engine.pending ? `${engine.accumulator} ${engine.pending}` : "");
  };
  const press = (value) => {
    if (/^[0-9.]$/.test(value)) engine.digit(value);
    else if (["+", "-", "*", "/", "^"].includes(value)) engine.operation(value);
    else if (value === "=") engine.equals();
    else if (value === "C") engine.clear();
    else if (value === "CE") engine.clearEntry();
    else if (value === "Backspace") engine.backspace();
    else if (value.startsWith("M")) engine.memoryCommand(value);
    else engine.unary(value);
    update();
  };
  const render = () => {
    keys.replaceChildren();
    const values = [
      ["Backspace", "Backspace", "op wide"],
      ["CE", "CE", "op wide"],
      ["C", "C", "op wide"],
      ["MC", "MC", "mem"],
      ["7", "7", ""],
      ["8", "8", ""],
      ["9", "9", ""],
      ["/", "÷", "op"],
      ["sqrt", "√", ""],
      ["MR", "MR", "mem"],
      ["4", "4", ""],
      ["5", "5", ""],
      ["6", "6", ""],
      ["*", "×", "op"],
      ["percent", "%", ""],
      ["MS", "MS", "mem"],
      ["1", "1", ""],
      ["2", "2", ""],
      ["3", "3", ""],
      ["-", "−", "op"],
      ["reciprocal", "1/x", ""],
      ["M+", "M+", "mem"],
      ["0", "0", ""],
      ["negate", "±", ""],
      [".", ".", ""],
      ["+", "+", "op"],
      ["=", "=", "op equals"],
    ];
    if (scientific)
      values.unshift(
        ...[
          ["sin", "sin", ""],
          ["cos", "cos", ""],
          ["tan", "tan", ""],
          ["log", "log", ""],
          ["ln", "ln", ""],
          ["factorial", "n!", ""],
          ["square", "x²", ""],
          ["^", "xʸ", ""],
          ["pi", "π", ""],
          ["e", "e", ""],
          ["exp", "10ˣ", ""],
          ["abs", "abs", ""],
        ],
      );
    for (const [v, label, cls] of values)
      keys.append(
        button(
          label,
          () => {
            if (v === "pi") {
              engine.set(Math.PI);
              engine.fresh = true;
              update();
            } else if (v === "e") {
              engine.set(Math.E);
              engine.fresh = true;
              update();
            } else if (v === "exp") {
              engine.set(10 ** engine.number());
              update();
            } else if (v === "abs") {
              engine.set(Math.abs(engine.number()));
              update();
            } else press(v);
          },
          "calc-key " + cls,
        ),
      );
  };
  win.body.append(
    menuBar([
      {
        label: "Edit",
        items: [
          {
            label: "Copy",
            shortcut: "Ctrl+C",
            action: () => navigator.clipboard?.writeText(engine.display),
          },
          {
            label: "Paste",
            shortcut: "Ctrl+V",
            action: async () => {
              try {
                const text = await navigator.clipboard.readText();
                const n = Number(text);
                if (Number.isFinite(n)) {
                  engine.set(n);
                  engine.fresh = true;
                  update();
                }
              } catch {}
            },
          },
        ],
      },
      {
        label: "View",
        items: () => [
          {
            label: "Standard",
            checked: !scientific,
            action: () => {
              scientific = false;
              win.rect.height = 343;
              d.wm.applyRect(win);
              render();
            },
          },
          {
            label: "Scientific",
            checked: scientific,
            action: () => {
              scientific = true;
              win.rect.height = 425;
              d.wm.applyRect(win);
              render();
            },
          },
        ],
      },
      {
        label: "Help",
        items: [
          {
            label: "About Calculator",
            action: () =>
              d.dialog.message(
                "Calculator",
                "Standard and scientific calculations.\nScientific trigonometric functions use degrees.",
              ),
          },
        ],
      },
    ]),
    h("div", { class: "calc-body" }, history, display, keys),
  );
  win.el.addEventListener("keydown", (e) => {
    const map = { Enter: "=", Escape: "C", Delete: "CE", "%": "percent" };
    const v = map[e.key] || e.key;
    if (
      /^[0-9.+*/=\-]$/.test(v) ||
      ["C", "CE", "Backspace", "percent"].includes(v)
    ) {
      e.preventDefault();
      e.stopPropagation();
      press(v);
    }
  });
  render();
  win.el.focus();
  return win;
}

export async function paint(d, args = {}) {
  const title = args.journal ? "Windows Journal" : "Paint",
    win = d.wm.create({
      title: "Untitled - " + title,
      icon: args.journal ? "wordpad" : "paint",
      appId: args.journal ? "journal" : "paint",
      width: 850,
      height: 610,
      remember: true,
    }),
    canvas = h("canvas", {
      width: args.journal ? 760 : 640,
      height: args.journal ? 980 : 400,
      "aria-label": "Drawing canvas",
    }),
    ctx = canvas.getContext("2d", { willReadFrequently: true }),
    stage = h("div", { class: "paint-stage" }, canvas),
    tools = h("div", { class: "paint-tools" }),
    palette = h("div", { class: "paint-palette" }),
    status = statusBar("For Help, click Help Topics on the Help Menu.");
  let active = args.journal ? "brush" : "pencil",
    color = "#000000",
    background = "#ffffff",
    size = args.journal ? 3 : 2,
    path = null,
    fileId = null,
    history = new UndoStack(30),
    drawing = false,
    start = null,
    previous = null,
    snapshot = null,
    selection = null,
    moveSelection = false,
    selectionPixels = null,
    baseAfterCut = null,
    generation = 0,
    revision = 0;
  const capture = () => ctx.getImageData(0, 0, canvas.width, canvas.height);
  const push = () => history.push(capture());
  const mark = () => {
    revision++;
    win.dirty = true;
    win.setTitle((path ? basename(path) : "Untitled") + " - " + title);
  };
  function blank(w = 640, h = 400) {
    revision++;
    canvas.width = w;
    canvas.height = h;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
    if (args.journal) {
      ctx.strokeStyle = "#c4dceb";
      ctx.lineWidth = 1;
      for (let y = 50; y < h; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
        ctx.stroke();
      }
      ctx.strokeStyle = "#e3b4bd";
      ctx.beginPath();
      ctx.moveTo(65, 0);
      ctx.lineTo(65, h);
      ctx.stroke();
    }
    selection = null;
    status.textContent = `${w} × ${h} pixels`;
  }
  const restore = (image) => {
    if (!image) return;
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.putImageData(image, 0, 0);
    selection = null;
    mark();
  };
  const undo = (redo) =>
    restore(redo ? history.redo(capture()) : history.undo(capture()));
  const blob = () =>
    new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  const save = async (as = false) => {
    try {
      if (fileId && !as) path = d.fs.byId(fileId)?.path || path;
      let target = path;
      if (!target || as || !/\.png$/i.test(target))
        target = await d.dialog.file({
          mode: "save",
          path: path ? dirname(path) : "C:/Users/User/Pictures",
          name: path
            ? basename(path)
            : args.journal
              ? "Journal.png"
              : "Untitled.png",
          types: "PNG image (*.png)",
          normalizeTarget: (p) =>
            /\.png$/i.test(p)
              ? p
              : joinPath(
                  dirname(p),
                  basename(p).replace(/\.[^.]+$/, "") + ".png",
                ),
        });
      if (!target) return false;
      const token = generation,
        savedRevision = revision,
        temp = document.createElement("canvas");
      temp.width = canvas.width;
      temp.height = canvas.height;
      temp.getContext("2d").drawImage(canvas, 0, 0);
      const image = await new Promise((resolve) =>
        temp.toBlob(resolve, "image/png"),
      );
      if (!image) throw new Error("The image could not be encoded.");
      const entry = d.fs.write(target, image, "image/png");
      await d.fs.flush();
      if (win.closed || generation !== token) return false;
      path = target;
      fileId = entry.id;
      win.dirty = revision !== savedRevision;
      win.setTitle(basename(path) + " - " + title);
      return true;
    } catch (e) {
      d.dialog.error(e);
      return false;
    }
  };
  const load = async (file) => {
    const token = ++generation,
      entry = d.fs.stat(file);
    if (!entry) throw new Error("File not found.");
    const source = contentURL(entry),
      image = new Image();
    image.src = source.url;
    try {
      await image.decode();
      if (win.closed || token !== generation) return;
      if (image.width * image.height > 16777216)
        throw new Error("Choose an image smaller than 16 megapixels.");
      blank(image.width, image.height);
      ctx.drawImage(image, 0, 0);
      path = file;
      fileId = entry.id;
      history = new UndoStack(30);
      win.dirty = false;
      win.setTitle(basename(path) + " - " + title);
    } finally {
      if (source.release) URL.revokeObjectURL(source.url);
    }
  };
  const open = async () => {
    if (!(await confirmDirty(d, win, () => save()))) return;
    const file = await d.dialog.file({
      mode: "open",
      path: "C:/Users/User/Pictures",
    });
    if (file)
      try {
        await load(file);
      } catch (e) {
        d.dialog.error(e);
      }
  };
  const fresh = async () => {
    if (!(await confirmDirty(d, win, () => save()))) return;
    generation++;
    blank(args.journal ? 760 : 640, args.journal ? 980 : 400);
    path = fileId = null;
    history = new UndoStack(30);
    win.dirty = false;
    win.setTitle("Untitled - " + title);
  };
  const attrs = async () => {
    const width = h("input", {
        class: "vista-input",
        type: "number",
        min: 1,
        max: 4096,
        value: canvas.width,
      }),
      height = h("input", {
        class: "vista-input",
        type: "number",
        min: 1,
        max: 4096,
        value: canvas.height,
      });
    if (
      await d.dialog.form({
        title: "Attributes",
        width: 330,
        body: h(
          "div",
          {},
          field("Width:", width),
          field("Height:", height),
          h("p", { class: "muted" }, "Units: pixels"),
        ),
        buttons: [
          { label: "OK", value: true, primary: true },
          { label: "Cancel", value: false },
        ],
      })
    ) {
      const w = Math.max(1, Math.min(4096, Number(width.value) || 1)),
        hgt = Math.max(1, Math.min(4096, Number(height.value) || 1)),
        old = capture();
      push();
      blank(w, hgt);
      ctx.putImageData(old, 0, 0);
      mark();
    }
  };
  const filter = async (mode) => {
    const token = generation,
      before = revision,
      image = capture();
    const result = await d.renderer.filter(image, mode);
    if (win.closed || token !== generation || before !== revision || drawing)
      return;
    push();
    ctx.putImageData(result, 0, 0);
    selection = null;
    mark();
  };
  const rotate = (angle) => {
    push();
    const temp = document.createElement("canvas");
    temp.width = canvas.width;
    temp.height = canvas.height;
    temp.getContext("2d").drawImage(canvas, 0, 0);
    if (Math.abs(angle) === 90) {
      canvas.width = temp.height;
      canvas.height = temp.width;
    }
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.drawImage(temp, -temp.width / 2, -temp.height / 2);
    ctx.restore();
    selection = null;
    mark();
  };
  const crop = () => {
    if (!selection) {
      d.dialog.message(
        "Crop",
        "Use the Select tool to draw a rectangle around the area you want to keep.",
      );
      return;
    }
    const s = selection,
      pixels = ctx.getImageData(s.x, s.y, s.w, s.h);
    push();
    canvas.width = s.w;
    canvas.height = s.h;
    ctx.putImageData(pixels, 0, 0);
    selection = null;
    mark();
  };
  let clip = null;
  const copy = () => {
    clip = selection
      ? ctx.getImageData(selection.x, selection.y, selection.w, selection.h)
      : capture();
  };
  const paste = () => {
    if (!clip) return;
    push();
    ctx.putImageData(clip, 0, 0);
    selection = { x: 0, y: 0, w: clip.width, h: clip.height };
    mark();
  };
  win.body.append(
    menuBar([
      {
        label: "File",
        items: [
          { label: "New", shortcut: "Ctrl+N", action: fresh },
          { label: "Open…", shortcut: "Ctrl+O", action: open },
          { label: "Save", shortcut: "Ctrl+S", action: () => save() },
          { label: "Save As…", action: () => save(true) },
          {
            label: "Export PNG…",
            action: async () =>
              downloadBlob(await blob(), path ? basename(path) : "Drawing.png"),
          },
          null,
          { label: "Print…", action: () => window.print() },
          null,
          { label: "Exit", action: () => win.close() },
        ],
      },
      {
        label: "Edit",
        items: [
          { label: "Undo", shortcut: "Ctrl+Z", action: () => undo(false) },
          { label: "Repeat", shortcut: "Ctrl+Y", action: () => undo(true) },
          null,
          { label: "Copy", shortcut: "Ctrl+C", action: copy },
          { label: "Paste", shortcut: "Ctrl+V", action: paste },
          {
            label: "Select All",
            shortcut: "Ctrl+A",
            action: () => {
              selection = { x: 0, y: 0, w: canvas.width, h: canvas.height };
              active = "select";
              updateTools();
            },
          },
          {
            label: "Clear Selection",
            shortcut: "Del",
            action: () => {
              if (selection) {
                push();
                ctx.fillStyle = background;
                ctx.fillRect(
                  selection.x,
                  selection.y,
                  selection.w,
                  selection.h,
                );
                selection = null;
                mark();
              }
            },
          },
        ],
      },
      {
        label: "View",
        items: [
          {
            label: "Tool Box",
            checked: true,
            action: () => (tools.hidden = !tools.hidden),
          },
          {
            label: "Color Box",
            checked: true,
            action: () => (palette.hidden = !palette.hidden),
          },
          {
            label: "Zoom 100%",
            action: () => {
              canvas.style.width = canvas.width + "px";
              canvas.style.height = canvas.height + "px";
            },
          },
          {
            label: "Zoom 200%",
            action: () => {
              canvas.style.width = canvas.width * 2 + "px";
              canvas.style.height = canvas.height * 2 + "px";
            },
          },
          {
            label: "Fit to Window",
            action: () => {
              const ratio = Math.min(
                1,
                (stage.clientWidth - 12) / canvas.width,
                (stage.clientHeight - 12) / canvas.height,
              );
              canvas.style.width = canvas.width * ratio + "px";
              canvas.style.height = canvas.height * ratio + "px";
            },
          },
        ],
      },
      {
        label: "Image",
        items: [
          { label: "Flip/Rotate 90°", action: () => rotate(90) },
          { label: "Rotate 180°", action: () => rotate(180) },
          { label: "Crop", action: crop },
          null,
          {
            label: "Invert Colors",
            shortcut: "Ctrl+I",
            action: () => filter(0),
          },
          { label: "Grayscale", action: () => filter(1) },
          { label: "Sepia", action: () => filter(2) },
          { label: "Black and White", action: () => filter(3) },
          null,
          { label: "Attributes…", action: attrs },
          {
            label: "Clear Image",
            action: () => {
              push();
              blank(canvas.width, canvas.height);
              mark();
            },
          },
        ],
      },
      {
        label: "Colors",
        items: [{ label: "Edit Colors…", action: () => foreground.click() }],
      },
      {
        label: "Help",
        items: [
          {
            label: "Help Topics",
            action: () =>
              d.dialog.message(
                title,
                "Draw using the tools on the left.\nSelect and drag to move a region. Choose Image > Crop to keep it.\nRight-click a color to set the eraser background color.\nSave or export your drawing as PNG.",
              ),
          },
        ],
      },
    ]),
    h("div", { class: "paint-main" }, tools, stage),
    palette,
    status,
  );
  const toolsList = [
    ["select", "▱", "Select"],
    ["eraser", "▰", "Eraser"],
    ["fill", "◩", "Fill with color"],
    ["picker", "⌾", "Pick color"],
    ["pencil", "✎", "Pencil"],
    ["brush", "✐", "Brush"],
    ["spray", "⁙", "Airbrush"],
    ["text", "A", "Text"],
    ["line", "╱", "Line"],
    ["rect", "□", "Rectangle"],
    ["ellipse", "○", "Ellipse"],
    ["filledrect", "■", "Filled rectangle"],
  ];
  const updateTools = () => {
    tools.replaceChildren();
    for (const [key, glyph, label] of toolsList)
      tools.append(
        button(
          glyph,
          () => {
            active = key;
            selection = null;
            updateTools();
          },
          "paint-tool" + (active === key ? " active" : ""),
          { title: label, "aria-label": label, "aria-pressed": active === key },
        ),
      );
  };
  updateTools();
  const foreground = h("input", {
    type: "color",
    value: color,
    class: "paint-foreground",
    "aria-label": "Drawing color",
  });
  foreground.oninput = () => {
    color = foreground.value;
  };
  const swatches = h("div", { class: "paint-swatches" });
  for (const c of [
    "#000000",
    "#ffffff",
    "#808080",
    "#c0c0c0",
    "#800000",
    "#ff0000",
    "#808000",
    "#ffff00",
    "#008000",
    "#00ff00",
    "#008080",
    "#00ffff",
    "#000080",
    "#0000ff",
    "#800080",
    "#ff00ff",
    "#808040",
    "#ffff80",
    "#004040",
    "#00ff80",
    "#0080ff",
    "#80ffff",
    "#004080",
    "#8080ff",
    "#400080",
    "#ff0080",
    "#804000",
    "#ff8040",
  ]) {
    const b = button(
      "",
      () => {
        color = c;
        foreground.value = c;
      },
      "paint-color",
      { style: { background: c }, title: c, "aria-label": c },
    );
    b.oncontextmenu = (e) => {
      e.preventDefault();
      background = c;
    };
    swatches.append(b);
  }
  const sizeInput = h("input", {
    class: "vista-input paint-size",
    type: "number",
    min: 1,
    max: 80,
    value: size,
    "aria-label": "Brush size",
  });
  sizeInput.onchange = () =>
    (size = Math.max(1, Math.min(80, Number(sizeInput.value) || 1)));
  palette.append(
    foreground,
    swatches,
    h("span", { class: "spacer" }),
    h("label", {}, "Size ", sizeInput),
  );
  const point = (e) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(
          canvas.width - 1,
          ((e.clientX - r.left) * canvas.width) / r.width,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          canvas.height - 1,
          ((e.clientY - r.top) * canvas.height) / r.height,
        ),
      ),
    };
  };
  const shape = (p, preview = false) => {
    if (snapshot) ctx.putImageData(snapshot, 0, 0);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const x = Math.min(start.x, p.x),
      y = Math.min(start.y, p.y),
      w = Math.abs(p.x - start.x),
      ht = Math.abs(p.y - start.y);
    if (active === "line") {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else if (active === "rect") ctx.strokeRect(x, y, w, ht);
    else if (active === "filledrect") ctx.fillRect(x, y, w, ht);
    else if (active === "ellipse") {
      ctx.beginPath();
      ctx.ellipse(
        x + w / 2,
        y + ht / 2,
        Math.max(0.1, w / 2),
        Math.max(0.1, ht / 2),
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    } else if (active === "select") {
      if (preview) {
        ctx.save();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x + 0.5, y + 0.5, w, ht);
        ctx.restore();
      } else
        selection = {
          x: Math.floor(x),
          y: Math.floor(y),
          w: Math.max(1, Math.floor(w)),
          h: Math.max(1, Math.floor(ht)),
        };
    }
  };
  const stroke = (p) => {
    ctx.fillStyle = active === "eraser" ? background : color;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth =
      active === "brush" ? size * 2 : active === "eraser" ? size * 4 : size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (active === "spray") {
      for (let i = 0; i < 22; i++) {
        const r = Math.random() * size * 4,
          a = Math.random() * Math.PI * 2;
        ctx.fillRect(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 1, 1);
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(previous.x, previous.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    previous = p;
  };
  canvas.onpointerdown = async (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const p = point(e);
    if (active === "picker") {
      const data = ctx.getImageData(
        Math.floor(p.x),
        Math.floor(p.y),
        1,
        1,
      ).data;
      color =
        "#" +
        [data[0], data[1], data[2]]
          .map((v) => v.toString(16).padStart(2, "0"))
          .join("");
      foreground.value = color;
      return;
    }
    if (active === "text") {
      const text = await d.dialog.prompt("Text", "Text to insert:", "");
      if (text) {
        push();
        ctx.fillStyle = color;
        ctx.font = `${Math.max(12, size * 5)}px Segoe UI, sans-serif`;
        ctx.textBaseline = "top";
        ctx.fillText(text, p.x, p.y);
        mark();
      }
      return;
    }
    revision++;
    push();
    snapshot = capture();
    start = p;
    previous = p;
    drawing = true;
    moveSelection =
      active === "select" &&
      selection &&
      p.x >= selection.x &&
      p.x < selection.x + selection.w &&
      p.y >= selection.y &&
      p.y < selection.y + selection.h;
    if (moveSelection) {
      selectionPixels = ctx.getImageData(
        selection.x,
        selection.y,
        selection.w,
        selection.h,
      );
      ctx.fillStyle = background;
      ctx.fillRect(selection.x, selection.y, selection.w, selection.h);
      baseAfterCut = capture();
      start = { ...p, selection: { ...selection } };
    } else if (active === "fill") {
      const image = capture(),
        rgba = [
          parseInt(color.slice(1, 3), 16),
          parseInt(color.slice(3, 5), 16),
          parseInt(color.slice(5, 7), 16),
          255,
        ];
      floodFill(image.data, canvas.width, canvas.height, p.x, p.y, rgba);
      ctx.putImageData(image, 0, 0);
      drawing = false;
      mark();
    } else if (["pencil", "brush", "eraser", "spray"].includes(active))
      stroke(p);
  };
  canvas.onpointermove = (e) => {
    const p = point(e);
    status.textContent = `${Math.round(p.x)}, ${Math.round(p.y)} px    ${canvas.width} × ${canvas.height} pixels`;
    if (!drawing) return;
    if (moveSelection) {
      ctx.putImageData(baseAfterCut, 0, 0);
      ctx.putImageData(
        selectionPixels,
        Math.round(start.selection.x + p.x - start.x),
        Math.round(start.selection.y + p.y - start.y),
      );
    } else if (["pencil", "brush", "eraser", "spray"].includes(active))
      stroke(p);
    else shape(p, true);
  };
  const end = (e) => {
    if (!drawing) return;
    const p = point(e);
    if (moveSelection) {
      selection = {
        ...start.selection,
        x: Math.round(start.selection.x + p.x - start.x),
        y: Math.round(start.selection.y + p.y - start.y),
      };
      selection.x = Math.max(
        0,
        Math.min(canvas.width - selection.w, selection.x),
      );
      selection.y = Math.max(
        0,
        Math.min(canvas.height - selection.h, selection.y),
      );
      ctx.putImageData(baseAfterCut, 0, 0);
      ctx.putImageData(selectionPixels, selection.x, selection.y);
    } else if (!["pencil", "brush", "eraser", "spray"].includes(active))
      shape(p, false);
    drawing = false;
    mark();
  };
  canvas.onpointerup = end;
  canvas.onpointercancel = end;
  win.el.addEventListener("keydown", (e) => {
    if (e.target.matches("input,textarea")) return;
    if (e.ctrlKey || e.metaKey) {
      const map = {
        s: () => save(e.shiftKey),
        o: open,
        n: fresh,
        z: () => undo(e.shiftKey),
        y: () => undo(true),
        i: () => filter(0),
        c: copy,
        v: paste,
        a: () => {
          selection = { x: 0, y: 0, w: canvas.width, h: canvas.height };
          active = "select";
          updateTools();
        },
      };
      const fn = map[e.key.toLowerCase()];
      if (fn) {
        e.preventDefault();
        e.stopPropagation();
        fn();
      }
    }
  });
  win.beforeClose = () => confirmDirty(d, win, () => save());
  blank(args.journal ? 760 : 640, args.journal ? 980 : 400);
  if (args.path) await load(args.path);
  return win;
}

export function terminal(d) {
  const win = d.wm.create({
      title: "Command Prompt",
      icon: "run",
      appId: "terminal",
      width: 720,
      height: 445,
      remember: true,
    }),
    body = h("div", { class: "terminal-body" }),
    output = h(
      "pre",
      { class: "terminal-output" },
      "Microsoft Windows [Version 6.0.6001]\nBrowser desktop command environment\n\n",
    ),
    prompt = h("span", { class: "terminal-prompt" }),
    input = h("input", {
      class: "terminal-input",
      autocomplete: "off",
      spellcheck: "false",
      "aria-label": "Command",
    });
  let cwd = "C:/Users/User",
    history = [],
    index = 0;
  body.append(output, h("div", { class: "terminal-line" }, prompt, input));
  win.body.append(body);
  const println = (text) => {
    output.textContent += text + "\n";
    body.scrollTop = body.scrollHeight;
  };
  const setPrompt = () => (prompt.textContent = prettyPath(cwd) + ">");
  const resolve = (p) => resolvePath(p || "", cwd);
  const execute = async (line) => {
    const redirection = /^echo\s+([\s\S]*?)\s*(>>?)\s*(.+)$/i.exec(line);
    if (redirection) {
      const target = resolve(redirection[3].replace(/^"|"$/g, "")),
        previous =
          redirection[2] === ">>" && d.fs.exists(target)
            ? d.fs.read(target)
            : "";
      d.fs.write(target, String(previous) + redirection[1] + "\r\n");
      return;
    }
    const args = tokenizeCommand(line),
      cmd = (args.shift() || "").toLowerCase();
    if (!cmd) return;
    const path = args[0] ? resolve(args[0]) : cwd;
    if (cmd === "help") {
      println(
        "Commands:\n  help, cls, ver, echo, date, time, whoami, hostname\n  dir [path], cd [path], cd .., tree [path]\n  mkdir <name>, rmdir <name>, copy <source> <destination>\n  move <source> <destination>, ren <source> <name>\n  type <file>, del <file>, start <program or file>\n  tasklist, taskkill /pid <id>, find <text> <file>\n  color <hex>, title <text>, systeminfo, shutdown /r\n  notepad, mspaint, calc, explorer, control, regedit\n  echo <text> > <file>, echo <text> >> <file>\n\nFiles use the desktop virtual C: drive. Native executables are not executed.",
      );
    } else if (cmd === "cls") output.textContent = "";
    else if (cmd === "ver")
      println("Microsoft Windows Vista browser desktop [6.0.6001]");
    else if (cmd === "echo") println(args.join(" "));
    else if (cmd === "date") println(new Date().toLocaleDateString());
    else if (cmd === "time") println(new Date().toLocaleTimeString());
    else if (cmd === "whoami")
      println("vista\\" + d.settings.get("userName", "User"));
    else if (cmd === "hostname") println("VISTA-PC");
    else if (cmd === "cd" || cmd === "chdir") {
      if (!args.length) println(prettyPath(cwd));
      else {
        const dest = args[0].toLowerCase() === "/d" ? resolve(args[1]) : path;
        const entry = d.fs.stat(dest);
        if (entry?.kind !== "folder")
          throw new Error("The system cannot find the path specified.");
        cwd = entry.path;
      }
    } else if (cmd === "dir") {
      const target = args.find((a) => !a.startsWith("/")),
        root = target ? resolve(target) : cwd;
      const entry = d.fs.stat(root);
      if (!entry) throw new Error("The system cannot find the path specified.");
      const rows = entry.kind === "folder" ? d.fs.list(root) : [entry];
      if (!args.includes("/b"))
        println(" Directory of " + prettyPath(root) + "\n");
      for (const e of rows)
        println(
          args.includes("/b")
            ? e.name
            : `${new Date(e.modified).toLocaleDateString().padEnd(14)} ${e.kind === "folder" ? "<DIR>".padEnd(12) : String(e.content instanceof Blob ? e.content.size : String(e.content || "").length).padStart(12)}  ${e.name}`,
        );
      if (!args.includes("/b"))
        println(
          `\n ${rows.filter((e) => e.kind === "file").length} File(s)\n ${rows.filter((e) => e.kind === "folder").length} Dir(s)`,
        );
    } else if (cmd === "tree") {
      const walk = (p, depth) => {
        if (depth > 12) return;
        for (const e of d.fs.list(p)) {
          if (e.kind === "folder") {
            println("  ".repeat(depth) + "+-- " + e.name);
            walk(e.path, depth + 1);
          }
        }
      };
      println(prettyPath(path));
      walk(path, 0);
    } else if (cmd === "mkdir" || cmd === "md") {
      if (!args[0]) throw new Error("The syntax of the command is incorrect.");
      let target = "C:/";
      for (const part of path.slice(3).split("/")) {
        target = joinPath(target, part);
        if (!d.fs.exists(target)) d.fs.mkdir(target);
      }
    } else if (cmd === "rmdir" || cmd === "rd") {
      if (!args[0]) throw new Error("Specify a folder.");
      if (d.fs.list(path).length && !args.includes("/s"))
        throw new Error("The directory is not empty.");
      d.fs.remove(path);
      println("Folder moved to the Recycle Bin.");
    } else if (["copy", "move", "ren", "rename"].includes(cmd)) {
      if (args.length < 2) throw new Error("Specify a source and destination.");
      let target =
        cmd === "ren" || cmd === "rename"
          ? joinPath(dirname(path), args[1])
          : resolve(args[1]);
      if (d.fs.stat(target)?.kind === "folder")
        target = joinPath(target, basename(path));
      d.fs.move(path, target, cmd === "copy");
      println("        1 file(s) " + (cmd === "copy" ? "copied." : "moved."));
    } else if (cmd === "type") {
      let text = d.fs.read(path);
      if (text instanceof Blob) text = await text.text();
      println(String(text));
    } else if (cmd === "del" || cmd === "erase") {
      if (!args[0]) throw new Error("Specify a file.");
      d.fs.remove(path);
      println("File moved to the Recycle Bin.");
    } else if (cmd === "find") {
      if (args.length < 2) throw new Error('Usage: find "text" file');
      let text = d.fs.read(resolve(args[1]));
      if (text instanceof Blob) text = await text.text();
      println(
        String(text)
          .split(/\r?\n/)
          .filter((x) => x.includes(args[0]))
          .join("\n"),
      );
    } else if (cmd === "tasklist") {
      println(
        "Image Name                     PID     Window Title\n========================= ======== =========================",
      );
      for (const w of d.wm.windows.filter((w) => !w.modal))
        println(
          (w.appId + ".exe").padEnd(27) +
            String(w.id).padStart(7) +
            " " +
            w.title,
        );
    } else if (cmd === "taskkill") {
      const pid = Number(
          args[args.findIndex((a) => a.toLowerCase() === "/pid") + 1],
        ),
        target = d.wm.windows.find((w) => w.id === pid);
      if (!target) throw new Error("The process was not found.");
      await target.close();
      println(
        target.closed
          ? "SUCCESS: The process was terminated."
          : "The process was not terminated.",
      );
    } else if (cmd === "title")
      win.setTitle(args.join(" ") || "Command Prompt");
    else if (cmd === "color") {
      const colors = [
        "#000",
        "#000080",
        "#008000",
        "#008080",
        "#800000",
        "#800080",
        "#808000",
        "#c0c0c0",
        "#808080",
        "#00f",
        "#0f0",
        "#0ff",
        "#f00",
        "#f0f",
        "#ff0",
        "#fff",
      ];
      const v = args[0] || "07";
      if (!/^[0-9a-f]{2}$/i.test(v))
        throw new Error("Use two hexadecimal digits, such as 0A.");
      body.style.background = colors[parseInt(v[0], 16)];
      body.style.color = colors[parseInt(v[1], 16)];
    } else if (cmd === "systeminfo")
      println(
        `Host Name: VISTA-PC\nOS Name: Windows Vista browser desktop\nOS Version: 6.0.6001\nSystem Type: Browser runtime\nLogical processors: ${navigator.hardwareConcurrency || "Not available"}\nGraphics backend: ${d.renderer.backend}\nStorage: ${d.fs.db ? "IndexedDB" : "Memory only"}\nVirtual files: ${d.fs.entries.size}\nBrowser: ${navigator.userAgent}`,
      );
    else if (cmd === "shutdown")
      await d.session(args.includes("/r") ? "restart" : "shutdown");
    else if (cmd === "exit") win.close();
    else {
      const aliases = {
        calc: "calculator",
        mspaint: "paint",
        cmd: "terminal",
        taskmgr: "taskmanager",
        regedit: "registry",
        write: "wordpad",
        wmplayer: "media",
      };
      if (cmd === "start") {
        const target = args.join(" ");
        if (d.fs.exists(resolve(target))) d.openFile(resolve(target));
        else d.open(aliases[target] || target);
      } else {
        const name = cmd.replace(/\.exe$/, "");
        if (d.apps.some((a) => a.id === (aliases[name] || name)))
          d.open(aliases[name] || name, args[0] ? { path } : {});
        else
          throw new Error(
            `'${cmd}' is not recognized as an internal or external command,\noperable program or batch file.`,
          );
      }
    }
  };
  input.onkeydown = async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const line = input.value;
      input.value = "";
      println(prettyPath(cwd) + ">" + line);
      history.push(line);
      index = history.length;
      input.disabled = true;
      try {
        for (const command of splitCommands(line)) await execute(command);
      } catch (error) {
        println(error.message);
      }
      println("");
      setPrompt();
      input.disabled = false;
      input.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      index = Math.max(0, index - 1);
      input.value = history[index] || "";
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      index = Math.min(history.length, index + 1);
      input.value = history[index] || "";
    } else if (e.key === "Tab") {
      e.preventDefault();
      const pieces = tokenizeCommand(input.value),
        last = pieces.at(-1) || "",
        matches = d.fs
          .list(cwd)
          .filter((x) => x.name.toLowerCase().startsWith(last.toLowerCase()));
      if (matches.length === 1)
        input.value =
          input.value.slice(0, input.value.length - last.length) +
          (matches[0].name.includes(" ")
            ? '"' + matches[0].name + '"'
            : matches[0].name);
    } else if (
      e.ctrlKey &&
      e.key.toLowerCase() === "c" &&
      !getSelection()?.toString()
    ) {
      e.preventDefault();
      println(prettyPath(cwd) + ">" + input.value + "^C");
      input.value = "";
    }
  };
  body.onclick = () => {
    if (!getSelection()?.toString()) input.focus();
  };
  setPrompt();
  input.focus();
  return win;
}

function characterMap(d) {
  const win = d.wm.create({
      title: "Character Map",
      icon: "notepad",
      appId: "charactermap",
      width: 490,
      height: 400,
    }),
    font = h(
      "select",
      { class: "vista-input" },
      [
        "Arial",
        "Times New Roman",
        "Segoe UI Symbol",
        "Georgia",
        "Courier New",
      ].map((x) => h("option", {}, x)),
    ),
    grid = h("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(16,1fr)",
        gap: "1px",
        background: "#888",
        padding: "1px",
        flex: "1",
        overflow: "auto",
      },
    }),
    selected = h("input", {
      class: "vista-input",
      value: "",
      "aria-label": "Characters to copy",
    });
  for (let i = 160; i < 384; i++)
    grid.append(
      button(
        String.fromCharCode(i),
        () => (selected.value += String.fromCharCode(i)),
        "",
        {
          title: "U+" + i.toString(16).toUpperCase().padStart(4, "0"),
          style: {
            background: "#fff",
            border: 0,
            minHeight: "26px",
            padding: "2px",
            fontSize: "17px",
          },
        },
      ),
    );
  font.onchange = () => (grid.style.fontFamily = font.value);
  win.body.append(
    h("div", { class: "toolbar" }, field("Font:", font)),
    grid,
    h(
      "div",
      { class: "toolbar" },
      h("span", {}, "Characters to copy:"),
      selected,
      button(
        "Copy",
        async () => {
          try {
            await navigator.clipboard.writeText(selected.value);
          } catch {
            selected.select();
            document.execCommand("copy");
          }
        },
        "vista-button",
      ),
    ),
  );
  return win;
}
function snipping(d) {
  const win = d.wm.create({
      title: "Snipping Tool",
      icon: "paint",
      appId: "snipping",
      width: 620,
      height: 415,
    }),
    stage = h("div", { class: "photo-stage" }),
    canvas = h("canvas", {
      style: {
        maxWidth: "100%",
        maxHeight: "100%",
        cursor: "crosshair",
        touchAction: "none",
      },
    }),
    status = statusBar("Select New to capture a screen or browser tab.");
  let captured = false,
    snapshot = null,
    start = null;
  const newCapture = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      d.dialog.message(
        "Screen capture",
        "Screen capture is unavailable in this browser. Use Paint to import an existing screenshot.",
      );
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: false,
        preferCurrentTab: true,
      });
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);
      snapshot = canvas
        .getContext("2d")
        .getImageData(0, 0, canvas.width, canvas.height);
      captured = true;
      stage.replaceChildren(canvas);
      status.textContent =
        "Drag across the image to crop. Save your snip as PNG.";
    } catch (error) {
      if (error.name !== "NotAllowedError") d.dialog.error(error);
    } finally {
      stream?.getTracks().forEach((t) => t.stop());
    }
  };
  const save = async () => {
    if (!captured) return;
    const path = await d.dialog.file({
      mode: "save",
      path: "C:/Users/User/Pictures",
      name: "Capture.png",
    });
    if (path) {
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      d.fs.write(path, blob, "image/png");
      await d.fs.flush();
      status.textContent = "Saved " + basename(path);
    }
  };
  win.body.append(
    h(
      "div",
      { class: "toolbar" },
      tool("New", "pictures", newCapture),
      tool("Save Snip", "drive", save),
      tool("Open in Paint", "paint", async () => {
        if (!captured) return;
        const path = d.fs.uniquePath("C:/Users/User/Pictures", "Capture.png"),
          blob = await new Promise((resolve) =>
            canvas.toBlob(resolve, "image/png"),
          );
        d.fs.write(path, blob, "image/png");
        d.open("paint", { path });
      }),
    ),
    stage,
    status,
  );
  stage.append(
    h(
      "div",
      { class: "app-note" },
      "Click New, choose the screen or tab to capture, then drag to select the area you want to keep.",
    ),
  );
  const point = (e) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.round(((e.clientX - r.left) * canvas.width) / r.width),
      y: Math.round(((e.clientY - r.top) * canvas.height) / r.height),
    };
  };
  canvas.onpointerdown = (e) => {
    if (!captured) return;
    start = point(e);
    snapshot = canvas
      .getContext("2d")
      .getImageData(0, 0, canvas.width, canvas.height);
    canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove = (e) => {
    if (!start) return;
    const p = point(e),
      ctx = canvas.getContext("2d");
    ctx.putImageData(snapshot, 0, 0);
    ctx.strokeStyle = "#e31a1a";
    ctx.lineWidth = Math.max(1, canvas.width / 600);
    ctx.strokeRect(start.x, start.y, p.x - start.x, p.y - start.y);
  };
  canvas.onpointerup = (e) => {
    if (!start) return;
    const p = point(e),
      ctx = canvas.getContext("2d");
    ctx.putImageData(snapshot, 0, 0);
    const x = Math.min(start.x, p.x),
      y = Math.min(start.y, p.y),
      w = Math.abs(start.x - p.x),
      height = Math.abs(start.y - p.y);
    if (w > 5 && height > 5) {
      const image = ctx.getImageData(x, y, w, height);
      canvas.width = w;
      canvas.height = height;
      ctx.putImageData(image, 0, 0);
    }
    start = null;
  };
  return win;
}
