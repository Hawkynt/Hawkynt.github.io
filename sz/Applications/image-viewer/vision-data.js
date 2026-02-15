;(function(){window.__visionMd=`# Image Viewer

A lightweight image viewer for »SynthelicZ« that supports common image formats, zooming, rotation, and navigation between images in a directory.

## Product Requirements

### Purpose
Image Viewer provides a fast, intuitive way to browse and inspect image files within the »SynthelicZ« desktop. It fills the essential role of a default image viewing application, allowing users to open, zoom, rotate, and navigate through images without leaving the desktop environment.

### Key Capabilities
- Opening images via file dialog, drag-and-drop, or command line arguments
- Sequential navigation through sibling images in the same directory with wraparound
- Multi-level zoom control with predefined levels from 10% to 1600%, fit-to-window, and actual-size modes
- Clockwise and counter-clockwise 90-degree rotation with correct fit-to-window recalculation
- Broad format support including PNG, BMP, JPG, GIF, SVG, WebP, and ICO
- Toolbar, menu bar, and keyboard shortcut access for all major actions
- Status bar showing filename, image dimensions, zoom percentage, and file size

### Design Reference
Modeled after the classic Windows Photo Viewer and Windows XP image preview, providing a clean single-image view with simple toolbar-driven controls for zoom, rotation, and navigation.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### File Operations
- [x] As a user, I can open an image file using a file dialog (Ctrl+O)
- [x] As a user, I can close the currently loaded image
- [x] As a user, I can drag and drop an image file from my desktop onto the viewer
- [x] As a user, I can drag and drop a file path to open an image
- [x] As a user, I can open an image passed via command line arguments
- [x] As a user, I can exit the application from the File menu
- [ ] As a user, I want to save a copy of the currently viewed image
- [ ] As a user, I want to copy the image to the clipboard

### Image Navigation
- [x] As a user, I can navigate to the next image in the same directory using the Next button or Right Arrow key
- [x] As a user, I can navigate to the previous image in the same directory using the Previous button or Left Arrow key
- [x] As a user, I can use PageUp/PageDown to navigate between images
- [x] As a user, I can jump to the first image using the Home key
- [x] As a user, I can jump to the last image using the End key
- [x] As a user, I can see navigation wraps around from last to first and vice versa
- [x] As a user, I see navigation buttons disabled when only one image or no image is loaded

### Zooming
- [x] As a user, I can zoom in using the toolbar button or Ctrl++
- [x] As a user, I can zoom out using the toolbar button or Ctrl+-
- [x] As a user, I can fit the image to the window using Ctrl+0
- [x] As a user, I can view the image at actual size (1:1) using Ctrl+1
- [x] As a user, I can zoom using Ctrl+mouse wheel
- [x] As a user, I can see the current zoom percentage in the status bar
- [x] As a user, I can see the image scaled through predefined zoom levels (10% to 1600%)
- [x] As a user, I see fit-to-window mode reapplied when the window is resized
- [ ] As a user, I want to pan the image by clicking and dragging when zoomed beyond the viewport
- [ ] As a user, I want to zoom into the area under my mouse cursor

### Rotation
- [x] As a user, I can rotate the image clockwise 90 degrees (Ctrl+R)
- [x] As a user, I can rotate the image counter-clockwise 90 degrees (Ctrl+Shift+R)
- [x] As a user, I can see the image dimensions update after rotation in the status bar
- [x] As a user, I can see fit-to-window mode account for rotation when calculating the scale
- [ ] As a user, I want to flip the image horizontally
- [ ] As a user, I want to flip the image vertically

### User Interface
- [x] As a user, I can see the filename displayed in the window title bar
- [x] As a user, I can see a toolbar with quick-access buttons for all major actions
- [x] As a user, I can see a menu bar with File, View, and Help menus
- [x] As a user, I can see keyboard shortcuts listed next to menu items
- [x] As a user, I see a helpful empty-state message when no image is loaded
- [x] As a user, I can see an About dialog with application information
- [ ] As a user, I want a thumbnail strip showing all images in the current directory

### Status Bar
- [x] As a user, I can see the current filename in the status bar
- [x] As a user, I can see the image dimensions in pixels
- [x] As a user, I can see the current zoom percentage
- [x] As a user, I can see the file size in human-readable format (B, KB, MB)

### Format Support
- [x] As a user, I can view PNG images
- [x] As a user, I can view BMP images
- [x] As a user, I can view JPG/JPEG images
- [x] As a user, I can view GIF images
- [x] As a user, I can view SVG images
- [x] As a user, I can view WebP images
- [x] As a user, I can view ICO images
- [ ] As a user, I want to see animated GIFs play their animation
- [ ] As a user, I want to view TIFF images

### Error Handling
- [x] As a user, I see an error message if a file cannot be opened
- [x] As a user, I see an error message if a dropped file cannot be decoded
- [x] As a user, I can close an image and return to the empty state with Escape

### Accessibility
- [ ] As a user, I want keyboard shortcuts for all toolbar actions
- [ ] As a user, I want color-accurate rendering with ICC profile support
- [ ] As a user, I want EXIF metadata displayed in a properties panel
`})();
