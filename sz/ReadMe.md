# SZ - »SynthelicZ« Desktop Environment

A browser-based desktop operating system built entirely in-browser. Works like Windows, customizable like Linux, re-uses assets from Stardock WindowBlinds/Object Desktop, smooth and fast like macOS.

Originally created 2004-2006, this is a complete ground-up rewrite using modern JavaScript (classes, private fields, pointer events) and CSS (grid, custom properties, GPU-composited transforms). The system loads WindowBlinds `.uis`/`.wba` skins at runtime -- title bars, window frames, title buttons, start button, form controls (checkboxes, radio buttons, push buttons, combo dropdowns) -- all skinned from the same assets that power the native Windows desktop. Applications are self-contained HTML pages or directly-hosted script classes running inside skinned windows.

**No build step, no bundler, no framework.** Works offline from `file://` -- just open `index.html` in a browser.

Live: `https://hawkynt.github.io/sz/`

---

## How It Works

The system renders a full desktop environment inside a single browser tab. A **window manager** handles creation, movement, resizing, z-ordering, and state transitions of windows. Each window's chrome (title bar, borders, buttons) is rendered from a **skin** -- a set of frame images and metadata originally from the WindowBlinds `.wba`/`.uis` format, now parsed on the fly in the browser. Desktop icons launch **applications**, which are self-contained HTML pages loaded into iframes inside windows.

### Boot Sequence

1. `index.html` loads and shows the **boot screen** (an animated overlay)
2. The boot screen displays a CSS animation (pulsing SZ logo + progress bar), or a custom boot logo (animated GIF or frame sequence of BMPs/PNGs at configurable FPS)
3. While the boot animation plays, the system:
   - Loads the default skin (LUNAX) and pre-loads all BMP frame images into the browser cache
   - Initialises the theme engine and generates CSS custom properties
   - Sets up the desktop background
   - Fetches the application manifest and creates desktop icons
   - Initialises the common file dialogs and VFS
   - Wires up the window manager, taskbar (MRU + All Programs), and postMessage bridge
4. The boot screen fades out over 500ms and the desktop becomes interactive

Boot logo configuration:

- **No config** (default): Pure CSS fallback animation with pulsing "SZ" letters, bouncing dots, and progress bar
- **GIF**: `{ type: 'gif', src: 'assets/boot/logo.gif' }` -- single animated GIF
- **Frame sequence**: `{ type: 'frames', folder: 'assets/boot/frames', fps: 24, fileList: ['001.png', '002.png', ...] }` -- folder of BMP/PNG images played at X FPS, ordered alphabetically by filename

### Opening an Application

Applications can be hosted two ways. The choice depends on whether the app needs OS runtime access:

- **Iframe apps** (`index.html`): For apps that can run standalone in a browser tab (calculator, text editor, games, encryptor). Communicate with the OS via `postMessage`.
- **Hosted apps** (`app.js`): For system utilities that require direct access to `SZ.system.*` (explorer, task manager, control panel, about). Run in the same document context.

**Iframe-based** (default, `"type": "iframe"` in manifest):

1. User double-clicks a desktop icon
2. The window manager creates a new window with the current skin applied
3. An `<iframe class="sz-app-frame">` is created inside the window's content area
4. The iframe loads the application's HTML from `Applications/{app}/index.html`
5. The theme engine injects a `<style id="sz-theme">` into the iframe's `<head>` so form controls match the skin
6. The app communicates with the desktop via `postMessage`

**Hosted app.js** (`"type": "hosted"` in manifest):

1. User double-clicks a desktop icon
2. The window manager creates a new window
3. Instead of an iframe, the entry script (`Applications/{app}/app.js`) is injected via `<script>` tag
4. The script must register on the global namespace:

   ```js
   ;(function() {
     const SZ = window.SZ || (window.SZ = {});
     SZ.Apps = SZ.Apps || {};
     SZ.Apps['my-app'] = {
       Application: class {
         constructor(container, params) { /* render into container element */ }
         onAttach(win) { /* called after window is created -- set title, wire close, etc. */ }
         destroy() { /* cleanup when window closes */ }
       }
     };
   })();
   ```

5. The class is instantiated with the window's content `<div>` as its container and any launch `params` (URL parameters)
6. After the window is created, `onAttach(win)` is called so the app can set its title and access the window
7. Since the app runs in the same document context, it inherits all CSS custom properties directly -- no theme injection needed
8. Hosted apps access OS services via `SZ.os` (kernel, windowManager, appLauncher, taskbar, themeEngine, settings)

---

## Project Structure

```
sz/
  index.html                    Entry point (boot overlay + desktop + taskbar)
  update-versions.sh            Generates Applications/versions.js from git history
  changelog.txt                 Full project changelog (parsed by About app)
  css/
    boot.css                    Boot screen overlay, animations, progress bar
    desktop.css                 Desktop, background, icon grid layout
    window.css                  Window chrome, frames, buttons, states
    taskbar.css                 Taskbar, start button, start menu, system tray
    animations.css              Transitions for minimize, maximize, close, roll up/down
    snap-overlay.css            Translucent blue snap preview overlay
    common-dialogs.css          OS-level common file dialogs (Open/Save As)
    context-menu.css            Windows XP-style context menus (including disabled items)
  js/
    main.js                     Bootstrap, boot sequence, postMessage bridge, MRU tracking
    boot-screen.js              Boot screen manager (GIF / frames / CSS fallback)
    window-manager.js           Window lifecycle, z-order, focus, state
    window.js                   Window class (create, move, resize, skin rendering)
    desktop.js                  Desktop surface, icon placement, background
    icon.js                     Icon class (render, click, drag)
    taskbar.js                  Taskbar with XP-style start menu (MRU + All Programs), window list, clock
    skin-loader.js              UIS parser, skin registry (getSkin/getAvailableSkins)
    theme-engine.js             Generate + inject control theme CSS into app iframes
    app-launcher.js             Read manifest, create icons, launch iframe/hosted apps
    pointer-handler.js          Unified pointer events for drag, resize, snap, tab merge
    snap-engine.js              Pure calculation module for edge snap, magnet, stretch
    tab-manager.js              TidyTabs-style tab group management
    settings.js                 Persistent user preferences (localStorage)
    vfs.js                      Virtual File System (VFS) with localStorage, read-only object, and File System Access API mounts
    common-dialogs.js           OS-level Open/Save file dialogs (used by apps via postMessage)
    context-menu.js             Desktop + taskbar context menus (XP-style with submenus)
    filesystem.js               Shell folder abstraction (Desktop, StartMenu, Programs categories)
  skins/
    LUNAX/                      Default skin (101 BMPs, Luna Extended by scratch)
      skin.js                   Self-registering skin data (IIFE -> SZ.skins.LUNAX)
    AQUARIUM/                   Animated skin (61 BMPs, 15-frame borders, 300ms cycle)
      skin.js                   Self-registering skin data (IIFE -> SZ.skins.AQUARIUM)
    APOLLO/                     Apollo (125 BMPs)
    APPLIED SCIENCE/            Applied Science (85 BMPs)
    BLUECURVE/                  Blue Curve: Red Hat Linux 8.0 (106 BMPs)
    CYRIX/                      Cyrix (89 BMPs)
    DINKSDX_BLUE/               dinksDX Blue (182 BMPs)
    G-POD/                      G-Pod (86 BMPs)
    IRIXOS/                     Irix OS (23 BMPs)
    LCARS/                      LCARS Red Vision (71 BMPs)
    LCARS TERMINAL COMPANION/   Star Trek LCARS (19 BMPs)
    LINUX/                      Linux-KDE (21 BMPs)
    MACOSXDP2/                  MacOS X DP2/Server (54 BMPs)
    MACOSXSERVER/               MacOSXServer (14 BMPs)
    MDNATURE/                   MdNature (26 BMPs)
    MOREWINDOWS/                More Windows (24 BMPs)
    NEWTECH/                    NewTech (74 BMPs)
    WIN10/                      Windows 1.0 (36 BMPs)
    WIN98/                      Windows 98 (19 BMPs)
    WINDOWSXL/                  Windows XL (647 BMPs)
    XPNATURE/                   XP Nature (60 BMPs)
  libs/
    formats/
      format-core.js            Shared format registry (SZ.Formats) + binary I/O utilities
      format-utils.js           Shared utilities: BitstreamReader, NAL start code scanner, emulation prevention removal
      wasm-loader.js            Lazy WASM engine loader (ffmpeg.wasm + wasm-imagemagick), returns null on file://
      disk-commodore.js         C64 1541/1571/1581 disk image parsers (D64/D71/D81/T64)
      disk-amiga.js             Amiga Disk File (ADF) parser
      graphics-ico.js           Full ICO/CUR codec (parse, decode BMP entries, write) shared by icon-editor and metadata-viewer
      graphics-bmp.js           BMP image codec (pure JS decode/encode, 1/4/8/16/24/32-bit)
      graphics-png.js           PNG image codec (JS chunk parser, browser canvas decode/encode)
      graphics-jpeg.js          JPEG image codec (marker parser, EXIF-aware, browser canvas decode/encode)
      graphics-gif.js           GIF image codec (frame count/delay metadata, browser canvas decode)
      graphics-webp.js          WebP image codec (RIFF parser, browser canvas decode/encode)
      graphics-avif.js          AVIF image codec (ISOBMFF ftyp detection, browser canvas decode)
      graphics-svg.js           SVG image codec (text-based detection, browser Image decode)
      graphics-tga.js           TGA image codec (pure JS uncompressed + RLE decode/encode)
      graphics-tiff.js          TIFF image codec (IFD metadata parser, wasm-imagemagick decode)
      graphics-ppm.js           PPM/PGM/PBM family codec (pure JS P1-P6 decode, P6 encode)
      graphics-pcx.js           PCX image codec (RLE decode, 8-bit palette + 24-bit)
      graphics-dds.js           DDS surface codec (DXT1/DXT5 block decode)
      codec-mp3.js              MP3 frame scanner, Xing/LAME/VBRI header parsers
      codec-aac.js              AAC ADTS frame scanner
      codec-flac.js             FLAC frame header parser
      codec-pcm.js              WAV/PCM analyzer + statistics (RMS/peak/clipping/silence)
      codec-ogg.js              Ogg container page parser (Vorbis/Opus/FLAC/Theora detection)
      codec-opus.js             Opus audio header parser (OpusHead inside Ogg)
      codec-midi.js             MIDI header/track parser (format, tracks, timing)
      codec-aiff.js             AIFF/AIFF-C chunk parser (COMM, sample rate, duration)
      codec-h264.js             H.264/AVC NAL unit + SPS parser (profile, level, resolution)
      codec-h265.js             H.265/HEVC NAL unit + SPS parser
      codec-vp8.js              VP8 frame header parser
      codec-vp9.js              VP9 frame header parser
      codec-av1.js              AV1 OBU + sequence header parser
      codec-video-identify.js   Video codec identification heuristic (tries H.264/H.265/VP9/AV1)
    wasm/                       WASM binaries (loaded lazily by wasm-loader.js)
      ffmpeg/                   ffmpeg.wasm single-thread core (not shipped yet — add @ffmpeg/core files)
      magick/                   wasm-imagemagick UMD bundle (not shipped yet — add magick.js + magick.wasm)
  Applications/
    manifest.js                 Inline app registry with file type associations (sets SZ.manifest)
    versions.js                 Generated per-app version data, git hash, changelog (sets SZ.appVersions)
    sz-app-bootstrap.js         DLL-like API library: SZ.Dlls.User32/Kernel32/GDI32/Shell32/ComDlg32/Advapi32, theme injection, WindowProc dispatch, standalone redirect
    zoom-control.js             Reusable SZ.ZoomControl component (slider + buttons + text input) used by 9 apps
    libs/                       Vendored third-party libraries (offline-capable)
      mammoth.browser.min.js    DOCX→HTML converter (BSD-2)
      jszip.min.js              ZIP creation for DOCX export (MIT)
      xlsx.full.min.js          XLSX read/write — SheetJS Community Edition (Apache 2.0)
    about/                      About »SynthelicZ« (Accessories)
    calculator/                 Classic calculator (Accessories)
    control-panel/              System configuration (hidden, launched via start menu)
    encryptor/                  Data encryption tool (Accessories)
    explorer/                   File manager with VFS operations + object tree browser
    image-viewer/               Image viewer with zoom/rotate/navigate (Accessories)
    media-player/               Audio/video player with visualization (Entertainment)
    minesweeper/                Classic Minesweeper game (Games)
    notepad/                    Plain text editor with VFS integration (Accessories)
    paint/                      Paint.NET-class bitmap editor with layers, effects, ribbon UI (Accessories)
    solitaire/                  Klondike solitaire card game (Games)
    task-manager/               Task manager with event-loop lag + NT-style graphs (hidden)
    terminal/                   Multi-shell terminal: cmd.exe + bash with VFS (System Tools)
    tetris/                     Classic Tetris game (Games)
    web-browser/                Iframe-based web browser with bookmarks (Internet)
    wordpad/                    Rich text editor with formatting toolbar (Accessories)
    color-picker/               Advanced color picker with multiple colorspaces (Accessories)
    markdown-editor/            Markdown editor with live preview (Accessories)
    hex-editor/                 Binary file editor with hex/ASCII view (Accessories)
    spreadsheet/                Excel-like spreadsheet with formulas (Accessories)
    freecell/                   FreeCell card game (Games)
    spider-solitaire/           Spider solitaire card game (Games)
    function-plotter/           Mathematical function plotter with analysis (Office)
    readme-generator/           Template-based README.md builder (Development)
    resume-builder/             Resume builder with templates, wizard, and multi-format export (Office)
    display-tester/             Display quality testing utility with 51 tests, WebGL2 HDR, and calibration tools (System Tools)
    archiver/                   WinRAR-style archive manager with 69 format handlers (System Tools)
  assets/
    icons/
      recycle-bin.svg           Recycle Bin desktop icon
    backgrounds/
      default.jpg               Default desktop background
    boot/                       Custom boot logos (optional)
      logo.gif                  Animated GIF boot logo
      frames/                   Frame-sequence boot animation
        001.png ... NNN.png     Ordered by filename, played at configured FPS
    cursors/
      default/                  Default cursor set
    icon-packs/
      default/                  Default icon pack
  docs/
    skin-format-reference.md    Complete WBA/WSZ/UIS1/UIS2/skin.js format spec
    appideas.md                 Application ideas with hosting format + status
  Old.bak/                      Original 2004-2006 code (reference only)
  CLAUDE.md
  ReadMe.md
```

---

## Architecture

### Window Manager (`js/window-manager.js`)

Central orchestrator. Maintains a registry of all open windows and handles:

- **Z-order stack**: Array of window references sorted by depth, split into two bands: normal windows (base 100) and always-on-top windows (base 10000). Focus moves a window to the top of its band.
- **Window states**: Each window is in exactly one state: `normal`, `minimized`, `maximized`, `rolled-up`, `closed`. State transitions trigger CSS animations defined in `animations.css`.
- **Focus management**: Exactly one window is "active" at a time. The active window gets the skin's active title bar colors; all others get inactive colors.
- **Cascading placement**: New windows are offset from the last-opened window by a fixed step (32px right, 32px down), wrapping when they would go off-screen.
- **AquaSnap-style edge snapping**: Drag a window to screen edges or corners to snap it into half/quarter/full-screen zones. A translucent blue overlay previews the snap target. Dragging away restores to pre-snap size. Modes: AeroSnap (edge only), AquaSnap (corners + bottom half), or disabled.
- **Magnetic alignment**: During drag, windows snap to nearby edges of other windows and screen edges within a configurable pixel threshold. Optionally disabled during fast cursor movements.
- **Stretching**: Double-click a resize handle to stretch a window to fill available space in that direction. AquaStretch mode stops at the nearest window edge; AeroStretch mode stretches to the screen edge.
- **Move-together (AquaGlue)**: Hold Ctrl during drag to move adjacent windows in unison. Hold Ctrl during resize to inversely resize adjacent windows.
- **TidyTabs-style window tabbing**: Drag a window onto another window's title bar to merge them into a tab group. A compact tab bar appears above the title bar on hover, showing icons and truncated titles. Click tabs to switch, drag tabs out to detach. Close button on each tab.
- **Title bar icon context menu**: Click the title icon to open a system menu with Restore, Move, Size, Minimize, Maximize, Roll Up/Down, Always on Top, Set Transparency, and Close. Double-click the icon to close the window.
- **Roll up/down (window shade)**: Collapse a window to just its title bar, hiding content and bottom frame. Roll down to restore.
- **Always on top**: Pin a window above all others (indicated by an orange dot).
- **Window transparency**: Set per-window opacity from 25% to 100%.

### Window (`js/window.js`)

Each window is a class instance that owns a DOM subtree rendered as a 5-column × 3-row CSS grid. The extra columns (`nw-ext`, `ne-ext`) allow top/bottom border corner zones to extend beyond the side border width — necessary for skins like AQUARIUM where TOP zone A (52px) is much wider than the LEFT border (7px):

```
div.sz-window [data-state="normal|minimized|maximized"]
  CSS grid: "nw nw n  ne ne"     ← corners span border + extension columns
            "w  c  c  c  e"      ← content spans extensions + flexible middle
            "sw s  s  s  se"
  Columns: [left-w] [nw-ext] [1fr] [ne-ext] [right-w]
  div.sz-frame-nw                  Top-left corner (from skin)
  div.sz-frame-n                   Top edge (title bar inside)
    div.sz-title-bar
      span.sz-title-text           Window title
      div.sz-title-buttons         Minimize, maximize/restore, close
  div.sz-frame-ne                  Top-right corner
  div.sz-frame-w                   Left edge
  div.sz-window-content            Application content area
    iframe.sz-app-frame            Application content
  div.sz-frame-e                   Right edge
  div.sz-frame-sw                  Bottom-left corner
  div.sz-frame-s                   Bottom edge
  div.sz-frame-se                  Bottom-right corner
  div.sz-resize-handle x8          8 invisible resize grip zones
```

Frame images for all 8 border cells are set entirely via CSS by the skin CSS generator — no JS animation or canvas manipulation at runtime. Extension column widths (`--sz-frame-nw-ext`, `--sz-frame-ne-ext`) are computed from the difference between zone A/C widths and border widths.

Window properties:

- `id` -- unique identifier (auto-incrementing HWND counter)
- `title` -- displayed in title bar and taskbar
- `x`, `y`, `width`, `height` -- position and dimensions in pixels
- `state` -- `normal` | `minimized` | `maximized` | `rolled-up` | `closed`
- `skin` -- reference to the skin object used for rendering
- `datasource` -- URL of the application HTML loaded into the iframe
- `zIndex` -- managed by window manager (100+ normal, 10000+ always-on-top)
- `resizable`, `minimizable`, `maximizable` -- boolean flags from manifest
- `alwaysOnTop` -- boolean, keeps window above all normal windows
- `opacity` -- 0.1 to 1.0, per-window transparency
- `isRolledUp` -- boolean, window collapsed to title bar only

### Skin Loader (`js/skin-loader.js`)

Provides a **skin registry** and UIS parser. Skins self-register by placing a `skin.js` IIFE in their folder (e.g., `skins/LUNAX/skin.js`) that writes to `SZ.skins.LUNAX`. These scripts are loaded via `<script defer>` before the engine scripts. The loader provides:

- `SZ.getSkin(name)` -- case-insensitive lookup from the registry
- `SZ.getAvailableSkins()` -- returns all registered skin names
- `SZ.parseUIS(text, basePath)` -- parse a raw UIS INI string into a skin object
- `SZ.loadSkinFromFolder(basePath)` -- fetch and parse a skin.uis from a URL
- `SZ.resolveSkin(skin, subSkinId)` -- shallow-copy a skin with sub-skin color overrides merged in

**Supported input formats:**

1. **Self-registering skin.js** -- Each skin folder contains a `skin.js` that populates `SZ.skins` with a pre-built skin object. All 21 bundled skins use this format.

2. **UIS directory** -- A folder containing a `.uis` text file and its companion BMP/image files. The `.uis` file is fetched, parsed as INI, and image paths are resolved relative to the skin folder.

3. **WBA archive** -- A WindowBlinds `.wba` file (RAR archive). Loaded via `<input type="file">`, decompressed using a WASM-based unrar library, and the contained `.uis` + images are extracted into memory as blob URLs. This enables drag-and-drop skin installation.

**UIS parsing** produces a skin object:

```js
{
  name: 'Luna Extended',
  author: 'scratch',
  personality: {
    top: { src, topHeight, bottomHeight, stretch, frames },
    left: { src, topHeight, bottomHeight, stretch, frames },
    right: { src, topHeight, bottomHeight, stretch, frames },
    bottom: { src, topHeight, bottomHeight, stretch, frames },
    titleText: { alignment, shiftX, shiftY, rightClip },
    transparency: false,
    mouseoverButtons: true,
    tripleImages: true,    // 6-state buttons (normal/hover/pressed x active/inactive)
  },
  buttons: [
    { src, x, y, align, action, visibility, linkedTo },
    ...
  ],
  colors: {
    activeTitle, inactiveTitle, titleText, inactiveTitleText,
    window, windowText, menu, menuText, highlight, highlightText,
    buttonFace, buttonShadow, buttonHighlight, ...
  },
  fonts: {
    title: { family, size, weight, italic, antialiased },
    menu: { ... },
  },
  controls: {
    pushButton: {
      src, mask,                         // BUTTONS.BMP + BUTTONSM.BMP
      topHeight, bottomHeight,           // 9-slice parameters
      leftWidth, rightWidth,
      mouseover,                         // hover state enabled
      frameCount,                        // animation frames (default 1)
      tile,                              // 0=stretch, 1=tile
      normalFont, pressedFont,           // font style index
      disabledFont, focusFont,
      mouseoverFont,
    },
    checkbox: {
      src, mask,                         // CHECK.BMP + CHECKM.BMP
      topHeight, bottomHeight,
      leftWidth, rightWidth,
      mouseover,
    },
    radio: {
      src, mask,                         // RADIO.BMP
      topHeight, bottomHeight,
      leftWidth, rightWidth,
      mouseover,
    },
    comboButton: {
      src,                               // COMBOBUTTON.BMP
      leftWidth, rightWidth,
      topHeight, bottomHeight,
      mouseover, tile,
    },
    startButton: { src },
  },
  menubar: { src, borderSrc },
  dialog: { src },
  explorer: { src },
  subSkins: [                     // optional color scheme variants
    { id: 'default', name: 'Blue (Default)' },
    { id: 'olive', name: 'Olive Green', colors: { activeTitle, ... } },
  ],
}
```

### Skin CSS Generator (`js/skin-css-generator.js`)

`SZ.generateSkinCSS(skin)` runs once per skin load and generates a `<style id="sz-skin-frames">` element that drives all 9-cell window frames via pure CSS:

- **Frame borders**: Each border BMP (top/left/right/bottom) is loaded into canvas, split into animation frames, processed for magenta transparency (`usestran=1`) and mask BMPs (greyscale alpha), then cut into 3 zones: Zone A (fixed start), Zone B (tiled/stretched middle), Zone C (fixed end). Each zone maps to a CSS grid cell (nw/n/ne/w/e/sw/s/se). Static skins (frameCount <= 2) get simple `.sz-window-active` / `:not(.sz-window-active)` rules. Animated skins (frameCount >= 3) use `@keyframes` with `steps(1)` for active state, static last-frame for inactive state. No `setInterval` — all animation is CSS-driven.
- **Corner extension columns**: When a skin's TOP/BOTTOM zone A or zone C width exceeds the LEFT/RIGHT border width (common with ornamental skins like AQUARIUM), the generator computes extension column widths (`--sz-frame-nw-ext`, `--sz-frame-ne-ext`) so corner cells can be wider than side border cells without distorting the layout.
- **Title bar buttons**: Each button image contains 3 or 6 states in a horizontal strip. CSS `object-fit` and `object-position` clip to the active state. Hover and pressed states are applied via CSS classes toggled by pointer events. Button visibility is controlled by the window's state (maximized, minimized, normal) using the skin's visibility bitmask.
- **Colors and fonts**: Mapped to CSS custom properties on the window element (`--sz-title-color`, `--sz-title-font`, etc.) so they cascade naturally.

**Button actions** (from UIS spec):

| Code | Action                    |
| ---- | ------------------------- |
| 0    | Close                     |
| 1    | Maximize                  |
| 2    | Minimize                  |
| 3    | Help                      |
| 22   | Maximize / Restore toggle |
| 23   | Minimize / Unroll toggle  |

**Button alignment**: `align=0` positions from top-left, `align=1` from top-right. Coordinates are pixel offsets from the respective corner.

**Button visibility bitmask** (5-bit):

- Bit 0: Show when normal
- Bit 1: Show when minimized
- Bit 2: Show when maximized
- Bit 3: Show when rolled up
- Bit 4: Show when restored from maximize

### Theme Engine (`js/theme-engine.js`)

Responsible for making applications inside windows look native to the current skin. When a skin is loaded, the theme engine generates a CSS stylesheet from the skin's color palette, control images, and font definitions. This stylesheet is injected into every application iframe so that standard HTML form controls (buttons, checkboxes, radio buttons, select dropdowns, text inputs, scrollbars) are styled to match the active skin -- just like a native OS theme.

**How it works:**

1. **Skin loaded/changed** -> `theme-engine.js` receives the parsed skin object
2. **CSS generation** -> Builds a `<style>` element containing:
   - CSS custom properties for all 29 Windows system colors
   - Override rules for standard HTML controls using skin images and colors
   - Scrollbar theming
   - Font definitions
   - Cursor theme references
3. **Injection into iframes** -> For each open window's iframe (same-origin access via `iframe.contentDocument`), the generated `<style>` element is inserted into `<head>`, replacing any previously injected theme style
4. **New windows** -> When a window opens and its iframe finishes loading, the current theme is injected immediately
5. **Skin change** -> All existing iframes are re-injected with the new theme. Since it's pure CSS replacement, the change is instantaneous.

**Generated CSS structure:**

```css
/* ===== SZ Theme: Luna Extended ===== */

:root {
  /* Windows system colors from [Colours] section */
  --sz-color-window: rgb(255, 255, 255);
  --sz-color-window-text: rgb(0, 0, 0);
  --sz-color-button-face: rgb(238, 237, 227);
  --sz-color-button-text: rgb(0, 0, 0);
  --sz-color-button-shadow: rgb(202, 198, 175);
  --sz-color-button-highlight: rgb(255, 255, 255);
  --sz-color-button-dark-shadow: rgb(128, 128, 128);
  --sz-color-button-light: rgb(250, 250, 245);
  --sz-color-highlight: rgb(49, 106, 197);
  --sz-color-highlight-text: rgb(255, 255, 255);
  --sz-color-gray-text: rgb(202, 198, 175);
  --sz-color-menu: rgb(238, 237, 227);
  --sz-color-menu-text: rgb(0, 0, 0);
  --sz-color-scrollbar: rgb(210, 225, 249);
  --sz-color-info-text: rgb(0, 0, 0);
  --sz-color-info-window: rgb(255, 255, 225);
  --sz-color-active-title: rgb(0, 82, 222);
  --sz-color-inactive-title: rgb(72, 111, 177);
  --sz-color-hot-tracking: rgb(0, 0, 255);
  /* ... all 29 entries ... */

  /* Font from skin */
  --sz-font-family: 'Trebuchet MS', Tahoma, sans-serif;
  --sz-font-size: 12px;
  --sz-font-weight: 400;

  /* Cursor theme */
  --sz-cursor-default: url('../assets/cursors/default/normal.cur'), default;
  --sz-cursor-pointer: url('../assets/cursors/default/pointer.cur'), pointer;
  --sz-cursor-move: url('../assets/cursors/default/move.cur'), move;
  --sz-cursor-text: url('../assets/cursors/default/text.cur'), text;
}

/* Base document styling — zero specificity via :where() */
/* Any app CSS (even bare element selectors) naturally overrides these defaults */
:where(body) {
  background: var(--sz-color-button-face);
  color: var(--sz-color-window-text);
  font-family: var(--sz-font-family);
  font-size: var(--sz-font-size);
  margin: 0;
}

/* Push buttons - 9-slice from skin's BUTTONS.BMP */
button, input[type="button"], input[type="submit"], input[type="reset"] {
  background-color: var(--sz-color-button-face);
  color: var(--sz-color-button-text);
  border: 2px outset var(--sz-color-button-highlight);
  border-color: var(--sz-color-button-highlight) var(--sz-color-button-dark-shadow)
                var(--sz-color-button-dark-shadow) var(--sz-color-button-highlight);
  font-family: var(--sz-font-family);
  /* When skin provides BUTTONS.BMP: */
  border-image: url('...blob or data URL...') <top> <right> <bottom> <left> fill stretch;
}
button:hover {
  /* Shift to hover frame in sprite */
  border-image-source: url('...hover slice...');
}
button:active {
  border-image-source: url('...pressed slice...');
}
button:disabled {
  color: var(--sz-color-gray-text);
  border-image-source: url('...disabled slice...');
}

/* Checkboxes - sprite from skin's CHECK.BMP */
input[type="checkbox"] {
  appearance: none;
  width: 13px; height: 13px;
  background-image: url('...checkbox sprite blob...');
  background-position: 0 0;           /* unchecked-normal */
}
input[type="checkbox"]:checked {
  background-position: -13px 0;       /* checked-normal */
}
input[type="checkbox"]:hover {
  background-position: 0 -13px;       /* unchecked-hover */
}
input[type="checkbox"]:checked:hover {
  background-position: -13px -13px;   /* checked-hover */
}

/* Radio buttons - sprite from skin's RADIO.BMP */
input[type="radio"] {
  appearance: none;
  width: 13px; height: 13px;
  background-image: url('...radio sprite blob...');
  background-position: 0 0;
}
input[type="radio"]:checked {
  background-position: -13px 0;
}

/* Select / combo box */
select {
  background-color: var(--sz-color-window);
  color: var(--sz-color-window-text);
  border: 1px solid var(--sz-color-button-shadow);
}

/* Text inputs */
input[type="text"], input[type="password"], textarea {
  background-color: var(--sz-color-window);
  color: var(--sz-color-window-text);
  border: 2px inset var(--sz-color-button-shadow);
  border-color: var(--sz-color-button-shadow) var(--sz-color-button-highlight)
                var(--sz-color-button-highlight) var(--sz-color-button-shadow);
  font-family: var(--sz-font-family);
}

/* Focus ring */
:focus-visible {
  outline: 1px dotted var(--sz-color-window-text);
  outline-offset: -1px;
}

/* Selection */
::selection {
  background: var(--sz-color-highlight);
  color: var(--sz-color-highlight-text);
}

/* Scrollbars (Webkit + Firefox) */
::-webkit-scrollbar { width: 16px; height: 16px; }
::-webkit-scrollbar-track { background: var(--sz-color-scrollbar); }
::-webkit-scrollbar-thumb { background: var(--sz-color-button-face);
  border: 1px solid var(--sz-color-button-shadow); }
::-webkit-scrollbar-button { background: var(--sz-color-button-face); }
* { scrollbar-color: var(--sz-color-button-face) var(--sz-color-scrollbar); }

/* Tooltips */
[title]:hover::after {
  background: var(--sz-color-info-window);
  color: var(--sz-color-info-text);
}

/* Links */
a { color: var(--sz-color-hot-tracking); }

/* Disabled state */
:disabled {
  color: var(--sz-color-gray-text);
  cursor: var(--sz-cursor-default);
}

/* Cursor overrides */
a, button, [role="button"] { cursor: var(--sz-cursor-pointer); }
input[type="text"], textarea { cursor: var(--sz-cursor-text); }
```

**Control image processing:**

When the skin provides BMP images for controls (BUTTONS.BMP, CHECK.BMP, RADIO.BMP, COMBOBUTTON.BMP), the theme engine:

1. Loads each BMP into an offscreen `<canvas>`
2. Reads the skin's slice parameters (`topHeight`, `bottomHeight`, `leftWidth`, `rightWidth`) and frame count
3. For multi-state sprites, cuts individual state frames (normal, hover, pressed, disabled) into separate canvas regions
4. Exports each as a data URL or blob URL
5. References them in the generated CSS via `background-image` or `border-image`

If a skin does not provide control images, the theme engine falls back to pure CSS styling using the skin's color palette (the 3D border approach shown above). This graceful fallback ensures every skin provides at minimum a color-matched UI, even without custom control bitmaps.

**Injection mechanics:**

```js
// theme-engine.js (simplified)
class ThemeEngine {
  #styleText = '';

  generateFromSkin(skin) {
    this.#styleText = this.#buildCSS(skin);
  }

  injectInto(iframe) {
    const doc = iframe.contentDocument;
    let el = doc.getElementById('sz-theme');
    if (!el) {
      el = doc.createElement('style');
      el.id = 'sz-theme';
      doc.head.appendChild(el);
    }
    el.textContent = this.#styleText;
  }

  updateAll(windowManager) {
    for (const win of windowManager.windows)
      if (win.iframe?.contentDocument)
        this.injectInto(win.iframe);
  }
}
```

The window manager calls `themeEngine.injectInto(iframe)` on each iframe's `load` event and `themeEngine.updateAll(windowManager)` on every skin change.

**Desktop-level theming:**

The same CSS custom properties are also set on the main document's `:root`. This themes the taskbar, desktop context menus, and any other UI chrome outside of windows. The desktop also applies cursor theme properties globally:

```css
/* Applied to main document */
html { cursor: var(--sz-cursor-default); }
.sz-window .sz-resize-n, .sz-window .sz-resize-s { cursor: var(--sz-cursor-resize-ns); }
.sz-window .sz-resize-e, .sz-window .sz-resize-w { cursor: var(--sz-cursor-resize-ew); }
/* etc. */
```

### Control Panel — Display Properties (`Applications/control-panel/`)

A built-in application modeled after the Windows XP Display Properties dialog. Three tabs provide theme presets, skin, and background configuration. Communicates with the desktop via `postMessage` to apply changes.

**Tabs:**

#### Themes

- **Preset list**: Curated theme combinations (skin + background) for one-click appearance changes. Includes "SynthelicZ Default" (LUNAX + default.jpg), "Classic" (WIN98), "Aquarium", "Nature" (XPNATURE), and more.
- **Color swatch**: Each theme shows a preview strip with the skin's title bar gradient colors.
- **Apply**: Sets both skin and background in one action.

#### Appearance

- **Preview monitor**: CRT-style monitor mockup showing a miniature window with the selected skin's colors applied (title bar gradient, window background, button face, taskbar gradient). Updates live when a different skin is selected.
- **Skin list**: Scrollable list of all available skins (bundled + user-installed) with color swatch strips showing the title bar gradient. Auto-scrolls to the currently active skin on load. Selecting a skin updates the preview immediately.
- **Color scheme dropdown**: Shown only when the selected skin contains sub-skins (style variants). Selecting a variant live-updates the preview monitor. Choice is sent with the skin application message and persisted to localStorage. LUNAX ships with Blue/Olive Green/Silver/Royale variants; XPNATURE has Forest/Autumn/Ocean; BLUECURVE has Blue/Green/Red; dinksDX Blue has Blue/Graphite/Green.
- **Font info**: Displays the selected skin's font family and weight.
- **Apply**: Sends `sz:setSkin` message to desktop. Desktop loads the skin, updates all window chrome, and re-injects theme CSS into all app iframes.

#### Desktop (Background)

- **Preview monitor**: Shows the selected background image with the current position mode applied.
- **Background list**: Scrollable list of available backgrounds (bundled from `assets/backgrounds/` + `(None)` option). Selecting updates the preview.
- **Position dropdown**: Stretch, Fit, Fill, Center, Tile — maps to CSS `object-fit` modes and tile repeat.
- **Browse button**: File picker to upload custom background images. The image is stored and sent to the desktop as a data URL.

**Bottom bar**: OK (apply + close), Cancel (revert + close), Apply (apply without closing).

**postMessage protocol (control panel -> desktop):**

```js
// Skin
{ type: 'sz:setSkin', skinName: 'LUNAX' }                         // default sub-skin
{ type: 'sz:setSkin', skinName: 'LUNAX', subSkin: 'olive' }       // specific sub-skin
{ type: 'sz:installSkin', wbaFile: File }                         // File object from picker

// Background
{ type: 'sz:setBackground', src: 'path/to/image.jpg', mode: 'cover' }

// Close window
{ type: 'sz:close' }
```

**postMessage protocol (desktop -> control panel):**

On load, the control panel sends `{ type: 'sz:getSettings' }` and the desktop replies with:

```js
{
  type: 'sz:settings',
  skin: 'LUNAX',
  subSkin: 'olive',              // currently active sub-skin ('' if default)
  availableSkins: [
    { id: 'LUNAX', displayName: 'Luna Extended', colors: { ... }, fonts: { ... },
      subSkins: [{ id: 'default', name: 'Blue (Default)' }, { id: 'olive', name: 'Olive Green', colors: { ... } }, ...] },
    { id: 'AQUARIUM', displayName: 'Aquarium', colors: { ... }, fonts: { ... }, subSkins: null },
  ],
  background: { src: 'assets/backgrounds/default.jpg', mode: 'cover' },
  availableBackgrounds: [{ name: 'Bliss', src: 'assets/backgrounds/default.jpg' }],
  cursor: { shadow: false, trail: false, trailLen: 5 },
}
```

### Application System (`Applications/`)

Each application is a self-contained folder:

```
Applications/
  manifest.json
  encryptor/
    index.html
    icon.png
  settings/
    index.html
    icon.png
```

**manifest.json** format:

```json
{
  "applications": [
    {
      "id": "encryptor",
      "title": "Data Encryption",
      "iconName": "app-encryptor",
      "icon": "encryptor/icon.png",
      "entry": "encryptor/index.html",
      "width": 512,
      "height": 412,
      "resizable": true,
      "minimizable": true,
      "maximizable": true,
      "singleton": true,
      "description": "Encrypt and decrypt text data"
    },
    {
      "id": "control-panel",
      "title": "Control Panel",
      "iconName": "app-control-panel",
      "icon": "control-panel/icon.png",
      "entry": "control-panel/index.html",
      "width": 720,
      "height": 520,
      "resizable": true,
      "minimizable": true,
      "maximizable": true,
      "singleton": true,
      "description": "System appearance, behavior, and personalization"
    },
    {
      "id": "about",
      "title": "About SynthelicZ",
      "iconName": "app-about",
      "icon": "about/icon.svg",
      "entry": "about/index.html",
      "width": 440,
      "height": 510,
      "resizable": false,
      "minimizable": true,
      "maximizable": false,
      "singleton": true,
      "description": "Version, data-privacy notice, system details, credits, licensing, and donation info"
    }
  ]
}
```

The `iconName` field maps to the active icon pack's logical name. If the icon pack contains a matching entry, that image is used. Otherwise, the `icon` field is used as a direct path fallback.

**Application HTML requirements:**

- Must be a complete HTML document (own `<head>` and `<body>`)
- The theme engine injects default styles for `body`, buttons, inputs, selects, labels, tables, and other standard form elements using `:where()` selectors (zero specificity). Apps that include no CSS of their own get a fully themed Windows-like appearance for free.
- Receives the window's content area dimensions via the iframe's size
- Uses standard HTML form controls (`<button>`, `<input>`, `<select>`, `<textarea>`) -- they get themed automatically, no classes needed
- Apps that want custom styling simply write normal CSS -- any selector (even bare `body {}` or `button {}`) naturally overrides the zero-specificity theme defaults
- A `<div class="window">` gets a raised 3D window panel look; `.sunken`, `.raised`, `.etched`, `.status-bar` utility classes are also available
- No `!important` is needed anywhere -- the theme is a baseline default, not a forced override
- Communicate with the desktop via `postMessage` when needed (title changes, close requests, settings changes)
- Should work standalone (openable directly in a browser tab for development -- controls will appear unstyled, which is expected)

**Application-to-desktop communication** (via `window.postMessage`):

```js
// From inside an application iframe:
window.parent.postMessage({ type: 'sz:setTitle', title: 'New Title' }, '*');
window.parent.postMessage({ type: 'sz:close' }, '*');
window.parent.postMessage({ type: 'sz:resize', width: 800, height: 600 }, '*');

// Control panel specific:
window.parent.postMessage({ type: 'sz:getSettings' }, '*');            // Request current state
window.parent.postMessage({ type: 'sz:setSkin', skinName: 'LUNAX' }, '*');
window.parent.postMessage({ type: 'sz:installSkin', wbaFile: File }, '*');
window.parent.postMessage({ type: 'sz:setBackground', src: '...', mode: 'fill' }, '*');
window.parent.postMessage({ type: 'sz:setBackgroundColor', color: '#003366' }, '*');
window.parent.postMessage({ type: 'sz:setIconPack', packName: 'default' }, '*');
window.parent.postMessage({ type: 'sz:setCursorTheme', themeName: 'default' }, '*');
window.parent.postMessage({ type: 'sz:setSetting', key: 'animations', value: true }, '*');
window.parent.postMessage({ type: 'sz:cursorSetting', key: 'shadow', value: true }, '*');
window.parent.postMessage({ type: 'sz:cursorSetting', key: 'trail', value: true }, '*');
window.parent.postMessage({ type: 'sz:cursorSetting', key: 'trailLen', value: 7 }, '*');

// Common file dialogs (Open/Save):
window.parent.postMessage({ type: 'sz:fileOpen', filters: [{name:'Text Files', ext:['txt','md']}, {name:'All Files', ext:['*']}], initialDir: '/user/documents', requestId: 'r1' }, '*');
window.parent.postMessage({ type: 'sz:fileSave', filters: [...], defaultName: 'untitled.txt', content: '...', requestId: 'r1' }, '*');

// VFS operations (typed API — see docs/vfs.md):
window.parent.postMessage({ type: 'sz:vfs:List', path: '/user/documents' }, '*');
window.parent.postMessage({ type: 'sz:vfs:Stat', path: '/user/documents/file.txt' }, '*');
window.parent.postMessage({ type: 'sz:vfs:ReadAllText', path: '/user/documents/file.txt' }, '*');
window.parent.postMessage({ type: 'sz:vfs:ReadAllBytes', path: '/user/documents/file.txt' }, '*');
window.parent.postMessage({ type: 'sz:vfs:ReadUri', path: '/user/pictures/photo.png' }, '*');
window.parent.postMessage({ type: 'sz:vfs:ReadValue', path: '/user/desktop/My Computer.lnk' }, '*');
window.parent.postMessage({ type: 'sz:vfs:WriteAllBytes', path: '/user/documents/file.txt', bytes: [...] }, '*');
window.parent.postMessage({ type: 'sz:vfs:WriteValue', path: '/user/desktop/shortcut.lnk', value: { appId: 'notepad' } }, '*');
window.parent.postMessage({ type: 'sz:vfs:WriteUri', path: '/system/wallpapers/bg.jpg', uri: 'assets/bg.jpg' }, '*');
window.parent.postMessage({ type: 'sz:vfs:Delete', path: '/user/documents/file.txt' }, '*');
window.parent.postMessage({ type: 'sz:vfs:Mkdir', path: '/user/documents/subfolder' }, '*');
window.parent.postMessage({ type: 'sz:vfs:Move', from: '/user/documents/old.txt', to: '/user/documents/new.txt' }, '*');
window.parent.postMessage({ type: 'sz:vfs:Copy', from: '/user/documents/a.txt', to: '/user/documents/b.txt' }, '*');

// OS services:
window.parent.postMessage({ type: 'sz:messageBox', text: 'Hello', caption: 'Title', flags: 0 }, '*');
window.parent.postMessage({ type: 'sz:getSystemMetrics' }, '*');
window.parent.postMessage({ type: 'sz:regRead', key: 'myapp.setting' }, '*');
window.parent.postMessage({ type: 'sz:regWrite', key: 'myapp.setting', value: 42 }, '*');

// Desktop listens and routes to the correct window instance
```

**Desktop-to-application communication** (via `window.postMessage`):

```js
// Desktop sends to iframe's contentWindow in response to sz:getSettings:
iframe.contentWindow.postMessage({
  type: 'sz:settings',
  skin: 'LUNAX',
  subSkin: 'olive',              // currently active sub-skin ('' if default)
  availableSkins: [
    { id: 'LUNAX', displayName: 'Luna Extended', colors: { ... }, fonts: { ... },
      subSkins: [{ id: 'default', name: 'Blue (Default)' }, { id: 'olive', name: 'Olive Green', colors: { ... } }, ...] },
    { id: 'AQUARIUM', displayName: 'Aquarium', colors: { ... }, fonts: { ... }, subSkins: null },
  ],
  background: { src: 'assets/backgrounds/default.jpg', mode: 'cover' },
  availableBackgrounds: [{ name: 'Bliss', src: 'assets/backgrounds/default.jpg' }],
}, '*');
```

### Common File Dialogs (`js/common-dialogs.js`)

OS-level Open/Save dialogs modeled after the Windows XP comdlg32 file picker. Apps request dialogs via `postMessage`; the OS renders the dialog above all windows (z-index 9000) and returns results.

**API** (called internally by postMessage handlers):

```js
// Show Open dialog
const result = await commonDialogs.showOpen({
  filters: [{ name: 'Text Files', ext: ['txt', 'md'] }, { name: 'All Files', ext: ['*'] }],
  initialDir: '/user/documents',
  multiSelect: false,
  title: 'Open'
});
// result: { cancelled: false, path: '/user/documents/file.txt', content: '...' }

// Show Save As dialog
const result = await commonDialogs.showSave({
  filters: [...],
  initialDir: '/user/documents',
  defaultName: 'untitled.txt',
  title: 'Save As'
});
// result: { cancelled: false, path: '/user/documents/file.txt' }
```

**Dialog features**: XP-style sidebar (Documents, Desktop, Computer, Temp), directory navigation with history (back/up), editable path bar, file type filter dropdown, keyboard shortcuts (Escape/Enter/Backspace), skinned with CSS custom properties. The Open dialog includes an **Import** button for uploading files from the user's PC (browser file picker). The Save dialog includes a **Download** button for downloading files to the user's PC (when the app passes file content). These buttons appear automatically for all apps using the common dialogs.

**Apps using common dialogs**: Notepad (text files), Paint (image files), WordPad (HTML/RTF files), Image Viewer (image files), Markdown Editor (markdown files), Hex Editor (binary files), Spreadsheet (CSV/TSV files), README Generator (markdown files), Resume Builder (markdown files). WordPad and Spreadsheet also support browser-native Import/Export for binary formats (DOCX, XLSX) via `ComDlg32.ImportFile()`/`ComDlg32.ExportFile()`.

### FileSystem (`js/filesystem.js`)

Provides a dual-layer (System + Local) namespace for shell folders like Desktop and StartMenu. System items come from code (static, set during boot). Local items come from `localStorage` (user-added). Enumerating a folder returns the union, sorted by name.

**Classes:**

- `ShellItem` -- A single entry (shortcut, folder, separator) with name, icon, type, appId, and optional action callback
- `ShellFolder` -- A named container holding system items (added programmatically) and local items (persisted to localStorage). `getItems()` returns the merged, sorted list.
- `FileSystem` -- Top-level container with `desktop`, `startMenu` ShellFolder instances, and `programs` Map (category name -> ShellFolder) for categorized program organization

**Boot wiring:**

1. After the app manifest is loaded, the boot sequence creates a `FileSystem` instance
2. Desktop folder: only "My Computer" (launches Explorer) and "Recycle Bin" are added as system items
3. Start Menu folder: all non-hidden apps from the manifest are added as system items
4. Desktop icons are created from `fileSystem.desktop.getItems()`
5. Start menu is populated from `fileSystem.startMenu.getItems()`

This separates "which apps exist" (manifest) from "what appears on the desktop" (FileSystem), allowing the desktop to show only a curated set of icons while the start menu shows everything.

### Desktop (`js/desktop.js`)

- Renders the background image with configurable display modes:
  - **cover** (Stretch) — `<img>` with `object-fit: cover`, fills viewport
  - **contain** (Fit) — `<img>` with `object-fit: contain`, letterboxed
  - **fill** (Fill) — `<img>` with `object-fit: fill`, distorts to fill
  - **none** (Center) — `<img>` at natural size, centered via CSS transform
  - **tile** — hides `<img>`, uses CSS `background-image` with `background-repeat: repeat` on the desktop element
- Places desktop icons in a grid layout (CSS grid, auto-flowing top-to-bottom then left-to-right)
- Click on empty desktop area deactivates the focused window

### Taskbar (`js/taskbar.js`)

A bottom-anchored bar (default 35px, adapts to start button height) with:

- **Start button**: Skinned from WindowBlinds START.BMP (3-frame sprite: normal/hover/pressed). CSS `background-position` switches frames on hover and press. Taskbar height auto-adapts to the start button image height. Opens an XP-style two-column start menu.
- **Taskbar gradient**: Derived from the skin's `activeTitle`/`gradientActiveTitle` colors. Auto-contrast text color (white on dark taskbars, black on light) via luma calculation.
- **Window list**: One button per open (non-closed) window. Translucent buttons with CSS custom properties for bg/border/text colors set per-skin. Active window is highlighted. Clicking a minimized window's button restores it. Clicking the active window's button minimizes it.
- **System tray**: Clock showing time (HH:MM:SS), date, and ISO calendar week. Updates every second.

**Start menu (XP two-column layout):**

- Header: Blue gradient banner with user avatar and username
- Left column (white): **MRU view** (default) showing up to 6 most recently used apps, separator, and "All Programs" button. Seeds with Calculator, Notepad, Explorer on first boot.
- **All Programs view**: Click replaces left column with categorized program folders (Accessories, Entertainment, Games, Internet, System Tools). Hovering a category opens a **flyout submenu** to the right showing that category's apps. "Back" button returns to MRU view.
- Right column (beige): System items -- My Computer, My Documents, Control Panel, Task Manager, Search, Run
- Footer: Blue gradient strip with Log Off and Turn Off buttons
- MRU auto-updates when apps are launched (most recent at top, capped at 6)

### Context Menu (`js/context-menu.js`)

Windows XP-style right-click context menus with nested submenus:

**Desktop context menu:**

- Arrange Icons By (submenu: Name, Size, Type, Auto Arrange)
- Refresh
- New (submenu: Folder, Shortcut, Text Document)
- Properties (opens Control Panel)

**Taskbar context menu:**

- Toolbars (submenu)
- Cascade Windows / Tile Windows Horizontally / Tile Windows Vertically
- Show the Desktop / Undo Minimize All
- Task Manager (launches hidden task-manager app)
- Properties

### Standalone App Bootstrap (`Applications/sz-app-bootstrap.js`)

Shared library included by each application. When an app's `index.html` is opened directly (not inside the OS iframe), the bootstrap:

1. Detects that `window.parent === window` (not in an iframe)
2. Extracts the app ID from the URL path
3. Redirects to the OS `index.html?app={appId}&maximized=1`
4. The OS auto-launches the app maximized after boot

Provides Windows DLL-like API namespaces for all OS communication:

- `SZ.Dlls.User32` -- window management (SetWindowText, DestroyWindow, MoveWindow, MessageBox, GetSystemMetrics, RegisterWindowProc)
- `SZ.Dlls.Kernel32` -- VFS file operations (ReadFile, ReadAllText, ReadAllBytes, ReadUri, ReadValue, WriteFile, WriteAllBytes, WriteValue, WriteUri, FindFirstFile, DeleteFile, CreateDirectory, MoveFile, CopyFile, GetFileAttributes, GetCommandLine, MountLocalDirectory, UnmountDirectory, ListMounts)
- `SZ.Dlls.GDI32` -- system colors and fonts (GetSysColor, GetSysColorBrush, GetSystemFont)
- `SZ.Dlls.Shell32` -- app launching and special folders (ShellExecute, SHGetFolderPath, SHFileOperation, SHGetFileTypeAssociations)
- `SZ.Dlls.ComDlg32` -- file open/save dialogs (GetOpenFileName, GetSaveFileName, ImportFile, ExportFile)
- `SZ.Dlls.Advapi32` -- settings/registry (RegQueryValue, RegSetValue)

### Zoom Control (`Applications/zoom-control.js`)

Shared reusable component providing a unified status-bar zoom UI across nine applications. Attaches `SZ.ZoomControl` to the global namespace.

**DOM created**: `<span class="sz-zoom-control">` containing a `-` button, range slider, `+` button, and editable text input.

**API**:
- `new SZ.ZoomControl(containerEl, { min, max, step, value, formatLabel, parseLabel, onChange, onZoomIn, onZoomOut })`
- `ctrl.value = n` -- programmatic update (does not fire onChange)
- `ctrl.destroy()` -- cleanup

**CSS**: Injected once via `:where()` selectors (zero specificity) using `--sz-color-*` theme variables. Apps can override styles without `!important`.

**Used by**: Spreadsheet, WordPad, Function Plotter, Markdown Editor, Notepad, Paint, Image Viewer, SVG Editor, Icon Editor.

### Pointer Handler (`js/pointer-handler.js`)

Unified input handling using `pointerdown` / `pointermove` / `pointerup`:

- **Window dragging**: Initiated by pointerdown on title bar. Uses `setPointerCapture` for reliable tracking. Moves the window element via `translate3d` for GPU-composited movement.
- **Window resizing**: Initiated by pointerdown on resize handles (8 zones: N, NE, E, SE, S, SW, W, NW). Cursor changes to appropriate resize cursor. Minimum window size enforced (200x100).
- **Icon selection**: Single-click selects, double-click launches.
- **Desktop rubber-band selection**: Click-drag on desktop draws selection rectangle, selects enclosed icons.

### Cursor Effects (`js/cursor-effects.js`)

Mouse cursor enhancements managed by the `CursorEffects` class:

- **Mouse shadow**: A semi-transparent dark silhouette of the cursor that follows with a slight offset (3px X/Y). Implemented as an absolutely-positioned div with a blurred, darkened cursor image. Toggled via settings.
- **Mouse trail**: A series of fading cursor images trailing behind the pointer as it moves. Each trail element is an absolutely-positioned div that fades from 0.4 opacity to near-zero. The number of trail elements is configurable (3-10). Positions are captured at 50ms intervals on `pointermove`.
- **Custom cursors**: Supports setting custom cursor images (PNG, CUR). When no custom image is set, a built-in SVG arrow is used for shadow/trail rendering.
- **Overlay container**: All effect elements live in a fixed, pointer-events-transparent `#sz-cursor-effects` div at z-index 99999.

Settings are stored in localStorage via `SZ.Settings`:
- `cursor.shadow` (boolean) -- enable/disable mouse shadow
- `cursor.trail` (boolean) -- enable/disable mouse trail
- `cursor.trailLen` (number) -- trail length (3-10 elements)

The Control Panel's Pointers tab provides checkboxes for shadow/trail and a slider for trail length, with a live preview area.

### Settings Persistence (`js/settings.js`)

User preferences stored in `localStorage`:

- `sz-skin` -- name of active skin
- `sz-subSkin` -- ID of active sub-skin / color scheme (empty string for default)
- `sz-background` -- JSON: `{ src, mode }` (image path + stretch mode)
- `sz-icon-pack` -- name of active icon pack
- `sz-cursor-theme` -- name of active cursor theme
- `sz-cursor.shadow` -- boolean: enable/disable mouse shadow effect
- `sz-cursor.trail` -- boolean: enable/disable mouse trail effect
- `sz-cursor.trailLen` -- number (3-10): mouse trail length
- `sz-behavior` -- JSON: `{ animations, edgeSnapping, taskbarPosition, taskbarAutoHide, doubleClickSpeed }`
- `sz-icon-layout` -- serialized icon positions (if user rearranged)
- `sz-window-prefs` -- per-application last-used size/position

---

## Skin Format Reference

See [docs/skin-format-reference.md](docs/skin-format-reference.md) for the comprehensive specification covering WBA, WSZ, UIS1, UIS1+, UIS2, compound skins (SSD/SSS), and the SZ native skin.js format.

### UIS File Structure (Summary)

The `.uis` file is a plain-text INI file with these sections:

```ini
[TitlebarSkin]
SkinName=Luna Extended
SkinAuthor=scratch
AuthorsURL=http://...
AuthorEmail=author@example.com
WBVer=200                          ; WindowBlinds version (200 = v2.0)

[Personality]
; Frame images (paths relative to skin folder)
Top=frametop.bmp
Left=frameleft.bmp
Right=frameright.bmp
Bottom=framebottom.bmp

; Optional transparency masks
TopMask=frametopmask.bmp
LeftMask=frameleftmask.bmp
RightMask=framerightmask.bmp
BottomMask=framebottommask.bmp

; 9-slice parameters (pixels)
TopTopHeight=10                    ; Height of top row in top frame image
TopBotHeight=10                    ; Height of bottom row in top frame image
LeftTopHeight=20                   ; Top section of left frame
LeftBotHeight=20                   ; Bottom section of left frame
RightTopHeight=20
RightBotHeight=20
BottomTopHeight=6
BottomBotHeight=6

; Stretch vs tile (0=tile, 1=stretch)
TopStretch=1
LeftStretch=1
RightStretch=1
BottomStretch=1

; Animation frames per direction (1 = static)
TopFrame=2                         ; Image width / TopFrame = single frame width
LeftFrame=2
RightFrame=2
BottomFrame=2

; Title text positioning
TextAlignment=0                    ; 0=left, 1=center, 2=right
TextShift=20                       ; Horizontal offset (px)
TextShiftVert=4                    ; Vertical offset (px)
TextRightClip=80                   ; Reserve space for buttons (px)

; Button behavior
ButtonCount=18
MouseOver=1                        ; Hover effects enabled
TripleImages=1                     ; 6-state buttons (2 rows x 3 cols)

; Title text colors (RGB 0-255)
ActiveTextR=255
ActiveTextG=255
ActiveTextB=255
InactiveTextR=180
InactiveTextG=180
InactiveTextB=180

; Features
UsesTran=0                         ; Uses transparency masks
RollupSize=26                      ; Height when rolled up (px)

[Button0]
ButtonImage=close.bmp
XCoord=25                          ; Offset from aligned corner
YCoord=4                           ; Offset from top
Align=1                            ; 0=left, 1=right
Action=0                           ; 0=close, 1=max, 2=min, 22=max/restore
Visibility=31                      ; 5-bit mask (see below)

[Button1]
; ... more buttons ...

[Colours]                          ; All 29 Windows system colors (space-separated RGB)
Scrollbar=210 225 249              ; Scrollbar track background          -> --sz-color-scrollbar
Background=15 92 190               ; Desktop background                  -> --sz-color-background
ActiveTitle=0 82 222               ; Active title bar gradient start     -> --sz-color-active-title
InactiveTitle=72 111 177           ; Inactive title bar gradient start   -> --sz-color-inactive-title
Menu=238 237 227                   ; Menu/toolbar background             -> --sz-color-menu
Window=255 255 255                 ; Window/input background             -> --sz-color-window
WindowFrame=127 157 185            ; Window border/frame                 -> --sz-color-window-frame
MenuText=0 0 0                     ; Menu text                           -> --sz-color-menu-text
WindowText=0 0 0                   ; Window/body text                    -> --sz-color-window-text
TitleText=255 255 255              ; Active title bar text               -> --sz-color-title-text
ActiveBorder=238 237 227           ; Active window border fill           -> --sz-color-active-border
InactiveBorder=238 237 227         ; Inactive window border fill         -> --sz-color-inactive-border
AppWorkspace=112 145 224           ; MDI/workspace background            -> --sz-color-app-workspace
Hilight=49 106 197                 ; Selection/highlight background      -> --sz-color-highlight
HilightText=255 255 255            ; Selection/highlight text            -> --sz-color-highlight-text
ButtonFace=238 237 227             ; Button/control face color           -> --sz-color-button-face
ButtonShadow=202 198 175           ; Button shadow (3D bottom-right)     -> --sz-color-button-shadow
GrayText=202 198 175               ; Disabled/grayed text                -> --sz-color-gray-text
ButtonText=0 0 0                   ; Button label text                   -> --sz-color-button-text
InactiveTitleText=189 204 228      ; Inactive title bar text             -> --sz-color-inactive-title-text
ButtonHilight=255 255 255          ; Button highlight (3D top-left)      -> --sz-color-button-highlight
ButtonDkShadow=128 128 128         ; Button dark shadow (outer edge)     -> --sz-color-button-dark-shadow
ButtonLight=250 250 245            ; Button light edge                   -> --sz-color-button-light
InfoText=0 0 0                     ; Tooltip text                        -> --sz-color-info-text
InfoWindow=255 255 225             ; Tooltip background                  -> --sz-color-info-window
ButtonAlternateFace=242 240 240    ; Alternate button face               -> --sz-color-button-alt-face
HotTrackingColor=0 0 255           ; Hot-tracked links/items             -> --sz-color-hot-tracking
GradientActiveTitle=0 0 255        ; Active title gradient end           -> --sz-color-gradient-active-title
GradientInactiveTitle=192 192 192  ; Inactive title gradient end         -> --sz-color-gradient-inactive-title

[Font0]
FontName=Trebuchet MS
FontHeight=19
FontWeight=600                     ; 400=normal, 700=bold
AntiAlias=1

[Buttons]                          ; Form control widgets (NOT window title bar buttons)
CheckButton=checkbox.bmp           ; Checkbox sprite (states: unchecked/checked x normal/hover/pressed)
CheckButtonMask=checkboxm.bmp      ; Optional alpha mask
RadioButton=radio.bmp              ; Radio button sprite (states: unselected/selected x normal/hover/pressed)
Bitmap=buttons.bmp                 ; Push button 9-slice sprite (states in horizontal strip)
BitmapMask=buttonsm.bmp            ; Optional alpha mask
TopHeight=3                        ; 9-slice top cap (px)
BottomHeight=3                     ; 9-slice bottom cap (px)
LeftWidth=3                        ; 9-slice left cap (px)
RightWidth=3                       ; 9-slice right cap (px)
MouseOver=1                        ; Hover state enabled
FrameCount=5                       ; Number of state frames in push button sprite
Tile=0                             ; 0=stretch, 1=tile the middle section
NormalFont=0                       ; Font style index for normal state
PressedFont=0                      ; Font style index for pressed state
DisabledFont=0                     ; Font style index for disabled state
FocusFont=2                        ; Font style index for focused state
MouseOverFont=2                    ; Font style index for hover state

[ComboButton]                      ; Dropdown/combo box button
Image=combo.bmp
LeftWidth=1
RightWidth=1
TopHeight=1
BottomHeight=1
MouseOver=1
Tile=0
```

### 3-Zone Frame Rendering

Each frame direction image contains animation frames stacked in the image. **TOP/BOTTOM** borders stack frames **vertically** (divide image height by frameCount). **LEFT/RIGHT** borders stack frames **horizontally** (divide image width by frameCount).

Each extracted frame is then split into 3 zones:

```
Horizontal border (TOP or BOTTOM):
 Frame extracted from sprite sheet, e.g., 220px wide x 28px tall
 TopTopHeight=10 (Zone A), TopBotHeight=10 (Zone C)

 [Zone A: 10px] [Zone B: 200px tiled/stretched] [Zone C: 10px]
  fixed left        fills remaining width         fixed right

Vertical border (LEFT or RIGHT):
 Frame extracted, e.g., 7px wide x 197px tall
 LeftTopHeight=20 (Zone A), LeftBotHeight=20 (Zone C)

 [Zone A: 20px]   <- fixed top
 [Zone B: 157px]  <- fills remaining height (tiled or stretched)
 [Zone C: 20px]   <- fixed bottom
```

The renderer uses canvas to extract each zone from each animation frame, then applies them as **CSS multiple backgrounds** (3 layers per element). Only `background-image` changes during animation; position/size/repeat remain static. On `file://` where canvas taints, falls back to a single repeating background.

### Button State Layout

When `TripleImages=1`, each button image contains a 3x2 grid:

```
[Normal      ] [Hover      ] [Pressed      ]   <- Active window
[Normal-Inact] [Hover-Inact] [Pressed-Inact]   <- Inactive window
```

When `TripleImages=0`, single row:

```
[Normal] [Hover] [Pressed]
```

State width = image width / 3. State height = image height / (tripleImages ? 2 : 1).

### Button Visibility Bitmask

5-bit mask controlling when a button is visible:

| Bit | Value | Window State      |
| --- | ----- | ----------------- |
| 0   | 1     | Normal (restored) |
| 1   | 2     | Minimized         |
| 2   | 4     | Maximized         |
| 3   | 8     | Rolled up         |
| 4   | 16    | Not maximized     |

`Visibility=31` (all bits) = always visible. `Visibility=20` (bits 2+4) = visible when maximized or not-maximized = always, but used with paired buttons. Common patterns: close button = 31, maximize = 19 (show when normal/rolled/not-maximized), restore = 4 (show only when maximized).

---

## Feature List

### Core Desktop

- [x] ~~Original 2004 implementation~~ (archived)
- [x] Desktop surface with configurable background image (cover, contain, fill, center, tile modes)
- [x] Desktop icon grid (auto-layout, top-to-bottom then left-to-right)
- [x] Desktop icon double-click to launch application
- [x] Desktop icon single-click to select
- [x] Desktop right-click context menu (XP-style with Arrange Icons, Refresh, New, Properties → opens Display Properties to Desktop tab)
- [x] Desktop icon drag-and-drop repositioning (free-form placement, positions saved to localStorage)
- [ ] Rubber-band selection of multiple icons on desktop
- [x] Taskbar with skinned window list buttons (translucent white on Luna gradient)
- [x] Taskbar clock with seconds, date, and ISO calendar week (updates every 1s)
- [x] Taskbar right-click context menu (Cascade/Tile, Show Desktop, Task Manager, Properties → opens Display Properties to Taskbar tab)
- [x] Taskbar auto-hide mode (configurable via Display Properties Taskbar tab)
- [x] Cascade Windows (diagonal offset arrangement via taskbar context menu)
- [x] Tile Windows Horizontally (stack windows vertically via taskbar context menu)
- [x] Tile Windows Vertically (side-by-side arrangement via taskbar context menu)
- [x] Skinned start button (from WindowBlinds START.BMP, multi-frame hover/pressed states)
- [x] XP-style two-column start menu with MRU (Most Recently Used) apps, "All Programs" with categorized flyout submenus
- [x] MRU tracking: recently launched apps appear at top of start menu, auto-updated on launch
- [x] All Programs flyout: categorized program folders (Accessories, Games, Entertainment, Internet, System Tools) with hover submenus
- [x] Small icons mode in start menu (configurable via Display Properties Taskbar tab)
- [x] OS-level common file dialogs (Open/Save As) used by Notepad, Paint, WordPad, Image Viewer, Markdown Editor, Hex Editor, Spreadsheet
- [x] Boot screen overlay during initial skin/asset loading
- [x] Boot screen: pure CSS fallback animation (pulsing SZ logo, bouncing dots, progress bar)
- [ ] Boot screen: animated GIF mode
- [ ] Boot screen: BMP/PNG frame sequence mode at configurable FPS
- [x] Skin image pre-loading with progress reporting during boot
- [x] SEO metadata on all pages (meta descriptions, Open Graph, Twitter Cards, JSON-LD, noscript fallback, robots.txt, sitemap.xml, llms.txt)

### Window Manager

- [x] Create windows with unique HWND identifiers
- [x] Cascading window placement (offset each new window by 32px)
- [x] Z-order stack with bring-to-front on focus
- [x] Click on desktop deactivates focused window
- [x] Active/inactive title bar distinction (colors from skin)
- [x] Window state: normal
- [x] Window state: minimized (with taskbar button to restore)
- [x] Window state: maximized (fills desktop area above taskbar)
- [x] Window state: closed (removed from DOM and registry)
- [x] Window close: instant removal (no animation, Windows XP style)
- [x] Window minimize: shrink/fade animation toward taskbar button
- [x] Window restore from minimize: expand from taskbar button position
- [x] Window maximize: grow animation with opacity flash
- [x] Window restore from maximize: shrink animation with opacity flash
- [x] Animations toggle in Control Panel (Taskbar > Effects) stored in localStorage
- [ ] Edge snapping (drag to left/right/top edge)
- [x] Minimum window size enforcement (200x100)

### Window Interaction

- [x] Title bar drag to move (pointer capture, GPU-composited via translate3d)
- [x] 8-direction resize handles (N, NE, E, SE, S, SW, W, NW)
- [x] Appropriate cursor on resize handles
- [x] Title bar double-click to maximize/restore toggle
- [x] Window button: close
- [x] Window button: minimize
- [x] Window button: maximize / restore toggle
- [x] Button hover highlight (from skin states)
- [x] Button pressed state (from skin states)

### Skin System

- [x] Load UIS skin from folder (fetch .uis + resolve image paths)
- [x] Parse UIS INI format into skin object
- [x] 9-slice frame rendering from skin frame images
- [x] Frame stretch vs. tile modes
- [x] Multi-frame images (extract first frame by dividing width/height)
- [x] Title bar text positioning (alignment, shift, right clip)
- [x] Title bar font from skin (family, size, weight)
- [x] Active/inactive title text colors from skin
- [x] Button positioning (left-aligned and right-aligned)
- [x] Button visibility by window state (bitmask)
- [x] Button action mapping (close, minimize, maximize, restore, toggle)
- [x] 3-state buttons (normal, hover, pressed)
- [x] 6-state buttons (3 states x active/inactive)
- [x] Skin color scheme applied as CSS custom properties
- [x] Canvas taint fallback for file:// (CSS-only frame rendering when canvas.toDataURL fails)
- [x] Switch skin at runtime (re-render all open windows via Control Panel)
- [ ] Load WBA archive via file picker (WASM unrar, extract UIS + images to blob URLs)
- [x] 21 bundled skins extracted from original WindowBlinds archives (LUNAX, AQUARIUM, APOLLO, APPLIED SCIENCE, BLUECURVE, CYRIX, DINKSDX_BLUE, G-POD, IRIXOS, LCARS, LCARS TERMINAL COMPANION, LINUX, MACOSXDP2, MACOSXSERVER, MDNATURE, MOREWINDOWS, NEWTECH, WIN10, WIN98, WINDOWSXL, XPNATURE)
- [x] Self-registering skin.js files (skins register on SZ.skins namespace, carry full UIS INI data)
- [x] Complete skin data for all 17 skins: full 29-color palettes, fonts, taskButton/progressBar/tabControl sections, fixed TGA→BMP references, sub-skin color variants (LCARS Red/Blue/Green, LUNAX Blue/Olive/Silver/Royale, BLUECURVE Blue/Green/Red, DINKSDX_BLUE Blue/Graphite/Green, XPNATURE Forest/Autumn/Ocean)
- [x] Skin registry with getSkin/getAvailableSkins API
- [x] Animated window frames (CSS @keyframes-driven, no setInterval)
- [x] 9-cell window frame grid (nw/n/ne/w/c/e/sw/s/se) with 5-column CSS grid and extension columns for wide corner zones
- [x] 3-zone border model (Zone A fixed start, Zone B tiled/stretched middle, Zone C fixed end)
- [x] Corner extension columns (nw-ext/ne-ext) allow corners wider than side borders (e.g. AQUARIUM: 52px corner vs 7px border)
- [x] Magenta transparency (usestran=1: RGB(255,0,255) replaced with transparent)
- [x] Mask BMP support (greyscale alpha masks for smooth edges)
- [x] Sub-skin / color scheme support (skins define color variants via `subSkins` array; user selects via Control Panel dropdown; choice persisted to localStorage; window frame BMP images recolored via CSS mix-blend-mode overlay)

### Theme Engine (Application Control Theming)

- [x] Generate CSS stylesheet from skin's color palette (29 Windows system colors as custom properties)
- [x] Style body with `COLOR_BTNFACE` background, `COLOR_WINDOWTEXT` text, skin font family/size
- [x] Style push buttons with 3D border effect (outset/inset) via `:where()` zero-specificity selectors
- [x] Style text inputs, textareas, selects with sunken border effect and `COLOR_WINDOW` background
- [x] Style checkboxes and radio buttons via `accent-color` matching `COLOR_HIGHLIGHT`
- [x] Style labels with skin font and `COLOR_BTNTEXT` color
- [x] Style fieldsets and legends with skin border colors
- [x] Style tables (th with `COLOR_BTNFACE`, td with borders) for data grid appearance
- [x] Style horizontal rules with 3D etched effect (shadow + highlight)
- [x] Style progress bars with `COLOR_HIGHLIGHT` value color
- [x] Style range/slider inputs with `accent-color`
- [x] Style scrollbars with skin colors (Webkit pseudo-elements + Firefox scrollbar-color)
- [x] Style focus ring (dotted outline), selection highlight, disabled state from skin colors
- [x] Style links with skin's hot-tracking color
- [x] Apply skin fonts to form controls
- [x] Inject theme `<style>` into each application iframe on load
- [x] Re-inject into all open iframes instantly on skin change
- [x] Fallback to pure color-based CSS when skin lacks control BMPs
- [ ] Canvas-based BMP slicing for control state extraction (load BMP, cut states, export as data URLs)
- [ ] Style push buttons via skin's BUTTONS.BMP (9-slice with states)
- [ ] Style checkboxes via skin's CHECK.BMP sprite (unchecked/checked x normal/hover/pressed)
- [ ] Style radio buttons via skin's RADIO.BMP sprite
- [ ] Style combo/select dropdowns via skin's COMBOBUTTON.BMP
- [ ] Apply cursor theme CSS to all elements
- [x] Theme the main document (taskbar, context menus, desktop UI) with same custom properties

### Application System

- [x] Application manifest (manifest.js) defines available apps (IIFE, sets SZ.manifest)
- [x] Desktop icons managed by FileSystem (only My Computer + Recycle Bin by default)
- [x] Start menu populated from FileSystem (all non-hidden apps)
- [x] Applications loaded as same-origin iframes in window content area (`type: "iframe"`)
- [x] Hosted app.js mode: IIFE exports `Application` class, rendered directly in window DOM (`type: "hosted"`)
- [x] Application-to-desktop postMessage API (setTitle, close, resize, launchApp, getWindows)
- [x] Desktop-to-application postMessage API (settings, windowList)
- [x] Singleton enforcement (optional per-app, prevents duplicate windows)
- [x] Per-app default window dimensions from manifest
- [x] Standalone mode bootstrap (auto-redirect to OS with ?app=id&maximized=1) — all apps include bootstrap
- [x] Auto-launch app from URL parameter (?app=appId&maximized=1)
- [x] Theme CSS injected into app iframes automatically
- [x] Windows DLL-like API (`SZ.Dlls.User32`, `Kernel32`, `GDI32`, `Shell32`, `ComDlg32`, `Advapi32`) — familiar Win32 naming for all OS operations
- [x] WindowProc dispatch (`RegisterWindowProc`) — apps receive `WM_THEMECHANGED`, `WM_SETTINGCHANGE`, etc.
- [x] Browser-native file import/export API (`ComDlg32.ImportFile()`/`ComDlg32.ExportFile()`) for binary formats
- [x] Centralized `SendMessage` with requestId + timeout — replaces per-app `vfsSend()` wrappers
- [x] Win32 constants exposed on window scope (`WM_CLOSE`, `MB_YESNO`, `IDOK`, `COLOR_WINDOW`, etc.)
- [x] `GetCommandLine()` for reading URL parameters on startup (file associations, deep linking)
- [x] File type associations in manifest (`fileTypes` array per app, specificity-based matching)
- [x] `sz:shellExecute` handler — opens files with correct app based on extension
- [x] MessageBox dialog (`showMessageBox`) with XP-style icon/button/caption rendering
- [x] System metrics query (`GetSystemMetrics`) for screen/work area dimensions
- [x] Registry-like settings API (`Advapi32.RegQueryValue/RegSetValue`) with WM_SETTINGCHANGE broadcast
- [x] MVC app structure — each app split into index.html (loader + template), styles.css, controller.js
- [ ] Desktop icons resolved via icon pack (iconName -> pack lookup -> fallback)

### Built-in Applications

System apps (hosted / app.js -- require OS runtime):
- [x] Explorer: FilePilot-inspired file manager with Office-style ribbon UI (QAT, Home/View tabs, File backstage), multi-pane layout (split right/bottom, resizable splitters, drag-and-drop arrangement with blue drop-zone previews), navigation tabs with independent state per pane, three view modes (Icons/Details/Tiles), sortable columns with resize and column filter icons, preview pane with prev/next navigation and zoom controls, sidebar with six collapsible sections (Recents, Bookmarks, Quick Access, Storage with usage bars, Places, Tree) and filter input, VFS operations (new folder/file, delete, rename, copy, move, cut/paste), breadcrumb path bar with autocomplete, enhanced search with scope toggle and detail-format results, command palette (Ctrl+Shift+P), GoTo dialog (Ctrl+P/F4), bulk rename with pattern tokens, expand folder mode (Ctrl+E), view filtering (files/folders/both + folders-first), display toggles (hidden files, extensions, highlight recents), options dialog (font/spacing/zoom/default view), type-ahead file selection, save/load layout persistence, directory change watching, folder size calculation, drag-and-drop between panes (move by default, Ctrl to copy) and from OS into VFS, upload/download files, mount/unmount local folders, context menu enhancements (Open with, Copy as Path, New Folder from Selection, Add to Bookmarks), rich status bar with load time and scroll percentage, persisted settings via registry. Also browses SZ runtime object tree (read-only mode)
- [x] Task Manager: Applications tab + Performance tab with real event-loop lag, NT-style canvas graphs
- [x] Control Panel: Display Properties dialog with Themes (preset theme combos), Appearance (skin switching, color swatch previews, auto-scroll to current, sub-skin dropdown), Desktop (background selection, position mode), Pointers (mouse shadow, mouse trail, trail length slider with live preview), and Taskbar (auto-hide, show clock, clear MRU) tabs
- [x] About: Tabbed dialog (General/System/Credits) with version info, data-privacy notice (local-storage-only warning with data-persistence explanation), system details (resolution, memory, browser, skin, storage usage), credits (author with GitHub link, Stardock, TidyTabs, AquaSnap, Winamp inspirations), license (free for personal/educational use, contact for commercial/corporate PID), donation appeal with clickable PayPal heart, OK/Escape/Enter to close, copy-to-clipboard, animated logo
- [x] Properties: Hosted app (first `type: "hosted"` app) — file/folder properties dialog launched from Explorer context menu via `Shell32.ShellExecute`. Shows General tab instantly (name, path, type, size, modified, location), defers metadata parsing to background promises by dynamically loading parser scripts on demand. For VFS files, parses metadata and adds category tabs (same parsers as Metadata Viewer). For VFS folders, computes item count and total size. Includes "Open in Metadata Viewer" button. Multiple instances supported (non-singleton). Accesses OS services via `SZ.os` (kernel for VFS reads, windowManager for close, appLauncher for launching Metadata Viewer). Theme-aware via CSS custom properties.
- [ ] Convert Explorer, Task Manager, About from iframe to hosted app.js format

User apps (iframe / index.html -- can run standalone):
- [x] Data Encryption: XOR cipher with hex encoding, key validation, swap/copy/clear buttons, error handling for malformed hex input, themed with skin colors
- [x] Calculator: Classic calc.exe look with Standard, Scientific (sin/cos/tan/log/exp/pow/factorial/constants), and Programmer (hex/dec/oct/bin, bitwise ops, bit-length selector) modes, memory functions, keyboard support, themed
- [x] Notepad: Notepad2-style text editor with Office-style ribbon UI (QAT, File backstage, Home/View tabs), syntax highlighting (JS, HTML, CSS, JSON, XML, Markdown, Python, SQL, C/C++, Java, Rust, Go, Ruby, PHP, Perl, YAML, TOML, INI, batch/shell), line numbers, current-line highlight, long line marker, bracket matching, auto-indent, zoom (Ctrl+scroll + ribbon/status bar slider), configurable tab width/spaces, word wrap toggle, whitespace/line-ending visualization, Find/Replace panel with regex/case/whole-word, Go To Line, multiple encoding support (UTF-8/ASCII/Latin-1), line ending detection (CRLF/LF/CR), Font dialog, VFS integration, undo/redo, dirty tracking, print support, status bar (Ln/Col/selection/encoding/EOL/INS mode/language/zoom slider)
- [x] Minesweeper: Classic game with beginner/intermediate/expert/custom difficulty, flood fill, chording, LED counters, timer, Marks (?) toggle, best times persisted to localStorage, proper dialogs for custom field and best times
- [x] Paint: Paint.NET-class bitmap editor with Office-style ribbon UI (QAT, File backstage, Home/Image/Adjustments/Effects/View tabs), full layer system (add/delete/reorder/duplicate/merge/flatten, per-layer opacity and 12 blend modes, visibility toggles, thumbnail panel), mask-based selection (rectangular, lasso, magic wand with tolerance, add/subtract/intersect modes, marching ants, copy/cut/paste/paste-as-layer), 16 drawing tools (pencil, line, rectangle, ellipse, rounded-rect, polygon, bezier, eraser, flood fill, gradient, text, eyedropper, clone stamp, blur brush, sharpen brush, airbrush), image adjustments with live preview dialogs (brightness/contrast, hue/saturation, levels, invert, grayscale, sepia, auto levels), 26 effects with live preview in 4 ribbon groups -- Basic (Gaussian blur, sharpen, noise, pixelate, edge detect, emboss), Blurs (motion blur, radial blur, surface blur, box blur, median filter, unsharp mask), Distort (swirl, spherize, ripple, polar coordinates, frosted glass), Stylize (oil painting, posterize, threshold, solarize, relief, pencil sketch, vignette, halftone, crystallize), 28-color palette with FG/BG swap, brush size 1-100px, fill mode/brush shape/gradient mode selectors, 30-step per-layer undo/redo, image operations (flip H/V, rotate CW/CCW/180, resize, canvas size, crop to selection), 43 resamplers (nearest, box, bilinear, hermite, cosine, bicubic, Mitchell-Netravali, Catmull-Rom, B-Spline 2/3/5/7/9/11, Gaussian, Spline16/36/64, Lanczos 2/3/4, Blackman/Hann/Hamming/Kaiser/Triangular/Welch/Nuttall/Blackman-Nuttall/Blackman-Harris/Flat-Top/Bartlett-Hann/Bohman/Power-of-Cosine/Tukey/Poisson/Hanning-Poisson/Cauchy windowed sinc, Schaum 2/3, o-Moms 3/5/7) and 27 pixel-art scalers, auto-correction (auto-deskew via projection profile, auto-rotate via edge histogram, auto-keystone via perspective warp with DLT solver), zoom (1x-8x via Ctrl+scroll/slider/ribbon, pixel grid toggle, pan tool), VFS integration via common file dialog (open/save/export PNG/JPG)
- [x] Terminal: Multi-shell terminal with shell selector dropdown. **cmd.exe** mode: full batch interpreter with IF/FOR/GOTO, variables, pipes, redirection, 40+ commands. **bash** mode: 50+ built-in commands (ls/grep/sed/awk/sort/cut/tr/wc/etc.), variable expansion ($VAR, ${VAR:-default}, ${#VAR}), command substitution ($(...) and backticks), pipes/redirects/logic chains, globbing, control flow (if/for/while/case), functions, aliases, tab completion, colored prompt, .sh script execution. Both shells share VFS integration, command history (up/down arrows), themed output
- [x] Tetris: Classic Tetris with SRS rotation, 7-bag randomizer, ghost piece, hold queue, next-3 preview, scoring with levels/combos/T-spins, persistent high scores, keyboard controls
- [x] Media Player: Audio/video player with playlist, visualization (bars/wave/circular), transport controls, volume/seek, shuffle/repeat modes, skin-themed chrome
- [x] Solitaire: Klondike solitaire with canvas-rendered cards (suit symbols, no external assets), 7 tableau columns, 4 foundations, stock/waste, drag-and-drop, auto-complete with bouncing animation, draw-1/draw-3 modes, undo, timer/move counter
- [x] Image Viewer: Image viewer/browser with zoom (Ctrl+scroll), rotate CW/CCW, fit-to-window, previous/next navigation through VFS directory, toolbar and status bar, opens images via common file dialog
- [x] WordPad: Rich text editor with Office-style ribbon UI (QAT, File backstage, Home/Insert/Page Layout/View tabs), contentEditable, formatting (bold/italic/underline/strikethrough, font family/size, alignment, lists, indent, text/highlight color), styles, page setup (size/orientation/margins), print/web/outline layout views, dynamic zoom (Page Width/Whole Page/Two Pages), VFS integration via common file dialog (saves as HTML), DOCX import (via mammoth.js) and export (via JSZip), RTF import/export (custom parser/generator), PDF export (via browser print dialog), dirty tracking
- [x] Web Browser: Iframe-based web browser with address bar, back/forward/refresh/home/stop navigation, bookmarks bar (persisted to localStorage), built-in home page with bookmarks grid, status bar with loading indicator
- [x] FreeCell: FreeCell solitaire with 4 free cells, 4 foundations, 8 tableau columns, canvas-rendered cards, drag-and-drop, auto-complete, undo, move counter
- [x] Spider Solitaire: Spider solitaire with 1-suit/2-suit/4-suit difficulty modes, 10 tableau columns, 5 stock deals, canvas-rendered cards, drag-and-drop, undo, scoring
- [x] Color Picker: Advanced color picker with multiple colorspaces (RGB, HSL, HSV, CMYK), hex/float/byte input modes, visual hue/saturation/lightness sliders, color preview, copy values, dual-mode eyedropper (1px native picker, circle-average sampling via screen capture with magnifier loupe)
- [x] Markdown Editor: Markdown editor with Office-style ribbon UI (QAT, File backstage, Home/Insert/View tabs), side-by-side live preview, syntax highlighting, VFS integration via common file dialog, formatting ribbon (headings, bold, italic, links, images, lists, code blocks, tables, blockquotes, horizontal rules), split/source/preview view modes, zoom (ribbon/status bar slider), Export as HTML, print support
- [x] Hex Editor: Binary file editor with hex and ASCII views, offset column, byte-level editing, VFS integration via common file dialog, go-to-offset, search
- [x] Spreadsheet: Excel-like spreadsheet with Office-style ribbon UI (QAT, File backstage, Home/Insert/Format/Formulas/Data/View tabs), unlimited rows/columns (dynamic expansion via virtual scrolling), formula support (SUM, AVG, MIN, MAX, COUNT, IF, and arithmetic), cell references (A1 notation, multi-letter column names), multi-cell selection, column/row resize, VFS integration via common file dialog, CSV import/export, XLSX import/export (via SheetJS, multi-sheet support), TSV import/export, zoom (status bar slider + editable input), print support
- [x] Font Viewer: Browse and preview all available fonts with customizable sample text, font size, and style (bold/italic/underline)
- [x] JSON Viewer: Tree-based JSON viewer with collapsible nodes, syntax highlighting, VFS integration via common file dialog
- [x] Regex Tester: Regular expression tester with flags (g/i/m/s/u), match highlighting, match list, replacement preview
- [x] Diff Viewer: Side-by-side text diff viewer with added/removed/changed line highlighting, merge controls
- [x] Date and Time: Clock with analog/digital display, calendar date picker, timezone selector
- [x] QR Code Generator: QR code generator with customizable size, error correction level, foreground/background colors, download as PNG
- [x] Icon Editor: Multi-image ICO/CUR editor with Office-style ribbon UI (QAT, File backstage, Home/Image/View tabs), pixel-level editing, 32-bit RGBA with per-pixel alpha, checkerboard transparency, 8 drawing tools (pencil, eraser, eyedropper, flood fill, line, rectangle, ellipse, selection), configurable brush size (1-8px for pencil/eraser), filled shapes (outline/filled/both modes for rectangle and ellipse), rectangular selection tool (select, move, cut/copy/paste regions, marching ants, crop to selection), clipboard operations (cut/copy/paste/paste as new image), FG/BG color swatches with mini palette in ribbon, image list sidebar (add/remove/duplicate entries), ICO format parser and writer (BMP + PNG entries), PE (EXE/DLL) multi-icon resource browser (browse/select/export-all icon groups from DLL/EXE), image import from PNG/BMP/SVG with multi-size generation, favicon export, image operations (flip, rotate 90°/180°, resize, shift/offset with wrapping, grayscale, invert, HSL adjust, color replace), Escape key support (cancel drawing/deselect/close dialogs), 30-step undo/redo with dimension restore, unsaved-changes guard on exit/open/import, VFS integration via common file dialog
- [x] Function Plotter: Mathematical function plotter with expression parser (42+ functions including trig, hyperbolic, logarithmic, rounding), syntax highlighting, autocomplete, function families (parameter t with range/list modes), Kurvendiskussion analysis (roots, extrema, inflection points, monotonicity, poles, limits), symbolic polynomial analysis, dark mode, PNG export at 2x resolution, menu bar, status bar with coordinates and zoom level (Office)
- [x] SVG Editor: Vector graphics editor with Office-style ribbon UI (QAT, File backstage with keyboard shortcuts and about, Home/View tabs), 8 drawing tools (select, rectangle, ellipse, circle, line, freehand path, text, pan), 30-step undo/redo, CSS-transform zoom with Ctrl+wheel, 8-handle element resize, copy/cut/paste/duplicate, grid overlay with snap-to-grid, arrow-key nudge (±1px, Shift ±10px), single-key tool shortcuts (V/R/E/C/L/P/T/H), layer management (visibility toggle, bring front/forward/backward/back), SVG source editing, collapsible sidebar panels, dark mode with localStorage persistence, PNG export, status bar with coordinates/tool/zoom/document size/element count, keyboard shortcuts dialog, VFS integration via common file dialog, command-line file opening (Graphics)
- [x] Subnet Calculator: IPv4 subnet calculator with real-time computation, interactive 32-bit binary view with clickable mask bits, quick CIDR prefix buttons (/8-/32), network properties (network/broadcast/wildcard/first-last host), IP class (A-E) and type detection (Private/Public/Loopback/Link-Local/Multicast/Reserved), subnet division table (2-256 subnets), hex/integer representations, copy all results (Ctrl+Shift+C), menu bar (Edit/Help), status bar with class/type/validation (Development)
- [x] Cron Visualizer: Crontab expression builder and inspector with per-field inputs (minute/hour/dom/month/dow/command), live preview, multi-line crontab editor with parsed entries table (schedule/command/human-readable meaning/next runs), quick reference panel, special aliases (@yearly, @daily, etc.), VFS integration via common file dialog, menu bar (File/Edit/Help), toolbar, status bar with entry count (Development)
- [x] Gradient Generator: CSS gradient builder with linear/radial/conic types, live preview, draggable color stop handles on a gradient track (click track to add, drag to reposition), per-stop color and position editor, Color Picker app integration for stop colors, type-specific controls (angle for linear, shape/size/position for radial, angle/position for conic), repeating gradient toggle, 8 built-in presets (sunset/ocean/rainbow/fire/forest/pastel/midnight/gold), syntax-highlighted CSS output with inline color swatches, CSS import via paste with robust parser (strips comments, finds gradients in arbitrary CSS, handles vendor prefixes, named/hex/rgb/hsl colors), copy to clipboard (Development)
- [x] Cookie Banner Generator: Visual cookie consent banner designer with live preview on simulated webpage, 5 banner positions (bottom/top bar, center modal, corner), 4 compliance presets (GDPR, CCPA, ePrivacy, Minimal), 8 design presets, text/color/style customization (border radius, font size, padding, shadows, backdrop, animations), cookie category editor with required flags, WCAG 2.1 contrast ratio checker, desktop/mobile viewport toggle, light/dark page toggle, custom CSS injection, syntax-highlighted code export (Combined/HTML/CSS/JS sub-tabs), clipboard copy and .html download, localStorage persistence, URL hash sharing, draggable splitter (Development)
- [x] Skin Tester: WindowBlinds skin inspector with drag-and-drop or file-open for WBA/ZIP/UIS skin archives, skin and sub-skin/style selector dropdowns, 9-slice frame grid visualization (NW/N/NE/W/content/E/SW/S/SE cells), active/inactive state toggle, animation playback toggle, themed form control preview (buttons, text inputs, select, checkboxes, radios, textarea, slider, progress, scrollbar), info panel with skin metadata (System Tools)
- [x] Display Tester: Comprehensive display quality testing utility with 51 tests across 8 categories (dead pixel detection, color accuracy, uniformity, FPS/refresh rate, motion/response time, HDR/dynamic range, geometry/sharpness, calibration tools), fullscreen mode (F11), WebGL2 HDR gradient and highlight clipping tests, animated FPS counter with min/avg/max graph, UFO per-FPS-lane test (24/25/30/50/60/75/100/120/144/165/240 fps lanes for refresh rate detection and motion interpolation), pursuit camera test, color banding with narrow-range gradients and dithering detection for 6-bit+FRC panels, uniformity sweep with adjustable brightness slider, viewing angle reference, burn-in/retention checker, input lag flasher (click-to-flash for slow-mo camera measurement), gray-to-gray 5x5 transition matrix, scrolling text readability test, subpixel layout identifier (RGB/BGR), moir\u00e9 pattern with adjustable spacing, 1px grid and checkerboard with adjustable sizing, text sharpness and aspect ratio tests, 12 interactive calibration tools (gamma calibration with adjustable slider, RGB balance with R/G/B gain sliders, Siemens star sharpness pattern with zone plate, contrast calibration with near-black/near-white patches, brightness calibration with 20 near-black patches, keystone grid for projector alignment, overscan detection with nested colored borders, color temperature reference with Kelvin selector, convergence test with RGB crosshair grid, backlight bleed test, screen ruler with credit card reference and DPI calibration, pixel clock/phase adjustment patterns), keyboard navigation (arrow keys cycle tests, Space pauses animations, 1-8 jump to category), ResizeObserver canvas scaling with devicePixelRatio, status bar with resolution/DPR/FPS (System Tools)
- [x] README Generator: Template-based README.md builder with 5 presets (Standard Project, Minimal, Library/Package, CLI Tool, GitHub Profile), wizard and form editing modes, live markdown preview with resizable splitter, template editor (duplicate/customize/save to localStorage), quality score with warnings, markdown parser for importing existing READMEs, 11 field types (text, textarea, codeblock, list, checklist, table, tags, license, author, badges, images), badge builder with logo text input and autocomplete icon grid (full Simple Icons catalog fetched at runtime, 110-icon offline fallback), SZ Color Picker integration for precise color selection, dual-color support (label color + message color), per-badge placeholder overrides (user/repo/package) for support/sponsorship badges, VFS and browser file import/export, undo/redo, keyboard shortcuts, drag-and-drop .md import (Development)
- [x] Resume Builder: Resume builder with 6 templates (Professional, Technical, Academic CV, Creative, Minimal, Entry-Level), 5 preview layouts (single-column, sidebar-left, dense-serif, accent-bar, clean-tight), wizard and form editing modes, 8 resume-specific field types (personal-info, experience-list, education-list, skills-grouped, certifications-list, projects-list, languages-list, references-list), 4 export formats (Markdown, Plain Text, PDF via print, DOCX Flat OPC XML), Markdown resume import parser, template editor with upload/download JSON and VFS load/save, completeness score with warnings, VFS file operations, undo/redo, keyboard shortcuts, drag-and-drop import (Office)
- [x] Archiver: WinRAR/7-Zip-style archive manager with IArchiveFormat plugin architecture supporting 69 formats -- **Archive formats (26 writable)**: ZIP (Store/Deflate, ZipCrypto + AES-256), JAR/WAR/EAR, APK, EPUB, OOXML (DOCX/XLSX/PPTX), ODF (ODT/ODS/ODP), ZIPX, TAR, TAR.GZ/TGZ, TAR.BZ2/TBZ2, TAR.XZ/TXZ, TAR.ZST, TAR.LZMA/TLZ, TAR.LZ, 7z (LZMA/LZMA2/Deflate/BZip2/PPMd/AES-256 with full extraction and filename encryption), LZH/LHA (level 0/1/2 headers, -lh4- through -lh7- Huffman+LZSS compression and decompression), ARJ (methods 1-4 Huffman+LZ compression and Deflate decompression), CAB (Store/MS-ZIP creation and Store/MSZIP/LZX decompression), CPIO (newc/odc), AR (.a/.lib), Base64, UUEncode, Intel HEX; **Compression (6 writable)**: GZIP, BZIP2, XZ, ZStandard, LZMA, LZIP; **Read-only archives (13)**: RAR (CDN unrar.js + native RAR5 store extraction with timestamps), SQX (store + Huffman/LZSS/BZip2 best-effort), ACE (store + Deflate/LZ77/LZSS best-effort), ARC (SEA; methods 1-9: store/RLE/Squeezed Huffman/LZW), ZOO (methods 0-2: store/LZW/LZH), HA (methods 0-2: store/ASC arithmetic/HSC), StuffIt/StuffItX, PAK (Quake), ALZ, PEA, SHAR; **Read-only system/package (11)**: ISO 9660 (Joliet), WIM/ESD, XAR/PKG, MSI/OLE Compound, CHM, RPM, DEB, Unix Compress (.Z/LZW), NSIS, Parchive (.par/.par2), MAR (Mozilla); **Filesystem images (8)**: FAT12/16/32 (full directory listing + extraction), NTFS, EXT2/3/4, HFS+/HFSX, APFS, SquashFS, CramFS, UDF; **VM disk images (5)**: QCOW2, VHD, VHDX, VDI, VMDK; **Partition tables (2)**: GPT, MBR; **Disk images (1)**: DMG (Apple); shared decompression infrastructure (BitReader, Huffman table builder, LZW decoder); dynamic per-format options panel (compression method/level, dictionary size, solid mode, encryption type, volume splitting, recovery records), format conversion, CDN graceful degradation, magic-byte detection, drag-and-drop, keyboard shortcuts (System Tools)
- [x] Metadata Viewer: File analysis and metadata editor with magic-byte file identification (30+ formats), format-specific metadata parsing (JPEG EXIF/JFIF/GPS, PNG chunks, MP3 ID3v1/v2 with album art, FLAC, WAV, OGG, MP4/M4A ISO BMFF, MKV/WebM EBML, PDF, ZIP, PE/ELF/Mach-O executables, Java .class, fonts, C64 D64/D71/D81/T64 disk images, Amiga ADF disk images), archive bridge for deep inspection of 40+ archive formats via archiver's IArchiveFormat plugin system (TAR, RAR, 7z, CAB, LZH, ARJ, CPIO, ISO, FAT contents with file tree, sizes, dates, compression ratios), shared format library framework (`libs/formats/` with `SZ.Formats` registry), shared ICO codec with full BMP entry decode and per-entry image previews, audio codec analysis (MP3 Xing/LAME/VBRI headers, CBR/VBR detection, frame scanning; WAV PCM statistics with RMS/peak/DC offset/clipping/silence), video codec analysis (H.264/H.265 SPS parsing from MP4 avcC/hvcC for codec-level resolution/profile/level, stream identification), 8-algorithm hash/checksum computation via Cipher project (MD5, SHA-1, SHA-256, SHA-512, SHA3-256, BLAKE3, CRC-32, Adler-32) with async chunked processing, inline metadata editing for MP3 ID3 tags and PNG text chunks with file reconstruction, embedded image extraction (EXIF thumbnails, album art, FLAC cover, ICO entries), hex preview, Shannon entropy and encoding detection, loading progress indicator during file parsing, PE embedded strings extraction (Latin-1 scoped UTF-16LE) with searchable/filterable strings tab, drag-and-drop, VFS integration, click-to-copy hashes, keyboard shortcuts, reusable parsers module shared with Properties hosted app (Development)

See [docs/appideas.md](docs/appideas.md) for the full application roadmap.

### Shell FileSystem

- [x] FileSystem abstraction for shell folders (Desktop, StartMenu, Programs categories)
- [x] ShellItem / ShellFolder / FileSystem classes (`js/filesystem.js`)
- [x] Dual-layer items: system (code-defined) + local (localStorage-persisted)
- [x] Desktop shows only curated icons (My Computer, Recycle Bin) not all apps
- [x] Start menu shows MRU apps + All Programs with categories via FileSystem
- [x] Programs categories: Accessories, Development, Entertainment, Games, Graphics, Internet, Office, System Tools
- [x] FileSystem exposed on `SZ.system.fileSystem` for hosted apps

### Virtual File System

- [x] VFS core with mount/unmount, path normalization, longest-prefix matching
- [x] LocalStorageMount: persistent user file storage with `sz-vfs:` key prefix
- [x] MemoryMount: volatile session-scoped temporary storage
- [x] ReadOnlyObjectMount: expose JS object trees as read-only filesystem
- [x] Default mounts: /user/ (localStorage), /tmp/ (memory), /system/ (read-only), /apps/ (read-only)
- [x] Default user files created on first boot (Welcome.txt, desktop/.keep)
- [x] postMessage bridge for apps (typed VFS API: sz:vfs:Stat, sz:vfs:List, sz:vfs:Mkdir, sz:vfs:Delete, sz:vfs:Move, sz:vfs:Copy, sz:vfs:ReadAllText, sz:vfs:ReadAllBytes, sz:vfs:ReadUri, sz:vfs:ReadValue, sz:vfs:WriteAllBytes, sz:vfs:WriteValue, sz:vfs:WriteUri)
- [x] OS service bridge (sz:messageBox, sz:getSystemMetrics, sz:regRead, sz:regWrite)
- [x] VFS exposed on SZ.system for hosted apps
- [x] VFS browsable in Explorer via SZ:\vfs\ path (navigate to vfs/user/documents to find saved files)
- [x] FileSystemAccessDriver: mount real local directories into VFS at /mount/<name> via File System Access API (showDirectoryPicker)
- [x] MountStore: IndexedDB persistence for directory handles — mounts survive page reloads (auto-restored when permission is granted)
- [x] Explorer Mount/Unmount toolbar buttons and context menu entries for mounting/unmounting local directories
- [x] Mounted directories appear as drive icons in Explorer sidebar tree
- [x] postMessage bridge: sz:vfs:MountLocal, sz:vfs:Unmount, sz:vfs:ListMounts
- [x] DLL API: Kernel32.MountLocalDirectory(), Kernel32.UnmountDirectory(), Kernel32.ListMounts()

### Icon Packs

- [ ] Icon pack manifest format (name, size, logical-name -> file mapping)
- [ ] Desktop icons resolve logical names from active icon pack
- [ ] Switch icon pack at runtime (re-render all desktop icons)
- [ ] Bundled default icon pack

### Cursor Themes

- [ ] Cursor theme manifest format (name, cursor-type -> file mapping)
- [ ] CSS cursor custom properties applied globally and into iframes
- [ ] Switch cursor theme at runtime
- [ ] Bundled default cursor set

### Cursor Effects

- [x] Mouse shadow effect (semi-transparent cursor silhouette with offset, toggled via settings)
- [x] Mouse trail effect (fading cursor images behind pointer, configurable length 3-10)
- [x] Custom cursor image support for shadow/trail rendering (PNG, CUR, or built-in SVG)
- [x] Pointer-events-transparent overlay container at z-index 99999
- [x] Control Panel Pointers tab with enable/disable checkboxes and trail length slider
- [x] Live preview area in Control Panel to test effects before applying
- [x] Settings persisted to localStorage (cursor.shadow, cursor.trail, cursor.trailLen)
- [x] postMessage API for cursor settings (sz:cursorSetting with key/value)

### Settings and Persistence

- [x] Background preference saved to localStorage (image path + display mode: cover/contain/fill/none/tile)
- [x] Active skin preference saved to localStorage
- [ ] Active icon pack preference saved to localStorage
- [ ] Active cursor theme preference saved to localStorage
- [ ] Behavior settings saved to localStorage (animations, snapping, taskbar)
- [ ] Per-application last-used window size/position remembered
- [ ] Icon layout saved if user rearranges

---

## Build / Test / Run

### Run

```
# No build step. Serve the sz/ directory or open index.html directly.
# A local server is recommended to avoid CORS issues with fetch/iframe:
npx serve .
# Then open http://localhost:3000
```

### Test

Tests use a minimal browser-based test runner (no Node dependency). Open `tests/index.html` in a browser or run headless:

```
npx playwright test
```

Test categories:

- **Unit**: UIS parser, skin object construction, window state machine, manifest parsing
- **Integration**: Skin loader + renderer, app launcher + window manager
- **Visual regression**: Screenshot comparison of rendered windows with known skins

### Lint

```
npx eslint js/
```

ESLint configured for ES2022 modules, browser globals.

---

## Planned Features

### Planned Applications

41 applications are currently implemented (5 system + 36 user apps). See [docs/appideas.md](docs/appideas.md) for the full application idea list with hosting format (iframe vs hosted) and status tracking.

### Virtual File System (VFS) — Implemented

A central filesystem with a Linux-like mounting mechanism (`js/vfs.js`). Storage is composed from multiple sources, each mounted at a path. The VFS stores typed nodes: `dir` (directories), `bytes` (binary blobs), `value` (JSON-serializable data), and `uri` (URI references). Apps access the VFS via `postMessage` using the typed API (see `docs/vfs.md`): `sz:vfs:Stat`, `sz:vfs:List`, `sz:vfs:Mkdir`, `sz:vfs:Delete`, `sz:vfs:Move`, `sz:vfs:Copy`, `sz:vfs:ReadAllText`, `sz:vfs:ReadAllBytes`, `sz:vfs:ReadUri`, `sz:vfs:ReadValue`, `sz:vfs:WriteAllBytes`, `sz:vfs:WriteValue`, `sz:vfs:WriteUri`. The bootstrap's `SZ.Dlls.Kernel32` wraps these into familiar Win32-like methods. The `/user/documents/` mount serves as **"Eigene Dateien" (My Documents)** — user personal files backed by `localStorage`.

Currently mounted:

| Mount Point        | Source                         | Description                                             |
| ------------------ | ------------------------------ | ------------------------------------------------------- |
| `/system/`         | Static OS files (bundled)      | Core OS resources, skin defaults, bundled apps          |
| `/apps/`           | Application manifest + folders | Installed applications                                  |
| `/skins/`          | Skin folders + WBA archives    | Available skins                                         |
| `/user/`           | localStorage                   | User preferences, desktop layout, saved data            |
| `/user/documents/` | localStorage or cloud          | User documents and files                                |
| `/proc/`           | Runtime state                  | Running processes (open windows), system info           |
| `/registry/`       | Settings store                 | System settings, per-app config (like Windows registry) |
| `/tmp/`            | Session memory                 | Temporary files, cleared on "reboot"                    |
| `/cloud/`          | Cloud storage API (future)     | Mounted cloud storage (Google Drive, Dropbox, etc.)     |

Each mount provides a common interface:

```js
class FileSystemMount {
  async list(path)          // -> [{name, type:'file'|'dir', size, modified}]
  async read(path)          // -> Blob | string
  async write(path, data)   // write or create
  async delete(path)        // remove
  async exists(path)        // -> boolean
  get readonly()            // true for /system/, /proc/
}
```

The VFS enables:

- A **file manager** app that browses the unified tree
- **Scoped app storage**: each app gets `/user/apps/{appId}/` automatically
- **Cloud mounting**: plug in cloud providers at `/cloud/{provider}/`
- **Process listing**: `/proc/windows/` lists open windows, `/proc/skin/` shows active skin

### Recently Completed

- Windows DLL-like API system (`SZ.Dlls.*`) — `User32`, `Kernel32`, `GDI32`, `Shell32`, `ComDlg32`, `Advapi32` namespaces
- WindowProc dispatch — apps register handlers for `WM_THEMECHANGED`, `WM_SETTINGCHANGE` broadcasts
- MessageBox dialog (XP-style modal with icons, skinned buttons, MB_OK/MB_YESNO/MB_OKCANCEL)
- File type associations — manifest-defined `fileTypes[]` per app, specificity-based matching via `sz:shellExecute`
- `GetCommandLine()` — apps read URL params on startup to auto-open files from Explorer
- Registry-like settings API (`Advapi32.RegQueryValue/RegSetValue`) with `WM_SETTINGCHANGE` broadcast
- MVC app refactoring — all apps split into index.html (loader), styles.css, controller.js
- System metrics query — screen dimensions, work area, taskbar height, caption height
- Common file dialogs (Open/Save As) with VFS navigation, upload from PC, download to PC
- Start menu MRU (most recently used) + All Programs with categories and flyout submenus
- Sub-skin / color scheme support in Control Panel (LUNAX ships with Blue/Olive Green/Silver/Royale variants via WBA data)
- Small icons mode in start menu
- Desktop icon dragging (free-form placement, positions saved to localStorage)
- Taskbar auto-hide with proper background rendering
- Theme engine styles buttons/inputs in app iframes with skin colors
- Explorer: FilePilot-inspired multi-pane file manager with ribbon UI, multi-pane split layout, navigation tabs, three view modes, preview pane, command palette, bulk rename, expand folder mode, directory watching
- VFS operations: rename, copy, move
- Transparency mask support (alpha channel from mask BMPs)
- FreeCell, Spider Solitaire, Color Picker, Markdown Editor, Hex Editor, Spreadsheet apps
- Icon Editor: multi-image ICO/CUR editor with Office-style ribbon UI, pixel-level alpha, ICO parse/write, PE multi-icon resource browser, selection tool (select/move/crop), clipboard (cut/copy/paste/paste-as-new), filled shapes, configurable brush size, rotate 180°, shift/offset, Escape key (cancel/deselect/close), undo/redo dimension restore, unsaved-changes guard on exit/open/import, image import, favicon export
- WordPad: DOCX import (mammoth.js), DOCX export (JSZip OOXML), RTF import/export (custom parser/generator), PDF export (browser print dialog)
- Spreadsheet: XLSX import/export (SheetJS, multi-sheet), TSV import/export
- ComDlg32: browser-native ImportFile/ExportFile API for binary formats (File API + Blob download)
- Vendored offline-capable libraries (mammoth.js, JSZip, SheetJS) in Applications/libs/
- Taskbar window integration — taskbar buttons appear/disappear/highlight as windows are created/closed/focused, title changes propagate to taskbar buttons, singleton tracking on close
- Control Panel appearance tab — full skin/sub-skin selection, animation toggle, cursor effects, MRU clearing, taskbar settings
- File loading from Explorer — icon-editor, diff-viewer, paint, and font-viewer properly handle `GetCommandLine()` to load files on launch
- Task manager postMessage bridge — `sz:getWindows` and `sz:closeWindow` handlers for cross-origin (file://) compatibility
- Desktop icon launch scoping fix — MRU recording and taskbar refresh work correctly from desktop icon double-click
- Title bar icon context menu — click icon for system menu (Restore, Move, Size, Minimize, Maximize, Roll Up/Down, Always on Top, Transparency, Close), double-click to close
- Roll up/down (window shade) — collapse window to title bar only, restore with Roll Down
- Always on top — pin windows above others with z-index partitioning (normal: 100+, on-top: 10000+)
- Per-window transparency — set opacity from 25% to 100% via icon menu
- AquaSnap-style edge snapping — 8-zone snap (edges + corners) with translucent blue preview overlay, modes: AeroSnap/AquaSnap/Disabled
- Magnetic alignment — windows snap to nearby edges of other windows and screen edges, configurable distance threshold, optional speed-based disable
- AquaStretch — double-click resize handles to stretch to nearest obstacle or screen edge
- Move-together (AquaGlue) — Ctrl+drag moves adjacent windows, Ctrl+resize adjusts neighbors inversely
- TidyTabs-style window tabbing — drag window onto another's title bar to create tab group, auto-hiding tab bar with icons, click to switch, drag to detach
- Drag-away-from-maximized — drag a maximized window's title bar to restore and begin drag (proportional cursor position)
- Control Panel "Window Mgmt" tab — sub-tabbed UI (Snapping, Magnet, Stretching, Glue, Tabs) with snap mode, magnet settings (screen/outer/inner edges, corners, distance, speed), stretch mode/target, glue settings, tab settings, all persisted to localStorage and applied live
- Per-app versioning — `update-versions.sh` generates `Applications/versions.js` from git history (commit count per app folder → `1.x` version, git hash, OS version, full changelog text). Every iframe app receives `_szVersion`, `_szGitHash`, `_szOsVersion` as URL params on launch, readable via `SZ.Dlls.Kernel32.GetCommandLine()`.
- About app auto-start on version change — compares `SZ.appVersions.apps['about']` against `localStorage` last-seen version; if different, auto-launches the About app focused on the "What's New" tab showing a color-coded changelog (added/fixed/changed/removed/issue). Version saved on close to suppress re-launch until next change.

### Shared Format Library (`libs/formats/`)

Three-layer architecture for reusable file format parsing:

- **Layer 1** (Utilities): Binary I/O, CRC, string decoding — `format-core.js`
- **Layer 1.5** (Shared Utilities): `format-utils.js` (BitstreamReader, NAL helpers), `wasm-loader.js` (lazy ffmpeg.wasm + wasm-imagemagick init)
- **Layer 2** (Format Libraries): Pure parsing, no UI coupling — individual codec/graphics files (one per format), `disk-commodore.js`, `disk-amiga.js`, future `executable-pe.js`, etc.
- **Layer 3** (App Adapters): Thin wrappers converting Layer 2 output to app-specific UI models (categories/fields for metadata-viewer, ArchiveEntry[] for archiver, etc.)

Completed:
- Archive bridge: metadata-viewer consumes archiver's 40+ format handlers for deep archive inspection (TAR, RAR, 7z, CAB, LZH, ARJ, CPIO, ISO, FAT contents)
- ICO codec deduplication: `js/icon-codec.js` migrated to `libs/formats/graphics-ico.js`, shared between icon-editor and metadata-viewer with full BMP entry decode and image previews
- Audio codecs split into individual files: `codec-mp3.js` (frame scanner, Xing/LAME/VBRI), `codec-aac.js` (ADTS), `codec-flac.js` (frame headers), `codec-pcm.js` (WAV/PCM analysis), `codec-ogg.js` (Ogg pages), `codec-opus.js` (OpusHead), `codec-midi.js` (MThd/MTrk), `codec-aiff.js` (AIFF chunks)
- Video codecs split into individual files: `codec-h264.js` (NAL/SPS), `codec-h265.js` (NAL/SPS), `codec-vp8.js` (frame header), `codec-vp9.js` (frame header), `codec-av1.js` (OBU/sequence header), `codec-video-identify.js` (identification heuristic)
- Graphics codecs: `graphics-bmp.js` (full BMP r/w), `graphics-png.js`, `graphics-jpeg.js`, `graphics-gif.js`, `graphics-webp.js`, `graphics-avif.js`, `graphics-svg.js`, `graphics-tga.js` (r/w), `graphics-tiff.js`, `graphics-ppm.js` (P1-P6 r/w), `graphics-pcx.js`, `graphics-dds.js` (DXT1/DXT5)
- WASM integration infrastructure: `wasm-loader.js` for lazy-loading ffmpeg.wasm and wasm-imagemagick, graceful fallback on file://
- MP4 stream analysis: extract avcC/hvcC codec configuration from stsd sample entries, parse SPS for actual codec-level resolution/profile/level
- WAV PCM analysis: RMS level, peak with dB, DC offset, clipping detection, leading/trailing silence detection
- MP3 codec details: Xing/LAME/VBRI headers, encoder info, VBR quality, frame count, delay/padding

Planned format library modules:
- Ship ffmpeg.wasm and wasm-imagemagick WASM binaries in `libs/wasm/` for full encode/decode support
- Gradual extraction of existing app-specific parsers into shared libraries (PE, ELF, font)

### Future

- Drag-and-drop skin installation (drop .wba onto desktop)
- Common Font and Color picker dialogs (user32-style, for use across apps)
- Window minimize-to-taskbar animation with thumbnail preview
- Multi-monitor awareness (detect viewport size changes)
- Sound events (open, close, minimize) with skin-provided WAV files
- Touch and mobile gesture support
- Per-pixel alpha blending for advanced skins (CYRIX-style `perpixel=1`)
- Animated button states (multi-frame button hover/press animations)
- Font shadow/outline rendering for skins that define drawing styles
- Screensaver system (activate after idle timeout)
- Notification area popups (system tray balloon tips)
- Cloud storage mounting (Google Drive, Dropbox, WebDAV)
- Drag-and-drop file operations between VFS locations
- Clipboard system (copy/paste between apps via VFS + postMessage)

---

## Known Limitations

- **Canvas taint on file:// protocol**: When loaded from `file://` in Chrome, `canvas.toDataURL()` throws SecurityError after drawing local images (canvas is "tainted"). The skin renderer falls back to CSS-only frame rendering using `background-size`/`background-position` to show individual frames from multi-frame BMP sprites. This works but prevents per-pixel manipulation (e.g., alpha compositing of mask images).
- **WBA loading requires WASM unrar**: The `.wba` format is RAR-compressed. Browser-native decompression is not available; a WASM library is needed. Users can alternatively extract `.wba` files manually (they are standard RAR archives) and load the extracted folder.
- **BMP transparency**: Mask BMPs and magenta transparency are supported via Canvas compositing at skin load time. On `file://` protocol in Chrome, canvas is tainted and transparency processing is skipped — frames render without alpha.
- **Same-origin requirement for theming**: The theme engine injects CSS into application iframes via `contentDocument` access, which requires same-origin. All applications must be served from the same origin as the desktop. Cross-origin iframes cannot be themed and will display with default browser styling.
- **CSS cursor format**: `.cur` and `.ani` files work in most browsers. PNG cursors with hotspot offsets require the `x y` syntax in CSS `url()`, which has inconsistent browser support. Prefer `.cur` format for maximum compatibility.
- **Control BMP state layouts vary**: Different skins use different grid layouts for checkbox/radio/button sprites (some 3-wide, some 6-wide, some with rows for focused/disabled states). The theme engine must probe image dimensions and divide by expected state count, which may not be correct for all skins. Pure color fallback is always available.
- **Single background bundled**: Only one background image is bundled. Additional backgrounds can be uploaded via the Control Panel's Desktop tab (stored as data URLs) or added to `assets/backgrounds/`.
- **Font rendering**: Skin-specified fonts (e.g., Trebuchet MS) depend on the user's system having them installed. Fallbacks are applied but may not match the original skin appearance.
- **postMessage has no enforced schema**: Applications and the desktop communicate via `postMessage` with a convention-based type field. Malformed messages are silently ignored. The control panel depends on this protocol for all settings changes.
- **Approximate performance metrics**: The Task Manager measures real event-loop lag (via `setTimeout` drift with 100ms intervals) for CPU load estimation, but this is an approximation since browsers don't expose actual CPU metrics. Memory uses `performance.memory` where available (Chrome only), otherwise estimated from DOM node counts.
