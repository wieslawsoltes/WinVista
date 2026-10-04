# Validation record

## Automated checks

The final combined test run passed **30/30 tests**, including all 43 application launches. JavaScript syntax and module-resolution checks passed across the 14 authored modules. The production and standalone builds completed successfully.

The final verification runs use these commands from the project root:

- `pnpm check`: syntax and relative-module resolution across the desktop packages.
- `pnpm test`: pure model/rules regression suite.
- `pnpm test:dom`: mocked DOM integration suite.
- `pnpm build`: production Vinext/Cloudflare build.
- `pnpm build:standalone`: framework-independent ESM/HTML asset build.

The pure suite contains 23 checks. It covers Windows path resolution, stable file identity, search boundaries, transaction rollback, same-folder cut behavior, duplicate nested clipboard selection, recycle collisions, Unicode/binary backups, settings failure, calculator operations, RTF, command quoting, connected flood fill, deterministic filter arithmetic, stable ICS identity, Minesweeper counts, card conservation, Hearts scoring, chess move generation/undo/repetition/checkmate, and Mahjong generation/failure rollback.

The DOM suite contains seven integration checks, including a loop through all 43 registered applications. It verifies launch/content/close, modal ownership and cancellation, Notepad and WordPad edits during pending flush, Start and Task Manager shortcuts, session launch suppression, normalized overwrite confirmation, and a due scheduled task.

## Additional bounded review

A read-only engine review checked chess perft against the following reference counts, expanding promotion destinations into four promotion choices:

| Position                             | Depth 1 | Depth 2 | Depth 3 | Depth 4 |
| ------------------------------------ | ------: | ------: | ------: | ------: |
| Initial position                     |      20 |     400 |   8,902 | 197,281 |
| Kiwipete                             |      48 |   2,039 |  97,862 |       — |
| Rook/en-passant reference            |      14 |     191 |   2,812 |       — |
| Promotion/castling reference         |       6 |     264 |   9,467 |       — |
| Promotion/discovered-check reference |      44 |   1,486 |  62,379 |       — |

The same review exercised 45,000 move/draw/undo operations across 150 seeded Solitaire-family games without losing or duplicating a card. It found chess snapshot/repetition defects and Mahjong's incomplete greedy deal, which were corrected and given regression tests. Media review identified permission, recorder and export lifecycle races; session ownership and cancellation handling were added.

## Unverified surfaces

The supervised preview server started successfully. The provided cloud browser returned `net::ERR_BLOCKED_BY_CLIENT` when opening the internal preview. No browser screenshot or pixel-diff approval was obtained. The production deployment is verified separately through its deployment status.

Happy DOM has no visual renderer. Layout dimensions, canvas, animation and permission-dependent devices are mocked in its tests. These results establish DOM/application wiring and state behavior, not pixel fidelity or actual GPU/media hardware support.

Remaining manual checks include: real WebGPU initialization and device-loss recovery; WebGL2 and Canvas screenshots on target browsers; font/DPI comparisons against Vista references; real pointer drag/resize; file import/download and IndexedDB reload persistence; microphone and screen-capture permission handling; audio/video playback and movie export across browser codecs; and print output. The compatibility matrix documents implementation limits separately from these verification limits.
