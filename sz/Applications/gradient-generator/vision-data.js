;(function(){window.__visionMd=`# Gradient Generator

A CSS gradient builder for the »SynthelicZ« desktop with a live preview, interactive color stop editing, and support for linear, radial, and conic gradients. It generates ready-to-use CSS, supports gradient import/parsing, includes presets, and integrates with the SZ Color Picker app.

## Product Requirements

### Purpose
The Gradient Generator provides »SynthelicZ« desktop users with a visual tool for designing CSS gradients without writing code by hand. It addresses the difficulty of manually composing gradient syntax by offering interactive color stop manipulation, a live preview, and instant CSS output -- making it useful for web developers, designers, and anyone who needs gradient CSS quickly.

### Key Capabilities
- Support for linear, radial, and conic gradient types with full control over angle, shape, size, and position
- Interactive color stop management with draggable handles on a gradient track bar and automatic color interpolation
- Live preview with checkerboard transparency background and real-time updates
- Syntax-highlighted CSS output with inline color swatches and one-click clipboard copy
- CSS gradient import/parsing supporting vendor prefixes, multiple color formats (hex, rgb, hsl, named colors), and embedded CSS rules
- Preset gradient library (Sunset, Ocean, Rainbow, Fire, Forest, Pastel, Midnight, Gold) as starting points
- SZ Color Picker app integration for visual color selection

### Design Reference
Inspired by web-based CSS gradient generators such as cssgradient.io and the gradient editor in browser DevTools, packaged as a standalone desktop application with richer import/export capabilities.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Gradient Types
- [x] As a user, I can create linear gradients with a configurable angle (0-360 degrees)
- [x] As a user, I can create radial gradients with configurable shape (ellipse/circle), size keyword, and position
- [x] As a user, I can create conic gradients with configurable starting angle and position
- [x] As a user, I can switch between gradient types using tab buttons and see the preview update instantly
- [x] As a user, I can enable repeating mode for any gradient type

### Color Stop Management
- [x] As a user, I can see color stops displayed as draggable handles on a gradient track bar
- [x] As a user, I can add new color stops via an Add button that places them at the largest gap
- [x] As a user, I can remove color stops (minimum of 2 stops enforced)
- [x] As a user, I can select a stop by clicking its handle
- [x] As a user, I can drag stop handles to change their position along the gradient
- [x] As a user, I can click anywhere on the track bar to add a new stop at that position with the interpolated color
- [x] As a user, I can see new stops automatically get the interpolated color for their position

### Color Editing
- [x] As a user, I can edit the selected stop's color via a hex input field
- [x] As a user, I can click the color swatch to open the SZ Color Picker app for visual color selection
- [x] As a user, I can adjust the selected stop's position via a slider or numeric input (0-100%)
- [x] As a user, I can see the color swatch update in real-time as colors change

### Live Preview
- [x] As a user, I can see a large live preview area showing the current gradient
- [x] As a user, I can see a checkerboard background behind the preview for transparency visualization
- [x] As a user, I can see the gradient track bar update in real-time to match the current stops

### CSS Output
- [x] As a user, I can see the generated CSS code displayed with syntax highlighting
- [x] As a user, I can see color swatches inline within the highlighted CSS output
- [x] As a user, I can copy the CSS to the clipboard with a Copy button that shows confirmation feedback
- [x] As a user, I can see the full CSS property (background: ...) formatted and ready to use

### CSS Import / Paste
- [x] As a user, I can import a CSS gradient by clicking Paste CSS and entering the code
- [x] As a user, I can paste CSS gradient code directly onto the display area
- [x] As a user, I can import gradients with vendor prefixes (-webkit-, -moz-, -o-, -ms-)
- [x] As a user, I can import gradients using hex colors (#rgb, #rrggbb, #rrggbbaa)
- [x] As a user, I can import gradients using rgb(), rgba(), hsl(), and hsla() color functions
- [x] As a user, I can import gradients using CSS named colors (150+ supported)
- [x] As a user, I can import gradients embedded within CSS rules (e.g., .class { background: ... })
- [x] As a user, I can have CSS comments stripped during import
- [x] As a user, I can have missing stop positions automatically interpolated

### Presets
- [x] As a user, I can quickly apply preset gradients from a dropdown (Sunset, Ocean, Rainbow, Fire, Forest, Pastel, Midnight, Gold)
- [x] As a user, I can use presets as starting points and then customize them

### Linear Gradient Controls
- [x] As a user, I can set the angle via a slider or numeric input synchronized together
- [x] As a user, I can import "to <direction>" syntax and have it converted to degrees

### Radial Gradient Controls
- [x] As a user, I can choose between ellipse and circle shapes
- [x] As a user, I can choose a size keyword (farthest-corner, closest-corner, farthest-side, closest-side)
- [x] As a user, I can choose a position (center, top, bottom, left, right, and all corners)

### Conic Gradient Controls
- [x] As a user, I can set the starting angle via a slider or numeric input
- [x] As a user, I can choose a position for the conic gradient center

### User Interface
- [x] As a user, I can see the gradient type highlighted in the tab bar
- [x] As a user, I can see the Remove button disabled when only 2 stops remain
- [x] As a user, I can see the import mode toggle between Paste CSS and Apply states

### Aspirational Features
- [ ] As a user, I want to undo and redo changes to the gradient
- [ ] As a user, I want to save and load custom gradient presets to a personal library
- [ ] As a user, I want to generate gradients from an uploaded image's dominant colors
- [ ] As a user, I want to set per-stop opacity/alpha values
- [ ] As a user, I want to see the gradient applied to different preview shapes (text, button, card)
- [ ] As a user, I want to export the gradient as an SVG definition
- [ ] As a user, I want to see a color wheel visualization for selecting stop colors
- [ ] As a user, I want to reverse the order of all color stops
`})();
