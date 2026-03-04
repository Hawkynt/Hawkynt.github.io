# Skin Tester

A WYSIWYG diagnostic tool for inspecting, previewing, and validating WindowBlinds UIS skins within the »SynthelicZ« desktop. It uses the same rendering pipeline (`skin-css-generator.js`) as the real desktop shell, so what you see in the tester is exactly what renders on screen. Parses skin archives and files, renders the 9-slice window frame grid with active/inactive states, applies sub-skin color tinting, and provides a pixel-level magnifying glass for verifying rendering accuracy.

## Product Requirements

### Purpose
The Skin Tester provides a dedicated workspace for inspecting and validating WindowBlinds UIS skin files used by the »SynthelicZ« desktop shell. It uses the real system rendering pipeline (`SZ.generateSkinCSS`) for WYSIWYG fidelity -- any rendering bug visible in the tester is the same bug users see on the desktop, and vice versa. Skin authors and power users can visualize the 9-slice frame grid, toggle active/inactive states, switch sub-skin color schemes, inspect pixels at up to 16x magnification, compare parsed UIS metadata against runtime values, and identify common skin issues such as mismatched zone sizes or incorrect frame counts.

### Key Capabilities
- WYSIWYG rendering via the real `skin-css-generator.js` pipeline (not a separate implementation)
- Loading skins from multiple archive formats (WBA, ZIP, RAR) and loose UIS files via file dialog, drag-and-drop, or folder drop
- Rendering the full 9-slice window frame grid with active/inactive state toggling and animation playback
- Sub-skin style switching with `mix-blend-mode: color` tint overlays on frame cells (title gradient, border colors)
- Pixel-level magnifying glass (4x/8x/12x/16x) for verifying rendering accuracy
- Displaying detailed per-border metadata including image dimensions, frame counts, zone sizes, and stretch/tile modes
- Sanity validation with warnings for dimension mismatches and divisibility errors
- Side-by-side comparison of UIS-parsed values versus registered skin.js runtime values
- Copy-to-clipboard for info panel content
- Sample form control rendering inside the content area for theme verification
- Cross-origin skin data access via postMessage bridge when direct parent access is blocked

### Design Reference
Modeled after the diagnostic and inspection panels found in WindowBlinds SkinStudio, providing a developer-oriented view of skin internals rather than a consumer-facing skin selector.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine
- Loads `skin-css-generator.js` directly for WYSIWYG rendering; all image paths resolved to absolute URLs via `_resolveSkinPaths` before passing to the generator

## User Stories

### Core Functionality
- [x] As a user, I can select a skin from a dropdown list populated from the parent SZ desktop's registered skins
- [x] As a user, I can open WBA, ZIP, RAR, or UIS skin files via a file dialog
- [x] As a user, I can drag and drop WBA/ZIP/RAR archives onto the main area to load skins
- [x] As a user, I can drag and drop a folder containing a UIS or skin.js file with BMP assets
- [x] As a user, I can drag and drop a loose UIS file along with its BMP files
- [x] As a user, I can see the 9-slice frame grid (NW, N, NE, W, content, E, SW, S, SE) rendered using the real system renderer (`skin-css-generator.js`) for WYSIWYG fidelity
- [x] As a user, I can toggle between Active and Inactive window states to see both frame variants
- [x] As a user, I can toggle animation playback on/off for skins with animated frames
- [x] As a user, I can select sub-skin styles and see the frame images recolored via `mix-blend-mode: color` tint overlays (title gradient on NW/N/NE, border colors on W/E/SW/S/SE)
- [x] As a user, I can see zone dimension labels on each grid cell (e.g., "NW 32x30")
- [x] As a user, I can see whether each border zone uses stretch or tile rendering mode

### WYSIWYG Rendering
- [x] As a user, I can verify that the skin tester shows the same rendering as the real desktop because it uses `SZ.generateSkinCSS()` from `skin-css-generator.js`
- [x] As a user, I can see rendering bugs in the tester that match real desktop rendering bugs, so I can report and fix them
- [x] As a user, I can see the frame grid sized by the same CSS custom properties (`--sz-frame-*`) that the real window uses
- [x] As a user, I can see sub-skin color tinting applied identically to the real desktop via `::after` pseudo-elements with `mix-blend-mode: color`

### Magnifying Glass
- [x] As a user, I can toggle a magnifying glass tool from the toolbar to inspect pixel-level rendering
- [x] As a user, I can select magnification level (4x, 8x, 12x, or 16x) from a zoom dropdown
- [x] As a user, I can see a circular magnifier that follows my cursor over the frame grid
- [x] As a user, I can see crosshairs in the magnifier indicating the exact pixel under inspection
- [x] As a user, I can see coordinate readout (x, y) in the magnifier overlay
- [x] As a user, I can see pixelated (nearest-neighbor) scaling in the magnifier so individual pixels are sharp
- [x] As a user, I can see the magnifier update when switching skins, sub-skins, or active/inactive states

### Skin Parsing
- [x] As a user, I can load skins from ZIP archives using the browser's DecompressionStream API
- [x] As a user, I can load skins from RAR archives via a dynamically loaded unrar library
- [x] As a user, I can load skins from RAR archives with stored (uncompressed) entries even offline
- [x] As a user, I can have UIS files parsed with correct section handling (TitleBarSkin, Personality, Buttons, Colours, Fonts)
- [x] As a user, I can have skin.js files evaluated and loaded with blob URL resolution for BMP images
- [x] As a user, I can have magenta transparency applied to skin images when usestran is enabled
- [x] As a user, I can have mask images applied to frame borders for alpha channel support

### Information Panel
- [x] As a user, I can see skin metadata (name, author, UIS source) in the info panel
- [x] As a user, I can see which renderer is in use (skin-css-generator.js WYSIWYG or unavailable)
- [x] As a user, I can see personality key settings (usestran, anirate, tripleimages) displayed
- [x] As a user, I can see per-border details: image dimensions, frame count, frame size, zone sizes, stretch/tile mode
- [x] As a user, I can see canvas taint status per border (OK or tainted with error details)
- [x] As a user, I can see sanity warnings when zone sizes do not sum to the frame dimension
- [x] As a user, I can see warnings when image dimensions are not evenly divisible by frame count
- [x] As a user, I can see the CSS grid sizing parameters used for the frame layout
- [x] As a user, I can see a comparison between UIS-parsed values and skin.js values when a matching registered skin exists
- [x] As a user, I can see all personality keys listed for reference
- [x] As a user, I can see sub-skin names listed when present
- [x] As a user, I can see the active sub-skin ID displayed when a non-default style is selected
- [x] As a user, I can copy the info panel content to the clipboard via a copy button

### Preview Content Area
- [x] As a user, I can see sample form controls (buttons, text inputs, checkboxes, radio buttons, select boxes, textarea, range slider, progress bar) inside the content area
- [x] As a user, I can see a scrollbar test area to verify scrollbar theming
- [x] As a user, I can see disabled states of form controls
- [x] As a user, I can see form control colors update when switching sub-skin styles

### File Format Support
- [x] As a user, I can detect archive format automatically from magic bytes (ZIP vs RAR)
- [x] As a user, I can see a hex dump of magic bytes when the format is unrecognized
- [x] As a user, I can see an informative error message when RAR decompression fails with a workaround suggestion

### Cross-Origin Access
- [x] As a user, I can browse parent desktop skins even when direct `window.parent.SZ.skins` access is blocked by the browser
- [x] As a user, I can load skin data via the postMessage bridge (`sz:getSkinList` / `sz:getSkinData`) as a fallback
- [x] As a user, I can have image paths resolved to absolute URLs so they load correctly from the iframe context

### User Interface
- [x] As a user, I can see a drop hint message in the toolbar area
- [x] As a user, I can see a visual drop overlay when dragging files over the main area
- [x] As a user, I can have the current desktop skin auto-selected on startup when running inside SZ
- [x] As a user, I can press F1 to open the About dialog with product information
- [x] As a user, I can select text in the info panel for manual copying

### Aspirational Features
- [ ] As a user, I want to see title bar button previews (close, minimize, maximize) with hover/pressed states
- [ ] As a user, I want to see the start button image with its multi-frame states
- [ ] As a user, I want to see the system colors from the skin's Colours section displayed as color swatches
- [ ] As a user, I want to see font information from the skin displayed
- [ ] As a user, I want to export a skin's parsed configuration as JSON for debugging
- [ ] As a user, I want to compare two skins side by side
- [ ] As a user, I want to resize the content area to test how the 9-slice frame adapts to different window sizes
- [ ] As a user, I want to toggle the debug cell outlines and labels on/off for a cleaner preview
- [ ] As a user, I want to toggle the gap between frame cells on/off for pixel-perfect vs debug views
