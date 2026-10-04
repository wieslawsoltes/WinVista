# Architecture

The desktop is implemented with native HTML elements, CSS, ES modules, Canvas, WebGPU and WebGL2. The hosted entry point uses React only to mount and dispose the desktop. Application logic does not depend on React, Next.js or Vinext. `standalone/index.html` mounts exactly the same shell directly.

## Workspace packages

Each package has an explicit ESM export map. Internal dependencies use pnpm's `workspace:*` protocol. These are source packages; they have not been published to npm. Keep the sibling package layout when copying source, or bundle the packages with the application.

| Package                    | Responsibilities and public entry points                                                                                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@vista/core`              | `EventBus`, `Settings`, `VirtualFileSystem`, `ClipboardService`, `UndoStack`, Windows path helpers and file export helpers. No DOM is required for the state classes.                                       |
| `@vista/ui`                | Native DOM primitives, icon resolution, menus, form dialogs and shared Open/Save dialogs.                                                                                                                   |
| `@vista/window-manager`    | `WindowManager`: window creation, bounds, dragging, resizing, activation, modal ownership, minimize/maximize, task switching and cleanup.                                                                   |
| `@vista/renderer`          | `DesktopRenderer` and `filterPixels`: wallpaper backends, device loss, resizing, raster compute and deterministic CPU fallback.                                                                             |
| `@vista/theme`             | Vista-style shared CSS, Aero and Basic themes, application layouts and compact viewport rules.                                                                                                              |
| `@vista/shell`             | `createDesktop`, `APPLICATIONS`, Start, taskbar, desktop icons, gadgets, session overlays, scheduler and feature-detected WebMCP tools.                                                                     |
| `@vista/apps-explorer`     | Computer, folder browsing, file operations and Recycle Bin.                                                                                                                                                 |
| `@vista/apps-accessories`  | Notepad, WordPad, Paint, Journal, Calculator, Command Prompt, Character Map and Snipping Tool. The `./engines` export exposes calculator, fill, command and RTF utilities.                                  |
| `@vista/apps-games`        | Games Explorer, Minesweeper, Solitaire, FreeCell, Spider, Hearts, Chess Titans, Mahjong Titans, Purble Place and InkBall. Pure rules are exposed through `./engines`; chess search runs in a module worker. |
| `@vista/apps-media`        | Internet Explorer, Media Player, Photo Gallery, Media Center, Sound Recorder, Movie Maker and DVD Maker.                                                                                                    |
| `@vista/apps-productivity` | Calendar, Contacts and local Mail. `exportCalendar` and `importCalendar` are independently callable.                                                                                                        |
| `@vista/apps-system`       | Welcome Center, Control Panel, Personalization, System, Task Manager, Backup, Network, Security, Registry, Services, Task Scheduler, accessibility and Help.                                                |

## Mounting and application contract

With a bundler:

```js
import "./packages/theme/index.css";
import { createDesktop } from "./packages/shell/index.js";

const desktop = await createDesktop(document.getElementById("vista-root"));
await desktop.open("notepad");
await desktop.open("explorer", { path: "C:/Users/User/Documents" });

// When the containing application unmounts:
desktop.dispose();
```

Copy `public/assets` to `/assets` on the serving origin. The standalone builder does this. The desktop currently expects to be mounted at the origin root; arbitrary URL base paths require updating asset URLs.

Application groups expose `launch(desktop, id, args)`. The desktop object supplies `fs`, `settings`, `clipboard`, `wm`, `dialog`, `renderer`, `open`, `openFile`, `toast`, `playSound` and an abort `signal`. Opening is asynchronous because application groups are dynamically imported.

```js
export function launch(desktop) {
  const win = desktop.wm.create({
    appId: "example",
    title: "Example",
    icon: "documents",
    width: 640,
    height: 420,
    remember: true,
  });
  win.body.append(document.createTextNode("Hello"));
  win.onCleanup(() => {
    /* stop application-owned resources */
  });
  return win;
}
```

A window exposes its `body`, `el`, `signal`, `rect`, title and application ID. Use `setTitle`, `focus`, `minimize`, `maximize` and `close` for normal operations. `beforeClose` may return a promise resolving to `false` to preserve unsaved work. `forceClose` is reserved for teardown. Modal windows carry an owner; the owner becomes inert until its modal descendants close.

The application registry is the source of truth for Start search, All Programs, Run aliases and scheduled application launch. To add an application, create a launch function, add its group import and registry entry, and use the existing desktop services.

## Files and settings

The virtual C: drive is a case-insensitive map with normalized Windows-style paths. Entries contain a stable ID, path, kind, timestamps and either a string or Blob payload. Folder moves preserve descendant IDs, while copies create new IDs. Open editors follow their file IDs when files are renamed.

IndexedDB stores metadata and Blob content together in the `vista-desktop` database. Mutations update the in-memory model and queue atomic database snapshots. Explicit saves await `flush()`. Failed persistence is reported through a desktop notification; applications do not treat a failed awaited flush as a successful save. Without IndexedDB, the model remains usable in memory but cannot promise persistence.

`fs.transaction(callback)` batches synchronous operations and change notifications, with rollback if an operation fails. Clipboard paste uses that transaction for multi-file moves. Recycle Bin stores the original path and resolves restore-name conflicts. Backups use versioned JSON with base64 for binary payloads, and restore validates hierarchy before replacing state.

Preferences, local mail, contacts, appointments, tasks and registry values use the versioned `vista.settings.v1` localStorage record. This is device-local data; there is no account synchronization or cloud filesystem. Backup and Restore includes both files and settings.

Notepad and WordPad save snapshots rather than reading the editor again after an asynchronous flush. Paint tracks document generations and pixel revisions so an older compute result or save cannot silently clear newer changes. Shared file dialogs normalize the final file type before asking permission to replace an existing file.

## Rendering

The wallpaper renderer attempts these backends in order:

1. WebGPU: a full-screen textured triangle, WGSL shaders, a small uniform buffer and an image texture.
2. WebGL2: an equivalent textured triangle when WebGPU cannot initialize or the device is lost.
3. Canvas 2D: cover-fit image drawing when neither GPU backend is usable.

Personalization can force WebGL2 or Canvas 2D on the next reload. System displays the selected backend. WebGPU texture dimensions and compute buffers are checked against device limits; large wallpaper images are resampled before texture upload. Resize invalidates one frame, rather than driving a continuous wallpaper loop. Device pixel ratio is capped at 2 to limit surface memory.

Paint and Photo Gallery use the renderer's compute path for inversion, grayscale, sepia and threshold filters. The WGSL filter reads packed RGBA pixels, dispatches a bounded grid of 256-thread workgroups and reads the result back. Integer color coefficients and explicit rounding match the CPU fallback's arithmetic. Validation failure, device loss or buffer limits fall back to CPU processing. Alpha is preserved.

**Window controls and applications remain DOM/CSS surfaces.** CSS supplies Aero reflections, shadows and backdrop blur. Games use DOM or Canvas as appropriate. This project does not implement a WebGPU replacement for the entire Windows Desktop Window Manager, Direct3D or the GDI API.

## Scheduling and lifecycle

The desktop owns one lifecycle abort controller, each window owns another, and Sidebar rebuilds dispose their previous gadget lifecycle. Event subscriptions accept abort signals. Window cleanup stops workers, media playback, tracks, animation frames and application timers.

Task Scheduler persists due time, interval, enabled state and last-run time. The shell checks tasks while the desktop is open, visible and unlocked. Missed intervals are coalesced into one launch; recurring tasks schedule the next run from the current time. This is not an operating-system scheduler and does not run after the browser closes.

Screen saver activation uses desktop input activity and the configured idle time. Session overlays make existing desktop surfaces inert and suppress program launch. They simulate lock, sleep, logoff, restart and shutdown inside the page; they are not authentication boundaries or host power controls.

Sound Recorder owns the stream, recorder, chunks, clock and analyser for each recording session. A microphone request that resolves after window closure is stopped immediately. Movie export owns a cancellable context; closing it stops recording and tracks, aborts pending loading, and cancels frame callbacks. Clip preparation is excluded from the recording where possible by pausing between clips.

## Hosting and standalone output

The hosted application retains the supplied Vinext/Cloudflare build setup. `app/page.tsx` mounts the shell. The initial route and a small shared desktop layer load first, followed by application groups on demand.

`pnpm build:standalone` copies the ESM packages, stylesheet, images, icons, sounds and HTML entry point into `standalone-dist`. Serve that directory at the origin root. This output requires no React runtime, application server, build service or external account. Browser permissions and codec support still govern media and screen capture.

## Verification boundaries

Pure Node tests exercise file and game rules. Happy DOM integration tests exercise application construction, shared dialogs, save races, keyboard dispatch, session suppression and scheduled launch with mocked layout, canvas and device APIs. They do not render pixels or validate real GPU shaders, audio codecs or permission dialogs. See `validation.md` for the recorded results and `compatibility.md` for feature limits.
