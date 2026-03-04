# Icon Editor

A full-featured multi-image ICO/CUR editor with pixel-level drawing tools, alpha channel support, and the ability to extract icons from Windows PE executables. Designed for creating and editing icon files at every standard size and bit depth within the »SynthelicZ« desktop.

## Product Requirements

### Purpose
The Icon Editor provides a complete icon authoring environment inside the »SynthelicZ« desktop, enabling users to create, edit, and manage multi-image ICO and CUR files without leaving the browser. It solves the problem of needing a dedicated native application for pixel-level icon editing, PE resource extraction, and multi-resolution icon management, making it accessible directly from the desktop shell.

### Key Capabilities
- Multi-image ICO/CUR document management with support for all standard sizes and bit depths (1-bit through 32-bit RGBA)
- Pixel-level drawing tools (pencil, eraser, flood fill, line, rectangle, ellipse) with configurable brush sizes and shape fill modes
- Selection operations with cut, copy, paste, crop, and clipboard integration
- Image transformations including flip, rotate, resize, shift, and color adjustments (grayscale, invert, HSB, color replace)
- Quantization and dithering with multiple algorithms and visual preview for color depth reduction
- Icon extraction from Windows PE executables (EXE/DLL) with resource group browsing
- Import from PNG, BMP, SVG, JPG, and GIF with automatic multi-size generation
- Full undo/redo history and keyboard shortcut support

### Design Reference
Modeled after classic Windows icon editors such as Axialis IconWorkshop and the Visual Studio Image Editor, with a multi-image sidebar, pixel canvas with zoom, and integrated color palette.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### File Operations
- [x] As a user, I can create a new empty icon document
- [x] As a user, I can open existing ICO and CUR files via a file dialog
- [x] As a user, I can save the current icon document as an ICO file
- [x] As a user, I can save the icon document under a new name via Save As
- [x] As a user, I can import PNG, BMP, SVG, JPG, and GIF images and generate multiple icon sizes from them
- [x] As a user, I can export a favicon file with selectable sizes (16x16, 32x32, 48x48)
- [x] As a user, I can extract icons from EXE and DLL files using a PE resource browser
- [x] As a user, I can browse and select from multiple icon groups found in a PE file
- [x] As a user, I can export all icon groups from a PE file at once
- [x] As a user, I can open files passed via the command line when launched from the desktop
- [x] As a user, I can be prompted to save unsaved changes before starting a new file or exiting

### Multi-Image Management
- [x] As a user, I can see a list of all images in the icon document in the left sidebar
- [x] As a user, I can add new image sizes with custom width, height, and bit depth
- [x] As a user, I can choose from preset sizes (16x16, 24x24, 32x32, 48x48, 64x64, 128x128, 256x256)
- [x] As a user, I can remove an image from the icon document
- [x] As a user, I can duplicate an existing image
- [x] As a user, I can optionally fill a new image by scaling the current image using nearest-neighbor or bilinear interpolation
- [x] As a user, I can select different target bit depths (32-bit RGBA, 24-bit RGB, 8-bit, 4-bit, 1-bit monochrome)

### Drawing Tools
- [x] As a user, I can draw with the Pencil tool at the pixel level
- [x] As a user, I can erase pixels with the Eraser tool
- [x] As a user, I can pick colors from the canvas with the Eyedropper tool
- [x] As a user, I can fill contiguous areas with the Flood Fill tool
- [x] As a user, I can draw straight lines with the Line tool
- [x] As a user, I can draw rectangles with the Rectangle tool (outline, filled, or both)
- [x] As a user, I can draw ellipses with the Ellipse tool (outline, filled, or both)
- [x] As a user, I can make rectangular selections with the Selection tool
- [x] As a user, I can configure brush size from 1 to 8 pixels with a live preview
- [x] As a user, I can choose shape fill mode: outline only, filled only, or both

### Selection Operations
- [x] As a user, I can select all pixels in the image
- [x] As a user, I can deselect the current selection
- [x] As a user, I can delete the contents of the selection
- [x] As a user, I can cut, copy, and paste image selections via the clipboard
- [x] As a user, I can paste clipboard content as a new image
- [x] As a user, I can crop the image to the current selection

### Image Transformations
- [x] As a user, I can flip the image horizontally
- [x] As a user, I can flip the image vertically
- [x] As a user, I can rotate the image 90 degrees clockwise
- [x] As a user, I can rotate the image 90 degrees counter-clockwise
- [x] As a user, I can rotate the image 180 degrees
- [x] As a user, I can resize the image with nearest-neighbor or bilinear interpolation
- [x] As a user, I can shift/offset the image with optional wrapping

### Color Adjustments
- [x] As a user, I can convert the image to grayscale
- [x] As a user, I can invert all colors in the image
- [x] As a user, I can adjust hue, saturation, and brightness via sliders in a dialog
- [x] As a user, I can replace a specific color with another color, with adjustable tolerance
- [x] As a user, I can clear the entire image

### Color Management
- [x] As a user, I can select foreground and background colors
- [x] As a user, I can edit colors via RGB numeric inputs and hex input
- [x] As a user, I can adjust alpha transparency via a dedicated slider
- [x] As a user, I can pick colors from a built-in palette grid
- [x] As a user, I can use the system color picker dialog
- [x] As a user, I can double-click a palette swatch to edit that color slot (indexed images only)
- [x] As a user, I can right-click a palette swatch to set it as the background color
- [x] As a user, when I edit a palette slot color, all pixels using that color are automatically updated

### Quantization and Dithering
- [x] As a user, I can choose from multiple quantization algorithms when reducing color depth
- [x] As a user, I can choose from multiple dithering algorithms with a visual preview grid
- [x] As a user, I can see a combined preview of quantizer and ditherer before applying

### View Controls
- [x] As a user, I can toggle pixel grid overlay visibility
- [x] As a user, I can toggle the checkerboard transparency background
- [x] As a user, I can zoom to 1x, 4x, 8x, or 16x magnification
- [x] As a user, I can fit the zoom level to the available view area

### Undo/Redo
- [x] As a user, I can undo up to 30 actions
- [x] As a user, I can redo previously undone actions

### Keyboard Shortcuts
- [x] As a user, I can use Ctrl+N, Ctrl+O, Ctrl+S, Ctrl+Shift+S for file operations
- [x] As a user, I can use Ctrl+Z/Ctrl+Y for undo/redo
- [x] As a user, I can use Ctrl+X/C/V for cut/copy/paste
- [x] As a user, I can use Ctrl+A/D for select all/deselect
- [x] As a user, I can use single-key shortcuts (P, E, I, G, L, R, O, S) to switch tools
- [x] As a user, I can use Ctrl+1/2/3/4 to change zoom levels

### User Interface
- [x] As a user, I can see cursor position coordinates in the status bar
- [x] As a user, I can see the current zoom level in the status bar
- [x] As a user, I can see the image dimensions and bit depth in the status bar and sidebar
- [x] As a user, I can see the current filename in the status bar with a dirty indicator
- [x] As a user, I can use a ribbon interface with Home, Image, and View tabs plus a File backstage menu
- [x] As a user, I can see an About dialog with application information

### Aspirational Features
- [ ] As a user, I want to draw with anti-aliased lines and shapes
- [ ] As a user, I want to see a color histogram of the current image
- [ ] As a user, I want to use a gradient fill tool
- [ ] As a user, I want to apply blur and sharpen filters
- [ ] As a user, I want to define and save custom color palettes
- [ ] As a user, I want to see a split view comparing the image at different bit depths
- [ ] As a user, I want to drag and reorder images in the image list
