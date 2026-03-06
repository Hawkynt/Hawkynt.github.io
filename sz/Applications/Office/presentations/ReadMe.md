# Presentations

A PowerPoint-like presentation editor for the SynthelicZ Desktop. Create, edit, and present slide decks with rich content, 60+ transitions, animations, PPTX import/export, and fullscreen slideshow mode.

## Features

- **Office-style ribbon UI** with 7 tabs: Home, Insert, Design, Transitions, Animations, Review, View
- **Slide editor** with 6 layout templates and 8 preset themes
- **5 element types**: textbox, image, shape, table, group — with drag, resize, rotation
- **Text editing** — double-click textbox to enter edit mode with contenteditable; changes sync to data model on input/blur
- **Context menu** — right-click any element for Cut, Copy, Paste, Delete, Duplicate, Bring Forward/Send Backward, and element-specific options
- **60+ slide transitions** via shared transition engine (fade, dissolve, push, wipe, split, flip, cube, zoom, morph, and many more)
- **Animation engine** — 19 animation presets in 4 categories with CSS keyframe generation, timeline builder, 3 trigger types, animation pane sidebar
- **PPTX import/export** via JSZip with style/layout round-trip
- **PNG export** of individual slides
- **PDF export** via print CSS rules
- **Fullscreen slideshow** with keyboard navigation and presenter view
- **Smart guides** — red dashed alignment lines during element drag
- **Snap-to-grid** — 15px grid with Alt to disable
- **Element alignment and distribution** — 6 align + 2 distribute operations
- **Element grouping/ungrouping**
- **Format Painter** — single-click and sticky double-click mode
- **Find and Replace** across all slides
- **Spell check** with dictionary support
- **Comments system** — positioned markers with sidebar panel
- **Slide sections** — named, collapsible groups
- **Slide sorter view**
- **Speaker notes**
- **Presenter view** — dual-window with notes and timer
- **Charts** — canvas-based with data editor
- **SmartArt diagrams** — 6 types with SVG rendering and auto-layout
- **Connector lines** — straight/elbow/curved SVG paths with 4 arrow types
- **Morph transition intelligence** — 3-pass element matching by ID/name/type+proximity
- **Hyperlinks** with tooltip and slideshow click handling
- **Slide numbering and footer**
- **Undo/redo** history
- **Background customization** per slide
- **Ruler display** with draggable guides

## User Stories

### Slide Editing
- [x] As a user, I can create new slides with 6 layout templates
- [x] As a user, I can select from 8 preset themes for visual design
- [x] As a user, I can add textbox, image, shape, table, and group elements to slides
- [x] As a user, I can drag, resize, and rotate elements on the slide canvas
- [x] As a user, I can double-click a textbox to enter edit mode with contenteditable
- [x] As a user, I can edit placeholder text directly on the slide and have changes sync to the data model
- [x] As a user, I can right-click any element for a context menu with Cut, Copy, Paste, Delete, Duplicate, ordering, and element-specific options
- [x] As a user, I can use smart guides (red dashed alignment lines) during element drag
- [x] As a user, I can snap elements to a 15px grid, with Alt to disable snapping
- [x] As a user, I can align and distribute elements (6 align + 2 distribute operations)
- [x] As a user, I can group and ungroup elements
- [x] As a user, I can use Format Painter with single-click and sticky double-click mode
- [x] As a user, I can customize the background per slide
- [x] As a user, I can use a ruler display with draggable guides

### Slide Management
- [x] As a user, I can organize slides into named, collapsible sections
- [x] As a user, I can view slides in a slide sorter view
- [x] As a user, I can drag and drop slides in the slide sorter to reorder them
- [x] As a user, I can add slide numbering and footer text

### Transitions & Animations
- [x] As a user, I can apply 60+ slide transitions (fade, dissolve, push, wipe, split, flip, cube, zoom, morph, and more)
- [x] As a user, I can set transition duration and have it sync across preview and slideshow playback
- [x] As a user, I can apply 19 animation presets in 4 categories with CSS keyframe generation
- [x] As a user, I can use the animation pane sidebar to manage animation timelines and 3 trigger types
- [x] As a user, I can see morph transition intelligence with 3-pass element matching by ID/name/type+proximity

### Presenter & Slideshow
- [x] As a user, I can start a fullscreen slideshow with keyboard navigation
- [x] As a user, I can use presenter view with a dual-window showing notes and timer
- [x] As a user, I can toggle the speaker notes panel to show or hide my notes while editing
- [x] As a user, I can add and edit speaker notes per slide

### Content Types
- [x] As a user, I can insert canvas-based charts with a data editor
- [x] As a user, I can insert SmartArt diagrams (6 types) with SVG rendering and auto-layout
- [x] As a user, I can insert connector lines (straight/elbow/curved SVG paths) with 4 arrow types
- [x] As a user, I can insert hyperlinks with tooltip and slideshow click handling

### Review & Collaboration
- [x] As a user, I can use Find and Replace across all slides
- [x] As a user, I can use spell check with dictionary support
- [x] As a user, I can add positioned comments with a sidebar panel

### File Operations
- [x] As a user, I can import and export PPTX files via JSZip with style/layout round-trip
- [x] As a user, I can export individual slides as PNG
- [x] As a user, I can export as PDF via print CSS rules

### History
- [x] As a user, I can undo and redo changes

### Ribbon Interface
- [x] As a user, I can access 7 ribbon tabs: Home, Insert, Design, Transitions, Animations, Review, View

## Controls

| Input | Action |
|-------|--------|
| Click | Select element |
| Double-click textbox | Enter text editing mode |
| Right-click | Context menu |
| Drag | Move element |
| Drag handles | Resize element |
| Green handle | Rotate element |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Ctrl+S | Save |
| Ctrl+C/X/V | Copy / Cut / Paste |
| Delete | Remove selected element |
| F5 | Start slideshow |
| Escape | Exit slideshow / Deselect |

## Architecture

- `index.html` — Entry point with ribbon UI, backstage menu, slide panel, canvas, dialogs
- `controller.js` — Main IIFE controller: slide model, element manipulation, ribbon wiring, undo/redo, context menu
- `slide-renderer.js` — Builds slide DOM from data model (textbox, image, shape, table elements)
- `pptx-engine.js` — PPTX import/export using JSZip
- `animation-engine.js` — Animation presets, timeline, CSS keyframe generation
- `slideshow-mode.js` — Fullscreen slideshow with transition engine integration
- `presenter-view.js` — Dual-window presenter view with notes and timer
- `chart-element.js` — Canvas-based chart rendering for slide charts
- `smartart-engine.js` — SmartArt diagram types with SVG rendering
- `comments.js` — Comments system with positioned markers
- `spell-check.js` — Spell checking with dictionary support
- `styles.css` — Layout, theming, slide canvas styling

## SEO Keywords

presentations, PowerPoint, slide editor, browser presentations, PPTX editor, slideshow maker, slide transitions, presentation software, online slides, SynthelicZ Desktop, web application
