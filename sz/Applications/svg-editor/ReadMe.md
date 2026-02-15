# SVG Editor

A vector graphics editor for the »SynthelicZ« desktop that provides shape drawing tools, layer management, SVG source editing, and PNG export. It supports creating and editing SVG documents with standard shapes, freehand paths, and text elements.

## Product Requirements

### Purpose
The SVG Editor gives »SynthelicZ« desktop users a lightweight vector graphics authoring tool directly in the browser, eliminating the need for heavy native applications like Inkscape or Illustrator for simple vector work. It covers the common workflow of creating shapes, arranging layers, editing styles, and exporting to SVG or PNG -- all accessible from a desktop window within the shell.

### Key Capabilities
- Shape drawing tools for rectangles, ellipses, circles, lines, freehand paths, and text elements
- Element selection with 8-handle resize, move, nudge, and z-order management
- Style property editing for fill, stroke, stroke width, and opacity with Color Picker integration
- Layer management panel with visibility toggling and front/back ordering
- Raw SVG source viewing and direct editing with apply-on-demand workflow
- Zoom, pan, grid overlay, and snap-to-grid for precise drawing
- Full undo/redo history and clipboard operations (copy, cut, paste, duplicate)
- PNG export and SVG file open/save with dirty-state tracking

### Design Reference
Inspired by simplified vector editors such as SVG-edit and the basic shape tools in Microsoft Visio, providing an approachable interface for quick vector illustration without the complexity of a full professional suite.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### File Operations
- [x] As a user, I can create a new blank SVG document with default dimensions
- [x] As a user, I can open existing SVG files via a file dialog
- [x] As a user, I can save the current SVG document to a file path
- [x] As a user, I can save the document under a new name via Save As
- [x] As a user, I can export the current SVG as a PNG image
- [x] As a user, I can open files passed via the command line when launched from the desktop
- [x] As a user, I can see the dirty/modified state indicated in the title bar

### Drawing Tools
- [x] As a user, I can draw rectangles by clicking and dragging
- [x] As a user, I can draw ellipses by clicking and dragging
- [x] As a user, I can draw circles by clicking and dragging (radius from center)
- [x] As a user, I can draw straight lines by clicking and dragging
- [x] As a user, I can draw freehand paths by clicking and dragging
- [x] As a user, I can add text elements by clicking and typing in a prompt
- [x] As a user, I can select and move existing elements by dragging
- [x] As a user, I can pan the view by dragging with the Pan tool

### Selection and Manipulation
- [x] As a user, I can select an element by clicking on it
- [x] As a user, I can see 8 resize handles (corners and midpoints) around the selected element
- [x] As a user, I can resize rectangles, ellipses, and circles by dragging handles
- [x] As a user, I can move selected elements by dragging
- [x] As a user, I can nudge selected elements with arrow keys (1px or 10px with Shift)
- [x] As a user, I can deselect all elements with Escape
- [x] As a user, I can select all elements

### Style Properties
- [x] As a user, I can set the fill color for new and selected shapes
- [x] As a user, I can set the stroke color for new and selected shapes
- [x] As a user, I can set the stroke width for new and selected shapes
- [x] As a user, I can set the opacity for new and selected shapes
- [x] As a user, I can see style properties update in the sidebar when selecting an element
- [x] As a user, I can use the Color Picker app integration for fill and stroke colors

### Clipboard Operations
- [x] As a user, I can copy the selected element
- [x] As a user, I can cut the selected element
- [x] As a user, I can paste a previously copied element with a 10px offset
- [x] As a user, I can duplicate the selected element
- [x] As a user, I can delete the selected element

### Layer Management
- [x] As a user, I can see a list of all elements in the Layers panel
- [x] As a user, I can click on a layer entry to select the corresponding element
- [x] As a user, I can toggle visibility of individual elements via checkboxes
- [x] As a user, I can bring a selected element to the front
- [x] As a user, I can bring a selected element one step forward
- [x] As a user, I can send a selected element one step backward
- [x] As a user, I can send a selected element to the back

### Document Settings
- [x] As a user, I can set the document width and height
- [x] As a user, I can apply a new document size

### Source Editing
- [x] As a user, I can view the raw SVG source in a textarea
- [x] As a user, I can edit the SVG source directly and apply changes
- [x] As a user, I can reload the source view to reflect current state

### View Controls
- [x] As a user, I can zoom in and out through multiple predefined zoom levels
- [x] As a user, I can reset zoom to 100%
- [x] As a user, I can fit the document to the window
- [x] As a user, I can zoom with Ctrl+mouse wheel
- [x] As a user, I can toggle a grid overlay
- [x] As a user, I can toggle snap-to-grid for drawing precision
- [x] As a user, I can switch between light and dark mode

### Undo/Redo
- [x] As a user, I can undo up to 30 actions
- [x] As a user, I can redo previously undone actions

### Text Editing
- [x] As a user, I can double-click a text element to edit its content

### Keyboard Shortcuts
- [x] As a user, I can use Ctrl+N/O/S for file operations
- [x] As a user, I can use Ctrl+Z/Y for undo/redo
- [x] As a user, I can use Ctrl+C/X/V/D for clipboard and duplicate
- [x] As a user, I can use Ctrl+A for select all
- [x] As a user, I can use Ctrl+G to toggle grid
- [x] As a user, I can use Ctrl+0/+/- for zoom controls
- [x] As a user, I can use single-key shortcuts (V, R, E, C, L, P, T, H) to switch tools
- [x] As a user, I can use Del/Backspace to delete selected elements

### User Interface
- [x] As a user, I can see mouse coordinates in the status bar
- [x] As a user, I can see the current tool name in the status bar
- [x] As a user, I can see the zoom level in the status bar
- [x] As a user, I can see the document dimensions in the status bar
- [x] As a user, I can see the element count in the status bar
- [x] As a user, I can use a menu bar with File, Edit, View, Tools, and Help menus
- [x] As a user, I can see a keyboard shortcuts reference dialog
- [x] As a user, I can see an About dialog

### Aspirational Features
- [ ] As a user, I want to draw polygons and polylines
- [ ] As a user, I want to group and ungroup elements
- [ ] As a user, I want to apply rotation transforms to elements via handle or input
- [ ] As a user, I want to apply gradient fills (linear and radial) to shapes
- [ ] As a user, I want to use a Bezier curve tool for precise path drawing
- [ ] As a user, I want to import SVG clip art or symbols from a library
- [ ] As a user, I want to align and distribute multiple selected elements
- [ ] As a user, I want to see a ruler along the edges of the workspace
