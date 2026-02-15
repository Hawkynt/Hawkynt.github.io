# Paint

A Paint.NET-class bitmap image editor with layer support, ribbon UI, mask-based selection, advanced drawing tools, image adjustments, and effects -- inside the SynthelicZ desktop.

## Product Requirements

### Purpose
Paint provides a full-featured bitmap image editor within the SynthelicZ desktop, enabling users to create multi-layer compositions, perform non-destructive edits with selection masks, apply image adjustments and effects with live preview, and work with professional drawing tools. It fills the role of both a quick-access graphics tool and a serious image editing application comparable to Paint.NET.

### Key Capabilities
- Layer system with opacity, blend modes, visibility, reordering, merge, and flatten
- Ribbon UI with tabbed panels (Home, Image, Adjustments, Effects, View) plus File backstage
- 16 drawing tools including pencil, shapes, gradient, clone stamp, blur/sharpen brush, airbrush, polygon, and bezier curves
- Mask-based selection with rectangular, lasso, and magic wand tools
- Selection modes: replace, add (Shift), subtract (Alt), intersect (Shift+Alt)
- Marching ants animation on selection boundaries
- Clipboard operations (copy, cut, paste, paste as new layer) within selection
- Image adjustments with live preview: brightness/contrast, hue/saturation, levels, invert, grayscale, sepia, auto levels
- Convolution effects with live preview: Gaussian blur, sharpen, add noise, pixelate, edge detect, emboss
- Advanced image resizing with 40+ algorithms: pixel art scalers (Eagle, EPX, HQ, XBR, xBRZ, SAI, MMPX, ReverseAA, ScaleHQ, SABR) and kernel-based resamplers (Lanczos, Bicubic, Mitchell, Spline, Windowed Sinc families)
- Per-layer and structural undo/redo (30 steps)
- File I/O with new, open, save, save as, and export (PNG, JPG)
- Zoom at 1x through 8x with pixel grid toggle
- 28-color palette with foreground/background swap

### Design Reference
Modeled after Paint.NET -- a layer-aware bitmap editor with a ribbon-style toolbar, layer panel, selection system, and effect dialogs with live preview. The ribbon UI follows the same pattern used by the SynthelicZ WordPad application.

### Technical Constraints
- Runs inside an iframe within the SynthelicZ desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the `file://` protocol
- Themed via CSS custom properties injected by the SynthelicZ theme engine
- Split into multiple `<script defer>` files communicating via `window.PaintApp` namespace

## Architecture

### File Organization

```
js/
  system.drawing.resizing.js   Pixel art scalers + kernel resamplers (SZ.System.Drawing.Resizing)

Applications/paint/
  index.html              Ribbon UI, layer panel, effect dialogs, script tags
  styles.css              Ribbon CSS (WordPad pattern), layer panel, dialogs
  layer-model.js          Layer data model + compositing
  selection-engine.js     Selection mask, magic wand, lasso, marching ants
  effects-engine.js       Pixel adjustments and convolution effects
  scaler-engine.js        Resize dialog UI (scaler picker with preview)
  tools.js                Drawing tool implementations
  controller.js           Main wiring: ribbon, events, undo/redo, file I/O
```

Script load order: `layer-model.js` -> `selection-engine.js` -> `effects-engine.js` -> `system.drawing.resizing.js` -> `scaler-engine.js` -> `tools.js` -> `controller.js`

### Display Architecture

```
Layer 0 (Background)  \
Layer 1                 |--> compositeToDisplay() --> #display-canvas --> CSS zoom
Layer N                /
                                                     #overlay-canvas (previews, marching ants)
```

Each layer is an offscreen `<canvas>` at document resolution. The display canvas shows the composited result. An overlay canvas on top handles tool previews and marching ants.

### Layer Model

- Layers stored as `{ canvas, ctx, name, visible, opacity, blendMode }`
- Operations: add, delete, move, duplicate, merge down, flatten all
- 12 blend modes: Normal, Multiply, Screen, Overlay, Darken, Lighten, Color Dodge, Color Burn, Hard Light, Soft Light, Difference, Exclusion
- Compositing via `drawImage` with `globalAlpha` and `globalCompositeOperation`
- Serialization for undo: per-layer `ImageData` for draw ops, full stack serialization for structural changes

### Selection Engine

- Mask stored as an alpha-mask canvas (white = selected, black = not)
- Selection tools: rectangular, lasso (freeform polygon), magic wand (flood fill by color similarity)
- Modes: replace, add, subtract, intersect (via `globalCompositeOperation` on the mask canvas)
- Marching ants: edge-detect the mask boundary, stroke with animated `setLineDash`
- Clipboard: copy/cut extracts pixels within mask, paste creates a new layer

### Effects Engine

- Adjustments (pixel-level remapping): brightness/contrast, hue/saturation, levels, invert, grayscale, sepia, auto levels
- Effects (kernel convolution): Gaussian blur (separable), sharpen (unsharp mask), noise, pixelate, edge detect (Sobel), emboss
- All operate on active layer within selection mask
- Each opens a dialog with sliders and live preview thumbnail

## User Stories

### File Management
- [x] As a user, I can create a new blank canvas
- [x] As a user, I can open image files from the virtual file system
- [x] As a user, I can save my drawing to the file system
- [x] As a user, I can save a copy with Save As
- [x] As a user, I can export to PNG and JPG formats
- [x] As a user, I can import images from my PC via the Import button in the Open dialog
- [x] As a user, I can download images to my PC via the Download button in Save/Export dialogs
- [x] As a user, I can see the file name in the window title
- [ ] As a user, I can be prompted to save unsaved changes before starting a new canvas

### Layer System
- [x] As a user, I can add new transparent layers above the active layer
- [x] As a user, I can delete layers (except the last one)
- [x] As a user, I can reorder layers with move up/down buttons
- [x] As a user, I can duplicate a layer
- [x] As a user, I can merge a layer down into the one below
- [x] As a user, I can flatten all layers into one
- [x] As a user, I can toggle layer visibility with an eye icon
- [x] As a user, I can adjust layer opacity with a slider
- [x] As a user, I can set a blend mode per layer (12 modes)
- [x] As a user, I can rename layers by clicking the layer name
- [x] As a user, I can see layer thumbnails that update in real-time
- [x] As a user, I can click a layer entry to make it the active drawing target

### Drawing Tools
- [x] As a user, I can draw freehand with the pencil tool
- [x] As a user, I can draw straight lines
- [x] As a user, I can draw rectangles in outline or filled mode
- [x] As a user, I can draw ellipses in outline or filled mode
- [x] As a user, I can draw rounded rectangles with configurable corner radius
- [x] As a user, I can erase parts of the drawing
- [x] As a user, I can flood-fill enclosed areas with a chosen color
- [x] As a user, I can type text onto the canvas with the text tool
- [x] As a user, I can pick a color from the canvas with the color picker
- [x] As a user, I can draw polygons by clicking vertices and closing the path
- [x] As a user, I can draw bezier curves by placing control points
- [x] As a user, I can use a gradient tool (linear or radial, foreground to background)
- [x] As a user, I can use a clone stamp tool (Alt+click to set source)
- [x] As a user, I can use a blur brush to soften areas
- [x] As a user, I can use a sharpen brush to enhance details
- [x] As a user, I can use an airbrush/spray tool

### Tool Options
- [x] As a user, I can set brush size from 1 to 100 pixels
- [x] As a user, I can choose fill mode (outline, filled, or both)
- [x] As a user, I can choose brush shape (round or square)
- [x] As a user, I can choose gradient mode (linear or radial)
- [x] As a user, I can set corner radius for rounded rectangles

### Color Management
- [x] As a user, I can pick a foreground color with left-click on the palette
- [x] As a user, I can pick a background color with right-click on the palette
- [x] As a user, I can see the active foreground and background colors
- [x] As a user, I can swap foreground and background colors

### Selection
- [x] As a user, I can select a rectangular area on the canvas
- [x] As a user, I can use freeform lasso selection
- [x] As a user, I can select by color similarity with magic wand (configurable tolerance)
- [x] As a user, I can add to selection with Shift
- [x] As a user, I can subtract from selection with Alt
- [x] As a user, I can intersect selection with Shift+Alt
- [x] As a user, I can select all, deselect, and invert selection
- [x] As a user, I can copy, cut, and paste within selection
- [x] As a user, I can paste as a new layer
- [x] As a user, I can see animated marching ants on the selection boundary

### Image Operations
- [x] As a user, I can flip the image horizontally
- [x] As a user, I can flip the image vertically
- [x] As a user, I can rotate the image 90 degrees clockwise
- [x] As a user, I can rotate the image 90 degrees counter-clockwise
- [x] As a user, I can rotate the image 180 degrees
- [x] As a user, I can resize the canvas (anchor-based)
- [x] As a user, I can stretch/resize the image using a scaler picker dialog with 20+ pixel art scalers and 20+ resamplers
- [x] As a user, I can preview each scaling algorithm in the resize dialog before applying
- [x] As a user, I can choose pixel art upscalers (Eagle, EPX, HQ, XBR, xBRZ, SAI, MMPX, ReverseAA, ScaleHQ, SABR) for integer-multiple upscaling
- [x] As a user, I can choose kernel-based resamplers (Lanczos, Bicubic, Mitchell, Spline, Windowed Sinc) for arbitrary resize ratios
- [x] As a user, I can crop to the current selection
- [x] As a user, I can clear the active layer

### Adjustments
- [x] As a user, I can adjust brightness and contrast with a dialog and live preview
- [x] As a user, I can adjust hue and saturation with a dialog and live preview
- [x] As a user, I can adjust levels (input black/white points and gamma) with live preview
- [x] As a user, I can invert colors
- [x] As a user, I can convert to grayscale
- [x] As a user, I can apply a sepia tone
- [x] As a user, I can auto-level (stretch histogram per channel)

### Effects
- [x] As a user, I can apply Gaussian blur with configurable radius and live preview
- [x] As a user, I can apply sharpen with configurable amount and live preview
- [x] As a user, I can add noise with configurable amount
- [x] As a user, I can pixelate with configurable block size
- [x] As a user, I can apply edge detection (Sobel operator)
- [x] As a user, I can apply emboss effect

### Undo and Redo
- [x] As a user, I can undo recent drawing and layer actions (30 steps)
- [x] As a user, I can redo previously undone actions

### Zoom and View
- [x] As a user, I can zoom in at 1x, 2x, 4x, and 8x magnification
- [x] As a user, I can zoom with Ctrl+Scroll
- [x] As a user, I can use a zoom slider in the ribbon and status bar
- [x] As a user, I can type a zoom level into the status bar zoom input
- [x] As a user, I can toggle a pixel grid overlay at high zoom levels (4x+)
- [x] As a user, I can pan the canvas with a dedicated pan tool
- [x] As a user, I can see the current cursor position in pixels on the status bar
- [x] As a user, I can see the canvas dimensions on the status bar

### Keyboard Shortcuts
- [x] Ctrl+N -- New canvas
- [x] Ctrl+O -- Open file
- [x] Ctrl+S -- Save
- [x] Ctrl+Z -- Undo
- [x] Ctrl+Y -- Redo
- [x] Ctrl+A -- Select all
- [x] Ctrl+D -- Deselect
- [x] Ctrl+Shift+I -- Invert selection
- [x] Ctrl+C -- Copy
- [x] Ctrl+X -- Cut
- [x] Ctrl+V -- Paste
- [x] Ctrl+Shift+V -- Paste as new layer
- [x] Ctrl+Shift+N -- New layer
- [x] Delete -- Delete active layer
- [x] Ctrl+1/2/3/4 -- Zoom 1x/2x/4x/8x

## Planned Features
- Undo history panel to jump to a specific state
- Rotate by arbitrary angle
- Custom color picker dialog
- Ruler overlays along top and left edges
- Dashed/dotted line styles
- Text tool font/size/style options
- Resize selection handles
- Save/load custom color palettes

## Known Limitations
- Layers flatten to a single background layer on file save (no native layered format)
- No CMYK or color profile support
- Text is rasterized immediately on commit (not re-editable)
- Clone stamp source resets between strokes
- Effect preview thumbnail is downscaled; fine detail may differ from final result
