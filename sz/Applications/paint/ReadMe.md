# Paint

A bitmap drawing and image editing tool with essential drawing tools, color management, image transformations, and zoom -- the classic desktop paint application inside »SynthelicZ«.

## Product Requirements

### Purpose
Paint provides a straightforward bitmap image editor within the »SynthelicZ« desktop, enabling users to create drawings, edit images, and perform basic image manipulation. It fills the essential role of a quick-access graphics tool for annotating screenshots, creating simple artwork, and performing everyday image operations like cropping, resizing, and color adjustments.

### Key Capabilities
- File management with new, open, save, and save-as for image files
- Drawing tools including pencil, line, rectangle, ellipse, eraser, flood fill, text, and color picker
- Configurable tool options for line width and fill mode (outline vs. filled)
- Color management with a 28-color palette for foreground and background color selection
- Selection, dragging, and repositioning of rectangular canvas regions
- Image transformation operations including flip, rotate, and resize/stretch
- Multi-level undo and redo for drawing actions
- Zoom at 1x, 2x, 4x, and 8x magnification with scroll-wheel support

### Design Reference
Modeled after the classic Microsoft Paint (mspaint.exe) found in Windows 95 through Windows XP -- a simple, approachable bitmap editor with a vertical tool palette on the left, a color palette at the bottom, and a canvas workspace in the center.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### File Management
- [x] As a user, I can create a new blank canvas
- [x] As a user, I can open image files from the virtual file system
- [x] As a user, I can save my drawing to the file system
- [x] As a user, I can save a copy with Save As
- [ ] As a user, I can export to multiple image formats (PNG, BMP, JPG, GIF)
- [ ] As a user, I can see the file name in the window title
- [ ] As a user, I can be prompted to save unsaved changes before starting a new canvas

### Drawing Tools
- [x] As a user, I can draw freehand with the pencil tool
- [x] As a user, I can draw straight lines
- [x] As a user, I can draw rectangles in outline or filled mode
- [x] As a user, I can draw ellipses in outline or filled mode
- [x] As a user, I can erase parts of the drawing
- [x] As a user, I can flood-fill enclosed areas with a chosen color
- [x] As a user, I can type text onto the canvas with the text tool
- [x] As a user, I can pick a color from the canvas with the color picker
- [x] As a user, I can select a rectangular region of the canvas
- [ ] As a user, I can draw rounded rectangles
- [ ] As a user, I can draw polygons with an arbitrary number of sides
- [ ] As a user, I can draw curves and bezier paths
- [ ] As a user, I can use a spray/airbrush tool
- [ ] As a user, I can use a stamp/clone tool to copy regions

### Tool Options
- [x] As a user, I can choose from multiple line widths (1, 2, 3, 5 pixels)
- [x] As a user, I can toggle between outline and filled drawing mode for shapes
- [ ] As a user, I can set custom line widths beyond the presets
- [ ] As a user, I can choose different line styles (dashed, dotted)
- [ ] As a user, I can set text font, size, and style for the text tool

### Color Management
- [x] As a user, I can pick a foreground color with left-click on the palette
- [x] As a user, I can pick a background color with right-click on the palette
- [x] As a user, I can see the active foreground and background colors
- [ ] As a user, I can define custom colors using a color picker dialog
- [ ] As a user, I can swap foreground and background colors
- [ ] As a user, I can save and load custom color palettes

### Selection
- [x] As a user, I can select a rectangular area on the canvas
- [x] As a user, I can drag a selected region to reposition it
- [ ] As a user, I can copy, cut, and paste selected regions
- [ ] As a user, I can use a freeform selection tool
- [ ] As a user, I can resize a selection by dragging handles
- [ ] As a user, I can select by color (magic wand)

### Image Operations
- [x] As a user, I can flip the image horizontally
- [x] As a user, I can flip the image vertically
- [x] As a user, I can rotate the image 90 degrees clockwise
- [x] As a user, I can rotate the image 90 degrees counter-clockwise
- [x] As a user, I can resize or stretch the canvas to specific pixel dimensions
- [ ] As a user, I can rotate the image by an arbitrary angle
- [ ] As a user, I can crop the image to the current selection
- [ ] As a user, I can invert the colors of the image
- [ ] As a user, I can adjust brightness and contrast

### Undo and Redo
- [x] As a user, I can undo recent drawing actions
- [x] As a user, I can redo previously undone actions
- [ ] As a user, I can see an undo history panel to jump back to a specific state

### Zoom and View
- [x] As a user, I can zoom in at 1x, 2x, 4x, and 8x magnification
- [x] As a user, I can zoom with Ctrl+Scroll
- [x] As a user, I can see the current cursor position in pixels on the status bar
- [x] As a user, I can see the canvas dimensions on the status bar
- [ ] As a user, I can toggle a pixel grid overlay at high zoom levels
- [ ] As a user, I can pan the canvas when zoomed in by holding the middle mouse button
- [ ] As a user, I can use rulers along the top and left edges
