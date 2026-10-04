# Asset provenance

The desktop uses archived Vista artwork to improve visual fidelity. Source links, native frame sizes, export methods and SHA-256 checksums are recorded in `assets-manifest.json`. Audio sources and metadata are recorded in `sound-sources.json`.

| Asset                                                                 | Source                                                                                                                                        |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Default 1920×1200 Vista wallpaper (`img36.jpg`)                       | [Windows UI Assets — Vista wallpaper archive](https://github.com/bartekl1/windows-ui-assets/blob/main/Tables/Windows%20Vista%20Wallpapers.md) |
| Two additional Vista photographs                                      | [Windows UI Assets](https://github.com/bartekl1/windows-ui-assets)                                                                            |
| Vista shell/application icon frames, including 16px and 48px variants | [Windows UI Assets](https://github.com/bartekl1/windows-ui-assets), with individual source-file links in the manifest                         |
| Additional archived game icons                                        | [React Old Icons](https://github.com/gsnoopy/react-old-icons), with extraction details in the manifest                                        |
| Three-state Start orb sprite                                          | [Classic Shell archived attachment](https://coddec.github.io/Classic-Shell/www.classicshell.net/forum/download/file688e.png?id=4345)          |
| Startup, logon, click, menu, error, critical-stop and recycle sounds  | [Windows Vista sound archive](https://github.com/bartekl1/windows-ui-assets/tree/main/Sounds/Windows%20Vista)                                 |

The archives distinguish their repository/tooling licenses from the rights in Microsoft artwork. The MIT license for this project's original implementation does **not** license Microsoft logos, icons, wallpapers, sounds, Windows names or third-party assets. Those retain their respective rights and terms. No Microsoft endorsement is implied.

Segoe UI is not bundled. The stylesheet uses the locally installed font when available and falls back to Tahoma and Arial. The sample “Morning Light” audio file is synthesized by the application's own JavaScript; it is not a Windows sample music recording.
