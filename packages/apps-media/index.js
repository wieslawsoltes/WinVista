import {
  basename,
  dirname,
  extension,
  joinPath,
  contentURL,
  downloadBlob,
  formatBytes,
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
} from "../ui/index.js";

export function launch(d, id, args = {}) {
  if (id === "ie") return browser(d, args);
  if (id === "media") return mediaPlayer(d, args);
  if (id === "photo") return photoGallery(d, args);
  if (id === "mediacenter") return mediaCenter(d);
  if (id === "soundrecorder") return recorder(d);
  if (id === "movie" || id === "dvd") return movieMaker(d, id);
}
function safeURL(value) {
  const input = value.trim();
  if (input === "about:blank" || input === "about:home") return input;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : "https://" + input);
  } catch {
    return null;
  }
  return ["https:", "http:"].includes(url.protocol) ? url.href : null;
}

function browser(d, args = {}) {
  const win = d.wm.create({
      title: "Windows Internet Explorer",
      icon: "ie",
      appId: "ie",
      width: 900,
      height: 600,
      remember: true,
    }),
    address = h("input", {
      class: "vista-input",
      "aria-label": "Address",
      value: "",
    }),
    tabbar = h("div", { class: "browser-tabs" }),
    content = h("div", { class: "browser-content" }),
    status = statusBar("Done", "Internet | Protected Mode: On");
  let tabs = [{ id: 1, url: "about:home", history: ["about:home"], index: 0 }],
    active = 1,
    nextId = 2;
  const tab = () => tabs.find((t) => t.id === active);
  const navigate = (value, record = true) => {
    let url = safeURL(value);
    if (!url) {
      d.dialog.error(new Error("Enter a valid web address."));
      return;
    }
    const current = tab();
    current.url = url;
    if (record) {
      current.history = current.history.slice(0, current.index + 1);
      current.history.push(url);
      current.index = current.history.length - 1;
    }
    render();
  };
  const back = button(
      "‹",
      () => {
        const t = tab();
        if (t.index > 0) {
          t.index--;
          navigate(t.history[t.index], false);
        }
      },
      "nav-button",
      { "aria-label": "Back" },
    ),
    forward = button(
      "›",
      () => {
        const t = tab();
        if (t.index < t.history.length - 1) {
          t.index++;
          navigate(t.history[t.index], false);
        }
      },
      "nav-button",
      { "aria-label": "Forward" },
    );
  const openExternal = (url) =>
    window.open(url, "_blank", "noopener,noreferrer");
  const searchWeb = (query) => {
    if (query.trim())
      navigate("https://www.bing.com/search?q=" + encodeURIComponent(query));
  };
  const favorites = () => {
    const items = d.settings.get("favorites", [
      { title: "Microsoft", url: "https://www.microsoft.com" },
      { title: "Wikipedia", url: "https://www.wikipedia.org" },
    ]);
    const winFav = d.wm.create({
      title: "Favorites Center",
      icon: "favorites",
      appId: "favorites",
      width: 375,
      height: 370,
    });
    const list = h("div", {
      class: "explorer-sidebar",
      style: { width: "100%", flex: "1" },
    });
    for (const item of items)
      list.append(
        button(
          [icon("ie", 24), item.title],
          () => {
            navigate(item.url);
            winFav.close();
          },
          "explorer-side-link",
        ),
      );
    list.append(
      button(
        "Add Current Page",
        async () => {
          const title = await d.dialog.prompt(
            "Add a Favorite",
            "Name:",
            tab().url,
          );
          if (title) {
            d.settings.set("favorites", [...items, { title, url: tab().url }]);
            winFav.close();
          }
        },
        "vista-button",
        { style: { margin: "15px" } },
      ),
    );
    winFav.body.append(list);
  };
  function home() {
    const input = h("input", {
        class: "vista-input",
        placeholder: "Search the web",
        "aria-label": "Search the web",
      }),
      form = h(
        "form",
        {
          class: "browser-search",
          onsubmit: (e) => {
            e.preventDefault();
            searchWeb(input.value);
          },
        },
        input,
        h("button", { class: "vista-button", type: "submit" }, "Search"),
      );
    return h(
      "div",
      { class: "browser-home" },
      h(
        "div",
        { class: "browser-brand" },
        icon("ie", 64),
        h("span", {}, "Windows Internet Explorer"),
      ),
      h("h2", {}, "Welcome to your browser"),
      h(
        "p",
        {},
        "Find something new, visit your favorite websites, or start with a search.",
      ),
      form,
      h("h2", {}, "Explore"),
      h(
        "div",
        { class: "browser-links" },
        button(
          [icon("ie", 32), "Microsoft"],
          () => navigate("https://www.microsoft.com"),
          "browser-tile",
        ),
        button(
          [icon("search", 32), "Wikipedia"],
          () => navigate("https://www.wikipedia.org"),
          "browser-tile",
        ),
        button(
          [icon("help", 32), "Windows Help"],
          () => d.open("help"),
          "browser-tile",
        ),
      ),
      h(
        "p",
        {},
        "Enter a website in the address bar above. Use Favorites to save the places you visit.",
      ),
    );
  }
  function render() {
    const t = tab();
    address.value = t.url === "about:home" ? "" : t.url;
    address.placeholder = "Enter a web address";
    back.disabled = t.index === 0;
    forward.disabled = t.index === t.history.length - 1;
    tabbar.replaceChildren();
    for (const row of tabs) {
      const title =
        row.url === "about:home"
          ? "Home"
          : row.url === "about:blank"
            ? "Blank Page"
            : new URL(row.url).hostname;
      const b = button(
        [icon("ie", 16), h("span", {}, title)],
        () => {
          active = row.id;
          render();
        },
        "browser-tab" + (row.id === active ? " active" : ""),
      );
      const close = button(
        "×",
        (e) => {
          e.stopPropagation();
          if (tabs.length === 1) {
            row.url = "about:home";
            row.history = ["about:home"];
            row.index = 0;
          } else {
            tabs = tabs.filter((x) => x.id !== row.id);
            if (active === row.id) active = tabs.at(-1).id;
          }
          render();
        },
        "browser-tab-close",
        { "aria-label": "Close tab" },
      );
      b.append(close);
      tabbar.append(b);
    }
    tabbar.append(
      button(
        "+",
        () => {
          const id = nextId++;
          tabs.push({
            id,
            url: "about:home",
            history: ["about:home"],
            index: 0,
          });
          active = id;
          render();
        },
        "toolbar-button",
        { "aria-label": "New tab" },
      ),
    );
    content.replaceChildren();
    if (t.url === "about:home") content.append(home());
    else if (t.url !== "about:blank") {
      const notice = h(
        "div",
        { class: "browser-notice" },
        h("span", {}, "Some websites require a separate browser tab."),
        button("Open in browser tab", () => openExternal(t.url), "link-button"),
      );
      const frame = h("iframe", {
        src: t.url,
        title: "Website: " + t.url,
        sandbox: "allow-scripts allow-forms allow-popups allow-downloads",
        referrerpolicy: "no-referrer",
      });
      frame.style.height = "calc(100% - 29px)";
      frame.onload = () => (status.firstChild.textContent = "Done");
      content.append(notice, frame);
    }
    win.setTitle(
      (t.url === "about:home"
        ? "Home"
        : t.url === "about:blank"
          ? "Blank Page"
          : new URL(t.url).hostname) + " - Windows Internet Explorer",
    );
    status.firstChild.textContent = t.url.startsWith("about:")
      ? "Done"
      : "Opening " + t.url;
  }
  address.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = address.value;
      if (value.includes(" ") && !value.includes(".")) searchWeb(value);
      else navigate(value || "about:home");
    }
  };
  win.body.append(
    h(
      "div",
      { class: "browser-address" },
      back,
      forward,
      address,
      button("↻", render, "toolbar-button", {
        title: "Refresh",
        "aria-label": "Refresh",
      }),
    ),
    menuBar([
      {
        label: "File",
        items: [
          {
            label: "New Tab",
            shortcut: "Ctrl+T",
            action: () => {
              const id = nextId++;
              tabs.push({
                id,
                url: "about:home",
                history: ["about:home"],
                index: 0,
              });
              active = id;
              render();
            },
          },
          { label: "New Window", action: () => d.open("ie") },
          {
            label: "Open in Browser",
            action: () => {
              if (!tab().url.startsWith("about:")) openExternal(tab().url);
            },
          },
          { label: "Print…", action: () => window.print() },
          { label: "Close", action: () => win.close() },
        ],
      },
      {
        label: "Edit",
        items: [
          {
            label: "Copy Address",
            action: () => navigator.clipboard?.writeText(tab().url),
          },
          {
            label: "Select Address",
            action: () => {
              address.focus();
              address.select();
            },
          },
        ],
      },
      {
        label: "View",
        items: [
          { label: "Refresh", action: render },
          { label: "Full Screen", action: () => d.wm.maximize(win) },
        ],
      },
      {
        label: "Favorites",
        items: [{ label: "Favorites Center", action: favorites }],
      },
      {
        label: "Tools",
        items: [
          {
            label: "Internet Options",
            action: () =>
              d.dialog.message(
                "Internet Options",
                "Browser tabs run in an isolated frame.\nHistory and Favorites are stored locally.\nWebsite support depends on the site’s framing policy and the host browser.",
              ),
          },
        ],
      },
    ]),
    h(
      "div",
      { class: "toolbar" },
      tool("Favorites", "favorites", favorites),
      tool("Home", "ie", () => navigate("about:home")),
      h("span", { class: "spacer" }),
      tool("Page", "documents", () => openExternal(tab().url)),
      tool("Tools", "control", () => d.open("control")),
    ),
    tabbar,
    content,
    status,
  );
  win.el.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
      e.preventDefault();
      address.focus();
      address.select();
    }
  });
  render();
  if (args.url) navigate(args.url);
  return win;
}

function createWave() {
  const rate = 22050,
    seconds = 18,
    frames = rate * seconds,
    buffer = new ArrayBuffer(44 + frames * 2),
    view = new DataView(buffer),
    write = (offset, text) =>
      [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  write(0, "RIFF");
  view.setUint32(4, 36 + frames * 2, true);
  write(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, frames * 2, true);
  const chords = [
    [261.63, 329.63, 392],
    [220, 261.63, 329.63],
    [174.61, 220, 261.63],
    [196, 246.94, 293.66],
  ];
  for (let i = 0; i < frames; i++) {
    const t = i / rate,
      c = chords[Math.floor(t / 4.5) % 4],
      local = t % 4.5,
      env = Math.min(1, local / 0.2) * Math.min(1, (4.5 - local) / 0.6),
      fade = Math.min(1, t / 0.7, (seconds - t) / 1.5);
    let sample = 0;
    for (const f of c)
      sample +=
        (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(4 * Math.PI * f * t)) *
        0.1;
    sample +=
      Math.sin(2 * Math.PI * c[Math.floor(local * 2) % 3] * 2 * t) *
      0.035 *
      Math.exp(-(local % 0.5) * 7);
    view.setInt16(
      44 + i * 2,
      Math.max(-32768, Math.min(32767, sample * env * fade * 32767)),
      true,
    );
  }
  return new Blob([buffer], { type: "audio/wav" });
}
function seedMusic(d) {
  if (!d.fs.exists("C:/Users/User/Music/Morning Light.wav"))
    d.fs.write(
      "C:/Users/User/Music/Morning Light.wav",
      createWave(),
      "audio/wav",
    );
}
function mediaPlayer(d, args = {}) {
  seedMusic(d);
  const win = d.wm.create({
      title: "Windows Media Player",
      icon: "media",
      appId: "media",
      width: 845,
      height: 585,
      remember: true,
    }),
    body = h("div", { class: "media-body" }),
    nav = h("div", { class: "media-nav" }),
    library = h("div", { class: "media-library" }),
    stage = h("div", { class: "media-stage" }),
    media = h("video", { playsinline: "", preload: "metadata" }),
    controls = h("div", { class: "media-controls" }),
    play = button("▶", () => toggle(), "play-button", { "aria-label": "Play" }),
    seek = h("input", {
      type: "range",
      min: 0,
      max: 1000,
      value: 0,
      "aria-label": "Playback position",
    }),
    clock = h("span", { class: "media-time" }, "0:00 / 0:00"),
    volume = h("input", {
      class: "media-volume",
      type: "range",
      min: 0,
      max: 100,
      value: d.volume,
      "aria-label": "Volume",
    });
  let current = null,
    release = null,
    view = "now",
    repeat = false,
    shuffled = false,
    playlist = [],
    ended = false;
  const time = (seconds) =>
    `${Math.floor((seconds || 0) / 60)}:${String(Math.floor((seconds || 0) % 60)).padStart(2, "0")}`;
  const tracks = () =>
    [...d.fs.entries.values()].filter(
      (e) =>
        e.kind === "file" &&
        !e.key.startsWith("c:/$recycle.bin/") &&
        (/^(audio|video)\//.test(e.mime || "") ||
          ["wav", "mp3", "mp4", "webm", "ogg", "m4a", "flac", "mov"].includes(
            extension(e.name),
          )),
    );
  const load = async (path, autoplay = true) => {
    const entry = d.fs.stat(path);
    if (!entry) return;
    release?.();
    const source = contentURL(entry);
    release = () => {
      if (source.release) URL.revokeObjectURL(source.url);
    };
    current = path;
    media.src = source.url;
    media.volume = d.volume / 100;
    media.muted = d.muted;
    ended = false;
    win.setTitle(basename(path) + " - Windows Media Player");
    render();
    if (autoplay)
      try {
        await media.play();
      } catch {
        play.textContent = "▶";
      }
  };
  const toggle = () => {
    if (!current) {
      const list = tracks();
      if (list.length) load(list[0].path);
      return;
    }
    if (media.paused) media.play().catch((e) => d.dialog.error(e));
    else media.pause();
  };
  const skip = (direction) => {
    const list = playlist.length
      ? playlist.map((p) => d.fs.stat(p)).filter(Boolean)
      : tracks();
    if (!list.length) return;
    const index = list.findIndex((e) => e.path === current),
      next = shuffled
        ? Math.floor(Math.random() * list.length)
        : (index + direction + list.length) % list.length;
    load(list[next].path);
  };
  function render() {
    nav.replaceChildren();
    for (const [label, id] of [
      ["Now Playing", "now"],
      ["Library", "library"],
      ["Burn", "burn"],
      ["Sync", "sync"],
    ])
      nav.append(
        button(
          label,
          () => {
            view = id;
            render();
          },
          view === id ? "active" : "",
        ),
      );
    library.replaceChildren(
      tool("Music", "music", () => {
        view = "library";
        render();
      }),
      tool("Videos", "videos", () => {
        view = "library";
        render();
      }),
      tool("Import media…", "folder", async () => {
        const added = await d.importFiles(
          "C:/Users/User/Music",
          "audio/*,video/*",
        );
        render();
        if (added[0]) load(added[0]);
      }),
      tool("Open file…", "folder", async () => {
        const path = await d.dialog.file({ path: "C:/Users/User/Music" });
        if (path) load(path);
      }),
      tool("Save playlist", "documents", async () => {
        const path = await d.dialog.file({
          mode: "save",
          name: "Playlist.m3u",
          path: "C:/Users/User/Music",
        });
        if (path) {
          d.fs.write(
            path,
            "#EXTM3U\n" +
              tracks()
                .map((e) => e.path)
                .join("\n"),
            "audio/x-mpegurl",
          );
          d.toast("Playlist saved", basename(path));
        }
      }),
    );
    stage.replaceChildren();
    if (view === "now") {
      stage.append(media);
      if (!current) {
        media.style.display = "none";
        stage.append(
          h(
            "div",
            { class: "media-placeholder" },
            icon("media", 96),
            h("h2", {}, "Windows Media Player"),
            h("div", {}, "Your music. Your movies. Your way."),
            button(
              "Play Morning Light",
              () => load("C:/Users/User/Music/Morning Light.wav"),
              "vista-button",
            ),
          ),
        );
      } else {
        media.style.display = /\.(mp4|webm|mov)$/i.test(current)
          ? "block"
          : "none";
        if (media.style.display === "none")
          stage.append(
            h(
              "div",
              { class: "media-placeholder" },
              icon("media", 112),
              h("h2", {}, basename(current).replace(/\.[^.]+$/, "")),
              h("div", {}, "Unknown artist"),
              h(
                "div",
                { class: "audio-bars" },
                ...Array.from({ length: 28 }, (_, i) =>
                  h("span", {
                    style: {
                      height: 10 + ((i * 17) % 54) + "px",
                      animationDelay: i * 0.06 + "s",
                      animationPlayState: media.paused ? "paused" : "running",
                    },
                  }),
                ),
              ),
            ),
          );
      }
    } else if (view === "library") {
      const list = h("div", { class: "media-tracks" });
      for (const entry of tracks())
        list.append(
          button(
            [
              icon(entry.mime?.startsWith("video") ? "videos" : "media", 32),
              h("span", {}, entry.name),
              h("span", { class: "spacer" }),
              h(
                "small",
                {},
                entry.content instanceof Blob
                  ? formatBytes(entry.content.size)
                  : "",
              ),
            ],
            () => {
              view = "now";
              load(entry.path);
            },
            "media-track" + (entry.path === current ? " active" : ""),
          ),
        );
      stage.append(list);
    } else
      stage.append(
        h(
          "div",
          {
            class: "media-placeholder",
            style: { padding: "35px", textAlign: "center" },
          },
          icon(view === "burn" ? "media" : "computer", 72),
          h(
            "h2",
            {},
            view === "burn"
              ? "Create a media collection"
              : "Take your media with you",
          ),
          h(
            "p",
            {},
            view === "burn"
              ? "Export your original media files. Burning an optical disc requires a native disc-writing application."
              : "Choose files to download to your device.",
          ),
          button(
            "Export current media",
            async () => {
              if (current)
                downloadBlob(await d.fs.exportBlob(current), basename(current));
              else
                d.dialog.message(
                  "Windows Media Player",
                  "Open a media file first.",
                );
            },
            "vista-button",
          ),
        ),
      );
  }
  controls.append(
    button(
      "↶",
      () => {
        repeat = !repeat;
        media.loop = repeat;
      },
      "media-control",
      { title: "Repeat", "aria-label": "Repeat" },
    ),
    button("◀◀", () => skip(-1), "media-control", {
      "aria-label": "Previous track",
    }),
    play,
    button("▶▶", () => skip(1), "media-control", {
      "aria-label": "Next track",
    }),
    button(
      "■",
      () => {
        media.pause();
        media.currentTime = 0;
      },
      "media-control",
      { "aria-label": "Stop" },
    ),
    h("div", { class: "media-timeline" }, seek, clock),
    h("span", {}, "◖))"),
    volume,
  );
  seek.oninput = () => {
    if (Number.isFinite(media.duration))
      media.currentTime = (Number(seek.value) / 1000) * media.duration;
  };
  volume.oninput = () => d.settings.set("volume", Number(volume.value));
  media.ontimeupdate = () => {
    seek.value = Number.isFinite(media.duration)
      ? String((media.currentTime / media.duration) * 1000)
      : "0";
    clock.textContent = time(media.currentTime) + " / " + time(media.duration);
  };
  media.onplay = () => {
    play.textContent = "❚❚";
    play.setAttribute("aria-label", "Pause");
    stage
      .querySelectorAll(".audio-bars span")
      .forEach((n) => (n.style.animationPlayState = "running"));
  };
  media.onpause = () => {
    play.textContent = "▶";
    play.setAttribute("aria-label", "Play");
    stage
      .querySelectorAll(".audio-bars span")
      .forEach((n) => (n.style.animationPlayState = "paused"));
  };
  media.onended = () => {
    if (!repeat) skip(1);
  };
  media.onerror = () => {
    if (current)
      d.toast(
        "Cannot play this file",
        "The format may not be supported by your browser. Try WAV, MP3, MP4, or WebM.",
        "media",
      );
  };
  d.settings.on(
    "change",
    ({ key }) => {
      if (key === "volume") media.volume = d.volume / 100;
      if (key === "muted") media.muted = d.muted;
    },
    win.signal,
  );
  d.fs.on(
    "change",
    () => {
      if (view === "library") render();
    },
    win.signal,
  );
  body.append(
    nav,
    h("div", { class: "media-center" }, library, stage),
    controls,
  );
  win.body.append(body);
  win.onCleanup(() => {
    media.pause();
    media.removeAttribute("src");
    media.load();
    release?.();
  });
  render();
  if (args.path) load(args.path);
  return win;
}

function photoGallery(d, args = {}) {
  const win = d.wm.create({
      title: "Windows Photo Gallery",
      icon: "pictures",
      appId: "photo",
      width: 900,
      height: 625,
      remember: true,
    }),
    list = h("div", { class: "photo-list" }),
    stage = h("div", { class: "photo-stage" }),
    img = h("img", { alt: "Selected photograph" }),
    status = statusBar(""),
    controls = h("div", { class: "toolbar photo-controls" });
  let selected = args.path || null,
    angle = 0,
    scale = 1,
    slideshow = null,
    urls = new Map(),
    version = 0;
  const entries = () =>
    [...d.fs.entries.values()].filter(
      (e) =>
        e.kind === "file" &&
        !e.key.startsWith("c:/$recycle.bin/") &&
        (/image\//.test(e.mime) ||
          ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(
            extension(e.name),
          )),
    );
  const url = (e) => {
    const key = e.id + ":" + e.modified;
    if (!urls.has(key)) urls.set(key, contentURL(e));
    return urls.get(key).url;
  };
  const load = (path) => {
    version++;
    selected = path;
    angle = 0;
    scale = 1;
    const e = d.fs.stat(path);
    if (!e) {
      selected = null;
      img.removeAttribute("src");
      stage.replaceChildren(h("p", {}, "Import photos to get started."));
      status.textContent = "No photos";
      win.setTitle("Windows Photo Gallery");
      renderList();
      return;
    }
    img.src = url(e);
    img.alt = e.name;
    img.style.transform = "";
    stage.replaceChildren(img);
    win.setTitle(e.name + " - Windows Photo Gallery");
    renderList();
    status.textContent = e.name;
  };
  const renderList = () => {
    list.replaceChildren();
    const files = entries();
    for (const e of files)
      list.append(
        button(
          [h("img", { src: url(e), alt: "" }), h("span", {}, e.name)],
          () => load(e.path),
          e.path === selected ? "selected" : "",
        ),
      );
  };
  const next = (delta) => {
    const files = entries();
    if (!files.length) return;
    const i = files.findIndex((e) => e.path === selected);
    load(files[(i + delta + files.length) % files.length].path);
  };
  const saveCopy = async (filterMode = null) => {
    const revision = version;
    if (!img.complete || !img.naturalWidth) return;
    const source = document.createElement("canvas"),
      a = angle % 180 !== 0;
    source.width = a ? img.naturalHeight : img.naturalWidth;
    source.height = a ? img.naturalWidth : img.naturalHeight;
    const ctx = source.getContext("2d");
    ctx.translate(source.width / 2, source.height / 2);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    if (filterMode != null) {
      const result = await d.renderer.filter(
        ctx.getImageData(0, 0, source.width, source.height),
        filterMode,
      );
      if (version !== revision) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.putImageData(result, 0, 0);
    }
    const path = await d.dialog.file({
      mode: "save",
      path: "C:/Users/User/Pictures",
      name: basename(selected).replace(/\.[^.]+$/, "") + " - edited.png",
    });
    if (path) {
      d.fs.write(
        path,
        await new Promise((resolve) => source.toBlob(resolve, "image/png")),
        "image/png",
      );
      await d.fs.flush();
      load(path);
    }
  };
  const toggleSlide = () => {
    if (slideshow) {
      clearInterval(slideshow);
      slideshow = null;
      list.hidden = false;
    } else {
      list.hidden = true;
      slideshow = setInterval(() => next(1), 3500);
    }
  };
  win.body.append(
    menuBar([
      {
        label: "File",
        items: [
          {
            label: "Import…",
            action: async () => {
              const paths = await d.importFiles(
                "C:/Users/User/Pictures",
                "image/*",
              );
              if (paths[0]) load(paths[0]);
            },
          },
          { label: "Save a Copy…", action: () => saveCopy() },
          {
            label: "Download",
            action: async () => {
              if (selected)
                downloadBlob(
                  await d.fs.exportBlob(selected),
                  basename(selected),
                );
            },
          },
          { label: "Print…", action: () => window.print() },
          { label: "Exit", action: () => win.close() },
        ],
      },
      {
        label: "Fix",
        items: [
          {
            label: "Rotate Clockwise",
            action: () => {
              angle += 90;
              img.style.transform = `rotate(${angle}deg) scale(${scale})`;
            },
          },
          { label: "Black and White", action: () => saveCopy(1) },
          { label: "Sepia", action: () => saveCopy(2) },
          { label: "Invert Colors", action: () => saveCopy(0) },
        ],
      },
      {
        label: "View",
        items: [
          { label: "Slide Show", shortcut: "F11", action: toggleSlide },
          {
            label: "Zoom In",
            action: () => {
              scale = Math.min(4, scale + 0.25);
              img.style.transform = `rotate(${angle}deg) scale(${scale})`;
            },
          },
          {
            label: "Actual Size",
            action: () => {
              img.style.maxWidth = "none";
              img.style.maxHeight = "none";
            },
          },
          {
            label: "Fit to Window",
            action: () => {
              scale = 1;
              img.style.transform = `rotate(${angle}deg)`;
              img.style.maxWidth = "100%";
              img.style.maxHeight = "100%";
            },
          },
        ],
      },
    ]),
    h(
      "div",
      { class: "toolbar" },
      tool("File", "folder", async () => {
        const path = await d.dialog.file({ path: "C:/Users/User/Pictures" });
        if (path) load(path);
      }),
      tool("Fix", "pictures", () => saveCopy()),
      tool("Print", "documents", () => window.print()),
      tool("Open in Paint", "paint", () => {
        if (selected) d.open("paint", { path: selected });
      }),
      h("span", { class: "spacer" }),
      tool("Info", "help", () => {
        if (selected) {
          const e = d.fs.stat(selected);
          if (!e) return;
          d.dialog.message(
            "Photo Information",
            `${e.name}\n${img.naturalWidth} × ${img.naturalHeight} pixels\nCreated: ${new Date(e.created).toLocaleString()}`,
          );
        }
      }),
    ),
    h("div", { class: "photo-gallery" }, list, stage),
    controls,
    status,
  );
  controls.append(
    button("◀", () => next(-1), "toolbar-button", {
      "aria-label": "Previous photo",
    }),
    button("▶  Slide Show", toggleSlide, "vista-button"),
    button("▶", () => next(1), "toolbar-button", {
      "aria-label": "Next photo",
    }),
    button(
      "↶",
      () => {
        angle -= 90;
        img.style.transform = `rotate(${angle}deg) scale(${scale})`;
      },
      "toolbar-button",
      { "aria-label": "Rotate counterclockwise" },
    ),
    button(
      "↷",
      () => {
        angle += 90;
        img.style.transform = `rotate(${angle}deg) scale(${scale})`;
      },
      "toolbar-button",
      { "aria-label": "Rotate clockwise" },
    ),
    button(
      "×",
      async () => {
        const target = selected;
        if (!target) return;
        if (slideshow) toggleSlide();
        if (d.fs.key(target).startsWith("c:/$recycle.bin/")) {
          d.dialog.message(
            "Photo Gallery",
            "Restore this photo from the Recycle Bin before editing it.",
          );
          return;
        }
        if (
          await d.dialog.confirm(
            "Delete Photo",
            "Move this photo to the Recycle Bin?",
          )
        ) {
          d.fs.remove(target);
          const remaining = entries();
          load(remaining[0]?.path || "");
          d.playSound("recycle");
        }
      },
      "toolbar-button",
      { "aria-label": "Delete photo" },
    ),
  );
  d.fs.on(
    "change",
    () => {
      if (selected && !entries().some((e) => e.path === selected))
        load(entries()[0]?.path || "");
      else renderList();
    },
    win.signal,
  );
  win.onCleanup(() => {
    clearInterval(slideshow);
    for (const source of urls.values())
      if (source.release) URL.revokeObjectURL(source.url);
  });
  win.el.onkeydown = (e) => {
    if (e.key === "ArrowRight") next(1);
    if (e.key === "ArrowLeft") next(-1);
    if (e.key === "F11") {
      e.preventDefault();
      toggleSlide();
    }
  };
  const photos = entries();
  if (selected && d.fs.exists(selected)) load(selected);
  else if (photos[0]) load(photos[0].path);
  else stage.append(h("p", {}, "Import photos to get started."));
  return win;
}

function mediaCenter(d) {
  const win = d.wm.create({
      title: "Windows Media Center",
      icon: "media",
      appId: "mediacenter",
      width: 910,
      height: 570,
      remember: true,
    }),
    body = h(
      "div",
      { class: "media-center-home" },
      h("h1", {}, "Windows Media Center"),
    );
  for (const [label, ico, action] of [
    ["pictures + videos", "pictures", () => d.open("photo")],
    ["music", "music", () => d.open("media")],
    ["movies", "videos", () => d.open("media")],
    ["tasks", "control", () => d.open("control")],
    ["Online Media", "ie", () => d.open("ie")],
  ])
    body.append(button([icon(ico, 48), label], action, "media-center-option"));
  win.body.append(body);
  return win;
}

function recorder(d) {
  const win = d.wm.create({
      title: "Sound Recorder",
      icon: "media",
      appId: "soundrecorder",
      width: 405,
      height: 185,
      resizable: false,
    }),
    body = h("div", { class: "recorder-body" }),
    record = button("●  Start Recording", () => toggle(), "vista-button"),
    time = h("span", { class: "recorder-time" }, "00:00:00"),
    meter = h("div", { class: "record-meter" }),
    save = button("Save As…", () => saveClip(), "vista-button", {
      disabled: true,
    });
  let state = "idle",
    session = null,
    clip = null,
    serial = 0;
  function release(s) {
    if (!s) return;
    s.stream?.getTracks().forEach((t) => t.stop());
    cancelAnimationFrame(s.frame);
    clearInterval(s.clock);
    s.context?.close().catch(() => {});
  }
  function update() {
    record.disabled = state === "requesting" || state === "stopping";
    record.textContent =
      state === "recording"
        ? "■  Stop Recording"
        : state === "requesting"
          ? "Opening microphone…"
          : state === "stopping"
            ? "Finishing recording…"
            : "●  Start Recording";
    save.disabled = !clip || state !== "idle";
    win.recording = state !== "idle";
  }
  async function toggle() {
    if (state === "recording") {
      state = "stopping";
      update();
      session.rec.stop();
      return;
    }
    if (state !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      d.dialog.message(
        "Sound Recorder",
        "Microphone recording is unavailable in this browser.",
      );
      return;
    }
    if (win.dirty && !(await confirmRecording())) return;
    const token = ++serial,
      s = {
        stream: null,
        rec: null,
        chunks: [],
        clock: null,
        frame: 0,
        context: null,
      };
    session = s;
    state = "requesting";
    update();
    try {
      s.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (win.closed || token !== serial) {
        release(s);
        return;
      }
      const type = [
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ].find((t) => MediaRecorder.isTypeSupported(t));
      s.rec = new MediaRecorder(s.stream, type ? { mimeType: type } : {});
      s.rec.ondataavailable = (e) => {
        if (e.data.size) s.chunks.push(e.data);
      };
      s.rec.onstop = () => {
        release(s);
        if (win.closed || token !== serial) return;
        clip = new Blob(s.chunks, { type: s.rec.mimeType });
        win.dirty = true;
        state = "idle";
        session = null;
        update();
      };
      s.rec.onerror = (event) => {
        release(s);
        if (win.closed || token !== serial) return;
        state = "idle";
        session = null;
        update();
        d.dialog.error(
          event.error || new Error("The microphone recording failed."),
        );
      };
      s.rec.start(200);
      state = "recording";
      update();
      const started = Date.now();
      s.clock = setInterval(() => {
        const t = Math.floor((Date.now() - started) / 1000);
        time.textContent = [
          Math.floor(t / 3600),
          Math.floor(t / 60) % 60,
          t % 60,
        ]
          .map((n) => String(n).padStart(2, "0"))
          .join(":");
      }, 200);
      try {
        s.context = new AudioContext();
        const analyser = s.context.createAnalyser();
        s.context.createMediaStreamSource(s.stream).connect(analyser);
        const values = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (win.closed || token !== serial || state !== "recording") return;
          analyser.getByteFrequencyData(values);
          meter.style.setProperty(
            "--level",
            Math.min(
              100,
              Math.round(
                (values.reduce((n, v) => n + v, 0) / values.length / 255) * 300,
              ),
            ) + "%",
          );
          s.frame = requestAnimationFrame(tick);
        };
        tick();
      } catch {}
    } catch (error) {
      release(s);
      if (win.closed || token !== serial) return;
      state = "idle";
      session = null;
      update();
      if (error.name !== "NotAllowedError") d.dialog.error(error);
    }
  }
  async function saveClip() {
    const saved = clip;
    if (!saved) return false;
    const ext = saved.type.includes("ogg")
        ? "ogg"
        : saved.type.includes("mp4")
          ? "m4a"
          : "webm",
      path = await d.dialog.file({
        mode: "save",
        path: "C:/Users/User/Music",
        name: "Recording." + ext,
      });
    if (!path) return false;
    try {
      d.fs.write(path, saved, saved.type);
      await d.fs.flush();
      if (clip === saved) win.dirty = false;
      d.toast("Recording saved", basename(path), "media");
      return true;
    } catch (error) {
      d.dialog.error(error);
      return false;
    }
  }
  async function confirmRecording() {
    if (!win.dirty) return true;
    const choice = await d.dialog.message(
      "Sound Recorder",
      "Save this recording?",
      {
        buttons: [
          { label: "Save", value: "save", primary: true },
          { label: "Discard", value: "discard" },
          { label: "Cancel", value: null },
        ],
      },
    );
    return (
      choice === "discard" ||
      (choice === "save" && (await saveClip()) && !win.dirty)
    );
  }
  win.beforeClose = async () => {
    if (state === "recording" || state === "stopping") {
      d.dialog.message(
        "Sound Recorder",
        "Stop the recording before closing this window.",
      );
      return false;
    }
    return confirmRecording();
  };
  body.append(record, meter, time, save);
  win.body.append(body);
  win.onCleanup(() => {
    serial++;
    const s = session;
    if (s?.rec?.state === "recording") s.rec.stop();
    release(s);
    session = null;
  });
  update();
  return win;
}

function movieMaker(d, id) {
  const dvd = id === "dvd",
    title = dvd ? "Windows DVD Maker" : "Windows Movie Maker",
    win = d.wm.create({
      title,
      icon: "videos",
      appId: id,
      width: 960,
      height: 650,
      remember: true,
    }),
    stage = h("div", { class: "movie-stage" }),
    library = h("div", { class: "movie-library" }),
    preview = h("div", { class: "movie-preview" }),
    timeline = h("div", { class: "movie-timeline" }),
    status = statusBar("Import pictures, audio, or videos to create a movie.");
  let clips = [],
    current = -1,
    previewSource = null,
    projectName = dvd ? "My DVD" : "My Movie",
    exporting = false,
    aborted = false,
    exportCleanup = null,
    revision = 0;
  const mark = () => {
    revision++;
    win.dirty = true;
  };
  const render = () => {
    library.replaceChildren(
      h("h2", {}, dvd ? "DVD contents" : "Collections"),
      button("Import Media…", importMedia, "vista-button"),
    );
    timeline.replaceChildren();
    clips.forEach((clip, index) => {
      const entry = d.fs.stat(clip.path),
        tile = button(
          [
            icon(entry?.mime?.startsWith("image") ? "pictures" : "videos", 40),
            h("span", {}, basename(clip.path)),
            h("small", {}, clip.duration + " sec"),
          ],
          () => {
            current = index;
            showClip();
            render();
          },
          "movie-clip" + (index === current ? " active" : ""),
          { draggable: true },
        );
      tile.ondragstart = (e) =>
        e.dataTransfer.setData("text/x-vista-clip", String(index));
      tile.ondragover = (e) => e.preventDefault();
      tile.ondrop = (e) => {
        e.preventDefault();
        const from = Number(e.dataTransfer.getData("text/x-vista-clip"));
        if (Number.isInteger(from) && from >= 0 && from < clips.length) {
          const [moved] = clips.splice(from, 1);
          clips.splice(index, 0, moved);
          current = index;
          mark();
          render();
        }
      };
      timeline.append(tile);
      library.append(
        button(
          [
            icon(entry?.mime?.startsWith("image") ? "pictures" : "videos", 24),
            basename(clip.path),
          ],
          () => {
            current = index;
            showClip();
            render();
          },
          "explorer-side-link",
        ),
      );
    });
    if (!clips.length)
      timeline.append(
        h(
          "div",
          { class: "movie-empty" },
          "Drag imported clips here by adding media.",
        ),
      );
    status.textContent = `${clips.length} clips · ${clips.reduce((s, c) => s + c.duration, 0).toFixed(1)} seconds · ${projectName}`;
  };
  const importMedia = async () => {
    const files = await chooseFiles({
      multiple: true,
      accept: "image/*,video/*,audio/*",
    });
    if (!files.length) return;
    const paths = await d.fs.importFiles(files, "C:/Users/User/Videos");
    for (const path of paths) {
      const entry = d.fs.stat(path);
      let duration = 5;
      if (!entry.mime.startsWith("image")) {
        const source = contentURL(entry),
          video = document.createElement("video");
        video.src = source.url;
        try {
          await new Promise((resolve, reject) => {
            video.onloadedmetadata = resolve;
            video.onerror = reject;
          });
          duration = Number.isFinite(video.duration)
            ? Math.min(video.duration, 60)
            : 5;
        } catch {}
        if (source.release) URL.revokeObjectURL(source.url);
      }
      clips.push({ path, start: 0, duration, transition: "fade" });
    }
    current = clips.length - 1;
    showClip();
    render();
    mark();
  };
  const showClip = () => {
    preview.querySelectorAll("video,audio").forEach((v) => v.pause());
    if (previewSource?.release) URL.revokeObjectURL(previewSource.url);
    previewSource = null;
    preview.replaceChildren();
    const clip = clips[current],
      entry = clip && d.fs.stat(clip.path);
    if (!entry) {
      preview.append(
        h(
          "div",
          { class: "media-placeholder" },
          icon("videos", 80),
          h("h2", {}, title),
        ),
      );
      return;
    }
    previewSource = contentURL(entry);
    if (entry.mime.startsWith("image"))
      preview.append(h("img", { src: previewSource.url, alt: entry.name }));
    else {
      const video = h("video", {
        src: previewSource.url,
        controls: "",
        playsinline: "",
      });
      video.onloadedmetadata = () => (video.currentTime = clip.start);
      preview.append(video);
    }
  };
  const editClip = async () => {
    const clip = clips[current];
    if (!clip) return;
    const start = h("input", {
        class: "vista-input",
        type: "number",
        min: 0,
        value: clip.start,
        step: 0.1,
      }),
      duration = h("input", {
        class: "vista-input",
        type: "number",
        min: 0.1,
        max: 600,
        value: clip.duration,
        step: 0.1,
      }),
      transition = h(
        "select",
        { class: "vista-input" },
        h(
          "option",
          { value: "fade", selected: clip.transition === "fade" },
          "Fade",
        ),
        h(
          "option",
          { value: "cut", selected: clip.transition === "cut" },
          "Cut",
        ),
      );
    if (
      await d.dialog.form({
        title: "Clip Properties",
        width: 400,
        body: h(
          "div",
          {},
          field("Start (seconds):", start),
          field("Duration:", duration),
          field("Transition:", transition),
        ),
        buttons: [
          { label: "OK", value: true, primary: true },
          { label: "Cancel", value: false },
        ],
      })
    ) {
      clip.start = Math.max(0, Number(start.value) || 0);
      clip.duration = Math.max(0.1, Math.min(600, Number(duration.value) || 5));
      clip.transition = transition.value;
      showClip();
      render();
      mark();
    }
  };
  const saveProject = async () => {
    const path = await d.dialog.file({
      mode: "save",
      path: "C:/Users/User/Documents",
      name: projectName + ".movie.json",
    });
    if (!path) return false;
    const savedRevision = revision;
    try {
      d.fs.write(
        path,
        JSON.stringify(
          { format: "vista-movie", version: 1, name: projectName, clips },
          null,
          2,
        ),
        "application/json",
      );
      await d.fs.flush();
      win.dirty = savedRevision !== revision;
      d.toast("Project saved", basename(path));
      return true;
    } catch (error) {
      d.dialog.error(error);
      return false;
    }
  };
  const confirmProject = async () => {
    if (!win.dirty) return true;
    const choice = await d.dialog.message(
      title,
      "Save changes to this project?",
      {
        buttons: [
          { label: "Save", value: "save", primary: true },
          { label: "Discard", value: "discard" },
          { label: "Cancel", value: null },
        ],
      },
    );
    return (
      choice === "discard" ||
      (choice === "save" && (await saveProject()) && !win.dirty)
    );
  };
  const fresh = async () => {
    if (!(await confirmProject())) return;
    clips = [];
    current = -1;
    revision++;
    win.dirty = false;
    showClip();
    render();
  };
  const openProject = async () => {
    if (!(await confirmProject())) return;
    const path = await d.dialog.file({ path: "C:/Users/User/Documents" });
    if (!path) return;
    try {
      let content = d.fs.read(path);
      if (content instanceof Blob) content = await content.text();
      const project = JSON.parse(content);
      if (project.format !== "vista-movie" || !Array.isArray(project.clips))
        throw new Error("Choose a Movie Maker project.");
      clips = project.clips
        .filter(
          (c) =>
            typeof c.path === "string" && d.fs.stat(c.path)?.kind === "file",
        )
        .map((c) => ({
          ...c,
          start: Math.max(0, Number(c.start) || 0),
          duration: Math.max(0.1, Math.min(600, Number(c.duration) || 5)),
        }));
      projectName = project.name || "My Movie";
      current = 0;
      revision++;
      win.dirty = false;
      showClip();
      render();
    } catch (e) {
      d.dialog.error(e);
    }
  };
  const exportMovie = async () => {
    if (exporting || !clips.length) return;
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      d.dialog.message(
        title,
        "Video export requires canvas capture and MediaRecorder support. You can still save your editable project.",
      );
      return;
    }
    const type = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ].find((t) => MediaRecorder.isTypeSupported(t));
    if (!type) {
      d.dialog.message(
        title,
        "This browser has no supported video recording encoder.",
      );
      return;
    }
    exporting = true;
    win.recording = true;
    aborted = false;
    const controller = new AbortController(),
      scene = clips.map((c) => ({ ...c }));
    let videoStream = null,
      stream = null,
      audioContext = null,
      rec = null,
      element = null,
      source = null,
      frame = 0,
      recordingError = null;
    const wait = (promise) =>
      new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => done(new Error("A media clip took too long to load.")),
          20000,
        );
        const abort = () => done(new Error("Movie export cancelled."));
        const done = (error, value) => {
          clearTimeout(timeout);
          controller.signal.removeEventListener("abort", abort);
          error ? reject(error) : resolve(value);
        };
        if (controller.signal.aborted) {
          done(new Error("Movie export cancelled."));
          return;
        }
        controller.signal.addEventListener("abort", abort, { once: true });
        Promise.resolve(promise).then((value) => done(null, value), done);
      });
    const releaseElement = () => {
      if (element?.pause) {
        element.pause();
        element.removeAttribute("src");
        element.load();
      }
      element = null;
      if (source?.release) URL.revokeObjectURL(source.url);
      source = null;
    };
    exportCleanup = () => {
      aborted = true;
      controller.abort();
      cancelAnimationFrame(frame);
      if (rec && rec.state !== "inactive")
        try {
          rec.stop();
        } catch {}
      releaseElement();
      stream?.getTracks().forEach((t) => t.stop());
      videoStream?.getTracks().forEach((t) => t.stop());
      audioContext?.close().catch(() => {});
    };
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext("2d"),
        chunks = [];
      videoStream = canvas.captureStream(30);
      audioContext = new AudioContext();
      await wait(audioContext.resume());
      const destination = audioContext.createMediaStreamDestination();
      stream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]);
      rec = new MediaRecorder(stream, {
        mimeType: type,
        videoBitsPerSecond: 3500000,
      });
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onerror = (e) =>
        (recordingError = e.error || new Error("Video encoding failed."));
      const stopped = new Promise((resolve) => (rec.onstop = resolve));
      for (let index = 0; index < scene.length; index++) {
        if (aborted) throw new Error("Movie export cancelled.");
        const clip = scene[index],
          entry = d.fs.stat(clip.path);
        if (!entry)
          throw new Error("A movie clip is missing: " + basename(clip.path));
        source = contentURL(entry);
        const isImage = entry.mime.startsWith("image");
        element = document.createElement(isImage ? "img" : "video");
        if (isImage) {
          element.src = source.url;
          await wait(element.decode());
        } else {
          element.playsInline = true;
          element.preload = "auto";
          await wait(
            new Promise((resolve, reject) => {
              element.onloadedmetadata = resolve;
              element.onerror = () =>
                reject(new Error("A clip could not be decoded."));
              element.src = source.url;
            }),
          );
          if (clip.start > 0) {
            await wait(
              new Promise((resolve) => {
                element.onseeked = resolve;
                element.currentTime = clip.start;
              }),
            );
          }
          audioContext.createMediaElementSource(element).connect(destination);
        }
        if (aborted) throw new Error("Movie export cancelled.");
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, 640, 360);
        if (rec.state === "inactive") rec.start(250);
        else if (rec.state === "paused") rec.resume();
        if (!isImage) await wait(element.play());
        const started = performance.now();
        await new Promise((resolve, reject) => {
          const abort = () => reject(new Error("Movie export cancelled."));
          controller.signal.addEventListener("abort", abort, { once: true });
          const draw = () => {
            const elapsed = (performance.now() - started) / 1000;
            if (aborted || recordingError) {
              controller.signal.removeEventListener("abort", abort);
              reject(recordingError || new Error("Movie export cancelled."));
              return;
            }
            if (elapsed >= clip.duration) {
              controller.signal.removeEventListener("abort", abort);
              resolve();
              return;
            }
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, 640, 360);
            const w = element.videoWidth || element.naturalWidth || 640,
              ht = element.videoHeight || element.naturalHeight || 360,
              ratio = Math.min(640 / w, 360 / ht);
            ctx.globalAlpha =
              clip.transition === "fade"
                ? Math.max(
                    0,
                    Math.min(1, elapsed / 0.4, (clip.duration - elapsed) / 0.4),
                  )
                : 1;
            try {
              ctx.drawImage(
                element,
                (640 - w * ratio) / 2,
                (360 - ht * ratio) / 2,
                w * ratio,
                ht * ratio,
              );
            } catch {}
            ctx.globalAlpha = 1;
            status.textContent = `Publishing clip ${index + 1} of ${scene.length} · ${elapsed.toFixed(1)} / ${clip.duration}s`;
            frame = requestAnimationFrame(draw);
          };
          draw();
        });
        if (rec.state === "recording") rec.pause();
        releaseElement();
      }
      if (rec.state !== "inactive") rec.stop();
      await wait(stopped);
      if (recordingError) throw recordingError;
      if (!aborted && !win.closed) {
        const blob = new Blob(chunks, { type: rec.mimeType }),
          name = projectName + (type.includes("mp4") ? ".mp4" : ".webm"),
          path = d.fs.uniquePath("C:/Users/User/Videos", name);
        d.fs.write(path, blob, rec.mimeType);
        await d.fs.flush();
        if (!win.closed) {
          status.textContent = "Movie published: " + basename(path);
          d.toast("Movie published", basename(path), "videos");
          d.open("media", { path });
        }
      }
    } catch (error) {
      if (!aborted && !win.closed) d.dialog.error(error);
    } finally {
      exportCleanup?.();
      exportCleanup = null;
      exporting = false;
      win.recording = false;
    }
  };

  win.body.append(
    menuBar([
      {
        label: "File",
        items: [
          { label: "New Project", action: fresh },
          { label: "Open Project…", action: openProject },
          { label: "Save Project", shortcut: "Ctrl+S", action: saveProject },
          { label: "Import into Collections…", action: importMedia },
          { label: "Publish Movie…", action: exportMovie },
          { label: "Exit", action: () => win.close() },
        ],
      },
      {
        label: "Edit",
        items: [
          {
            label: "Remove Clip",
            action: () => {
              if (current >= 0) {
                clips.splice(current, 1);
                current = Math.min(current, clips.length - 1);
                mark();
                showClip();
                render();
              }
            },
          },
          { label: "Clip Properties…", action: editClip },
        ],
      },
      {
        label: "Tools",
        items: [
          {
            label: "Project Title",
            action: async () => {
              const name = await d.dialog.prompt(
                "Project Title",
                "Title:",
                projectName,
              );
              if (name) {
                projectName = name;
                mark();
                render();
              }
            },
          },
        ],
      },
      {
        label: "Help",
        items: [
          {
            label: "About",
            action: () =>
              d.dialog.message(
                title,
                "Import images, audio, or videos. Arrange the storyboard, set clip start times and durations, and publish a real WebM/MP4 video using the browser encoder.\nProjects are saved as JSON. Native MSWMM/DVD-Video authoring and optical-disc writing require desktop software.",
              ),
          },
        ],
      },
    ]),
    h(
      "div",
      { class: "toolbar" },
      tool("Import Media", "folder", importMedia),
      tool("Open Project", "documents", openProject),
      tool("Save Project", "drive", saveProject),
      tool("Publish Movie", "videos", exportMovie),
      tool("Clip Properties", "control", editClip),
    ),
    stage,
    timeline,
    status,
  );
  stage.append(library, preview);
  win.beforeClose = confirmProject;
  win.el.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      saveProject();
    }
  });
  win.onCleanup(() => {
    aborted = true;
    exportCleanup?.();
    preview.querySelectorAll("video,audio").forEach((v) => v.pause());
    if (previewSource?.release) URL.revokeObjectURL(previewSource.url);
  });
  showClip();
  render();
  return win;
}
