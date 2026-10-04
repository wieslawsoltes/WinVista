# Windows Vista — Aero Desktop

**Live demo:** https://wieslawsoltes.github.io/WinVista/ — `node scripts/build-pages.mjs` writes the standalone HTML/JavaScript desktop to `_site/` with relative URLs so it works under any base path; the `Deploy to GitHub Pages` workflow publishes it on every push to `main`.

A modular HTML/CSS/JavaScript browser recreation of the Vista desktop, with **43 launchable applications and system tools**, **12 reusable ESM workspace packages**, a **WebGPU wallpaper and raster-compute backend**, and **WebGL2 / Canvas 2D / CPU fallbacks**.

The implementation includes functional editing, file management, games, local productivity data and browser-supported media workflows. It is not a Windows kernel or virtual machine, does not execute Win32 programs, and is not certified pixel-perfect. Read the [compatibility matrix](docs/compatibility.md) for the exact scope before treating it as a substitute for Vista.

## Run

The hosted project uses the supplied Vinext/React/Cloudflare setup. The desktop itself is plain JavaScript and native DOM.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Use the development URL printed by the server. A secure context is needed for permission-dependent browser features; local development and a deployed HTTPS origin are the intended environments.

### Standalone HTML/JavaScript

```sh
pnpm build:standalone
python -m http.server 8000 --directory standalone-dist
```

Open `http://localhost:8000/`. The standalone output contains the HTML entry point, all desktop packages and assets. It does not require React, Vinext or an application backend at runtime. Serve it at the origin root because the application uses `/assets` URLs. Do not open the HTML through `file://`.

## First things to try

- Open **Start → All Programs** to browse the complete registry. Start search matches application names and virtual files.
- Open **Computer → Documents → Welcome.txt**, edit it in Notepad, save it, and reopen it. Files use the same virtual drive in all applications.
- Create a drawing in **Paint**, save it as PNG, then open it in **Windows Photo Gallery**. Invert, grayscale, sepia and threshold use GPU compute when available and CPU arithmetic otherwise.
- Try **Minesweeper**, **Solitaire**, **FreeCell**, **Spider Solitaire**, **Hearts**, **Chess Titans**, **Mahjong Titans**, **Purble Place** and **InkBall**.
- Use **Personalization** to change the wallpaper, Aero color, Basic theme, gadgets or screen saver. **System** reports the active graphics backend.
- Use **Backup and Restore Center** to export the virtual files and desktop settings as a single JSON backup.

Right-click desktop items, files and the taskbar for contextual actions. Windows can be dragged, resized, minimized, maximized and restored. Unsaved document dialogs block their owning windows until resolved.

## Applications

| Category           | Entries                                                                                                                                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell and system   | Welcome Center, Computer/Explorer, Control Panel, Personalization, System, Task Manager, Backup and Restore Center, Network and Sharing Center, Security Center, Registry Editor, Services, Task Scheduler, Ease of Access Center, Magnifier, Help and Support |
| Accessories        | Notepad, WordPad, Paint, Calculator, Command Prompt, Snipping Tool, Windows Journal, Character Map                                                                                                                                                             |
| Productivity       | Windows Calendar, Windows Contacts, Windows Mail                                                                                                                                                                                                               |
| Internet and media | Internet Explorer, Windows Media Player, Windows Photo Gallery, Windows Media Center, Sound Recorder, Windows Movie Maker, Windows DVD Maker                                                                                                                   |
| Games              | Games Explorer and nine playable games                                                                                                                                                                                                                         |

The registry lives in `packages/shell/index.js`. “43 applications” describes registered, launchable entries; feature depth differs by application. Media Center is a navigation shell, Mail has local storage and email-client handoff, and DVD Maker exports a browser movie rather than writing a native DVD.

## Architecture

| Package                    | Role                                                                |
| -------------------------- | ------------------------------------------------------------------- |
| `@vista/core`              | Filesystem, paths, settings, events, clipboard, undo, backups       |
| `@vista/ui`                | DOM primitives, icons, menus and shared dialogs                     |
| `@vista/window-manager`    | Window state, pointer interaction, modality and lifecycle           |
| `@vista/renderer`          | WebGPU, WebGL2 and Canvas wallpaper; GPU/CPU image filters          |
| `@vista/theme`             | Aero/Basic and application CSS                                      |
| `@vista/shell`             | Desktop, taskbar, Start, gadgets, sessions and application registry |
| `@vista/apps-explorer`     | Explorer and Recycle Bin                                            |
| `@vista/apps-accessories`  | Editors, calculator, command environment and capture tools          |
| `@vista/apps-games`        | Game rules, views and chess worker                                  |
| `@vista/apps-media`        | Internet, photo, audio and video applications                       |
| `@vista/apps-productivity` | Calendar, contacts and local mail                                   |
| `@vista/apps-system`       | Control panels, system tools and help                               |

Application groups load on demand. Shared model state stays on the CPU, so losing a graphics device does not lose documents or files. Native HTML controls preserve browser text editing and accessibility. The [architecture guide](docs/architecture.md) documents package exports, the desktop/application contract, window cleanup, persistence and graphics ownership.

## Data

Virtual files are persisted in IndexedDB; preferences and productivity records are stored in localStorage. They belong to this browser profile and origin. Data is not synchronized to a server or another device. Browser storage quotas or clearing can remove it; make explicit backups for important work.

The filesystem is case-insensitive and preserves stable file IDs across renames. It supports folder hierarchies, imports, downloads, batched copy/move, Recycle Bin restore and binary backups. It does not access physical C: drives, NTFS permissions or network shares.

Media and screen capture ask for browser permissions only when the user starts those actions. No microphone or display capture starts on desktop load. The desktop does not send mail: its Send action opens the configured email application or exports an EML file with attachments.

## Keyboard shortcuts

| Shortcut               | Action                                                            |
| ---------------------- | ----------------------------------------------------------------- |
| Ctrl+Esc               | Start                                                             |
| Ctrl+Shift+Esc         | Task Manager, if delivered by the host/browser                    |
| Alt+Tab                | Cycle desktop windows, if delivered by the host/browser           |
| Alt+F4                 | Close the active desktop window, if delivered by the host/browser |
| Alt+Space              | Window menu                                                       |
| Meta/Windows+D         | Show desktop, if delivered by the host/browser                    |
| Meta/Windows+E / R / L | Explorer / Run / lock overlay                                     |
| Ctrl+S                 | Save in document editors                                          |
| Ctrl+O / Ctrl+N        | Open / New in supported editors                                   |
| Ctrl+Z / Ctrl+Y        | Undo / redo in supported editors                                  |
| F2                     | Rename selected files; new game in the relevant game windows      |
| F1                     | Help                                                              |

## Validation

```sh
pnpm check
pnpm test
pnpm test:dom
pnpm build
pnpm build:standalone
```

The pure tests cover filesystem identity, path boundaries, transactional rollback, clipboard behavior, backup data, calculator operations, RTF/ICS round trips, image arithmetic and game rules. DOM integration tests cover every registered application, modal ownership, pending-save edits, normalized overwrite confirmation, shortcuts, session suppression and task scheduling.

DOM integration uses Happy DOM with mocked layout, canvas and permission APIs. It does **not** prove visual fidelity, real WebGPU execution, browser codec compatibility or successful permission prompts. The managed preview server started, but the available browser blocked access to it; real browser visual QA remains uncompleted. See [validation results](docs/validation.md).

## Visual fidelity and native compatibility

The styling targets Vista Ultimate SP1 at 96 DPI. It includes archived wallpaper, native icon frames and sound effects. Segoe UI is used when installed, with Tahoma/Arial fallbacks. Aero and Basic are recreated with CSS; window/application controls are not all rendered through WebGPU.

Native executables, drivers, the Windows kernel, Direct3D/Win32 APIs, ActiveX, optical-disc writing, TV recording, host firewall/antivirus, Windows Update, domain join and real system power management are outside this build. Several original application's formats and advanced options are also incomplete. The [compatibility matrix](docs/compatibility.md) lists these per application.

Original implementation code is licensed under MIT. Microsoft and third-party artwork, sounds, marks and names retain their respective rights. The code license does not grant rights to those assets. See [asset provenance](docs/ASSETS.md) and the detailed manifests.
