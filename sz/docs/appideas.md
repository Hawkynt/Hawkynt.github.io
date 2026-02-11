# Application Ideas

Tracking application ideas for SynthelicZ, including their hosting format and implementation status.

## Hosting Formats

| Format   | Type      | Entry        | Use When                                                               |
| -------- | --------- | ------------ | ---------------------------------------------------------------------- |
| `iframe` | HTML page | `index.html` | App can run standalone outside the OS (open directly in a browser tab) |
| `hosted` | JS class  | `app.js`     | App requires the OS runtime (SZ.system.*, window manager, etc.)        |

**Rule of thumb**: System utilities that interact with the OS internals (window manager, skin engine, settings) must be `hosted` (app.js). User-facing applications that could work independently (calculator, text editor, games) should be `iframe` (index.html).

---

## System Applications (hosted / app.js)

These apps require direct access to `SZ.system.*` and cannot function outside the OS.

| App           | Status          | Description                                                                  |
| ------------- | --------------- | ---------------------------------------------------------------------------- |
| Explorer      | exists (iframe) | Browse SZ runtime object tree + VFS (user documents), manage windows         |
| Task Manager  | exists (iframe) | Applications tab + Performance tab with real event-loop lag, NT-style graphs |
| Control Panel | exists (iframe) | Skin browser, background, icon packs, cursors, behaviour settings            |
| About         | exists (iframe) | Version info, credits, system details                                        |

**Note**: Explorer and Task Manager currently exist as `iframe` apps. They should be converted to `hosted` (app.js) format since they depend on `SZ.system.*` access via `postMessage`. As hosted apps they can access the runtime directly without the postMessage bridge.

---

## User Applications (iframe / index.html)

Standalone-capable apps that can run in a browser tab independently.

| App                   | Status          | Description                                                               |
| --------------------- | --------------- | ------------------------------------------------------------------------- |
| Data Encryption       | exists (iframe) | Encrypt/decrypt text data. Ported from original encryptor.htm             |
| Calculator            | exists (iframe) | Standard mode. Classic calc.exe look, keyboard support                    |
| Text Editor (Notepad) | exists (iframe) | Notepad-like plain text editor. Open/save via VFS postMessage bridge      |
| Paint                 | exists (iframe) | Bitmap drawing tool. Canvas-based, brush/shape/fill/text tools, undo     |
| WordPad               | exists (iframe) | Rich text editor (contentEditable, formatting toolbar, saves as HTML)     |
| Spreadsheet           | exists (iframe) | Excel-like grid with formula support, cell formatting, CSV import/export  |
| Web Browser           | exists (iframe) | Iframe-based with address bar, history, bookmarks                         |
| Media Player          | exists (iframe) | Audio/video player with playlist, visualization, transport controls       |
| Video Player          | planned         | HTML5 video player with playlist                                          |
| Terminal              | exists (iframe) | Dual-mode terminal: cmd.exe + bash shell with pipes, redirects, globbing  |
| Tetris                | exists (iframe) | Classic Tetris with SRS rotation, scoring, levels, high scores            |
| Minesweeper           | exists (iframe) | Classic minesweeper with 3 difficulty levels, flood fill, chording, timer |
| Solitaire             | exists (iframe) | Klondike solitaire with canvas-rendered cards, drag-and-drop, auto-complete|
| FreeCell              | exists (iframe) | FreeCell card game with canvas rendering, drag-and-drop, auto-complete    |
| Spider Solitaire      | exists (iframe) | Spider solitaire with 1/2/4 suit modes, canvas-rendered cards             |
| Image Viewer          | exists (iframe) | View images from VFS with zoom/rotate/navigate, common file dialog        |
| PDF Viewer            | idea            | Render PDFs using pdf.js                                                  |
| Clock / Alarm         | exists (iframe) | Date/time, calendar, alarms, stopwatch, timer, world clock (hidden app)   |
| File Manager          | exists (iframe) | Explorer overhauled: full VFS file operations (new/delete/rename/copy/paste)|
| Chat Client           | idea            | WebSocket-based chat (connect to IRC/Matrix/custom server)                |
| RSS Reader            | idea            | Feed reader with configurable sources                                     |
| Hex Editor            | exists (iframe) | View/edit binary data in hex + ASCII, offset display, search              |
| Diff Viewer           | exists (iframe) | Side-by-side/unified/inline text diff with character-level highlighting   |
| Markdown Editor       | exists (iframe) | Markdown editor with split-pane live preview, toolbar, VFS integration    |
| Color Picker          | exists (iframe) | Advanced color picker with RGB/HSL/HSV/CMYK, hex/float/byte values        |
| Font Viewer           | exists (iframe) | Preview system fonts with sample text, character grid, glyph inspector    |
| Screen Recorder       | idea            | Record desktop activity as GIF/WebM using MediaRecorder API               |
| QR Code Generator     | exists (iframe) | QR code generator with custom styling, colors, logos, PNG/SVG export      |
| Color Palette         | idea            | Color harmony generator with contrast checker (WCAG)                      |
| JSON Viewer           | exists (iframe) | JSON prettifier/validator with collapsible tree view, search, JSONPath    |
| Regex Tester          | exists (iframe) | Regex builder with live match highlighting, groups, explanation, cheatsheet|
| CSS Gradient Tool     | idea            | Visual CSS gradient editor with direction, stops, and code export         |

---

## Status Legend

| Status      | Meaning                               |
| ----------- | ------------------------------------- |
| exists      | App exists and is functional          |
| in progress | Currently being built                 |
| planned     | Committed to building, in the roadmap |
| idea        | Concept only, not yet committed       |
