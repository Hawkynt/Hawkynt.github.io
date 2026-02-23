# Color Picker

A comprehensive color picker for »SynthelicZ« offering multiple color model views (RGB, HSL, HSV, CMYK), interactive canvas-based selection areas, a color wheel mode, alpha channel support, an eyedropper tool, and a customizable palette.

## Product Requirements

### Purpose
Color Picker provides a full-featured color selection and conversion tool within the »SynthelicZ« desktop. It serves both as a standalone utility for designers and developers who need to pick, convert, and copy color values, and as a system dialog that other applications can invoke to let users choose colors.

### Key Capabilities
- Four visual picker modes tied to color model tabs: SV canvas with hue bar (RGB), hue wheel with lightness triangle (HSL), hue wheel with saturation-value square (HSV), and hue-saturation disc with key/black slider (CMYK)
- Four color model tabs (RGB, HSL, HSV, CMYK) with synchronized sliders and numeric inputs
- Alpha channel control with transparent-aware hex (#RRGGBBAA) and CSS (rgba()) output
- Hex and CSS value display with one-click copy to clipboard and direct hex input
- Eyedropper tool using the browser EyeDropper API for picking colors from anywhere on screen
- Customizable palette with 32 predefined basic colors and up to 16 user-saved custom colors persisted in localStorage
- Command line integration for launching with a pre-selected color and returning the chosen color to a calling application

### Design Reference
Modeled after the Windows system color picker dialog and Adobe-style color chooser, combining a visual canvas/wheel selector with precise numeric inputs across multiple color models.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Color Selection - SV Canvas Mode
- [x] As a user, I can pick a color by clicking or dragging on the saturation-value canvas
- [x] As a user, I can select the hue by clicking or dragging on the vertical hue bar
- [x] As a user, I can adjust the alpha/opacity by clicking or dragging on the vertical alpha bar
- [x] As a user, I can see a cursor indicator tracking my selection on the SV canvas
- [x] As a user, I can see slider indicators on the hue and alpha bars

### Color Selection - HSL Wheel Mode
- [x] As a user, I can pick hue and saturation on a circular color wheel with an inner triangle showing lightness gradients
- [x] As a user, I can adjust lightness on a vertical slider beside the wheel
- [x] As a user, I can adjust alpha on a separate vertical slider in wheel mode
- [x] As a user, I can see cursor and slider indicators update in real time on the wheel
- [x] As a user, I see the HSL wheel mode automatically activate when I switch to the HSL tab

### Color Selection - HSV Wheel Mode
- [x] As a user, I can pick hue on a circular color wheel with an inner inscribed square for saturation and value
- [x] As a user, I can adjust value on a vertical slider beside the wheel
- [x] As a user, I see the HSV wheel mode automatically activate when I switch to the HSV tab

### Color Selection - CMYK Disc Mode
- [x] As a user, I can pick hue and saturation on a filled color disc where angle represents hue and distance from center represents saturation
- [x] As a user, I can adjust the key/black channel on a vertical slider beside the disc
- [x] As a user, I see the CMYK disc mode automatically activate when I switch to the CMYK tab

### Color Models
- [x] As a user, I can adjust RGB values (0-255) using sliders and numeric inputs
- [x] As a user, I can adjust HSL values (H: 0-360, S: 0-100, L: 0-100) using sliders and numeric inputs
- [x] As a user, I can adjust HSV values (H: 0-360, S: 0-100, V: 0-100) using sliders and numeric inputs
- [x] As a user, I can adjust CMYK values (0-100 each) using sliders and numeric inputs
- [x] As a user, I can see all color model values update simultaneously when I change any value
- [x] As a user, I can switch between color model tabs (RGB, HSL, HSV, CMYK)

### Alpha Channel
- [x] As a user, I can adjust the alpha value from 0% to 100% using a slider and numeric input
- [x] As a user, I can see alpha reflected in the hex output (8-digit hex for non-opaque colors)
- [x] As a user, I can see alpha reflected in the CSS output (rgba() for non-opaque colors)

### Hex and CSS Input/Output
- [x] As a user, I can see the current color as a hex value (#RRGGBB or #RRGGBBAA)
- [x] As a user, I can type a hex value to set the color
- [x] As a user, I can see the current color as a CSS rgb()/rgba() string
- [x] As a user, I can copy the hex value to clipboard with a Copy button
- [x] As a user, I can copy the CSS value to clipboard with a Copy button
- [x] As a user, I can enter 3-digit, 4-digit, 6-digit, or 8-digit hex values

### Float Values
- [x] As a user, I can see the current color as normalized float values (0.0 to 1.0) for R, G, B, and A

### Preview
- [x] As a user, I can see a "New" preview swatch showing the currently selected color
- [x] As a user, I can see a "Current" preview swatch showing the previously set color
- [x] As a user, I can see a checkerboard pattern behind swatches to indicate transparency

### Eyedropper
- [x] As a user, I can use the EyeDropper API (where supported) to pick a color from anywhere on screen
- [x] As a user, I can select a sample diameter (1px to 101px) for circle averaging when picking colors
- [x] As a user, I can use circle sampling mode to average colors over a circular region on screen
- [x] As a user, I see a fallback prompt when the EyeDropper API is not available

### Color Palette
- [x] As a user, I can select from 32 predefined basic colors by clicking palette swatches
- [x] As a user, I can add the current color to a custom color palette (up to 16 colors)
- [x] As a user, I can see custom colors persisted in localStorage between sessions
- [x] As a user, I can click a custom palette swatch to recall that color
- [x] As a user, I see the oldest custom color removed when the palette is full and a new one is added

### Set as Current / Return Value
- [x] As a user, I can click "Set as Current" to update the current/old color swatch
- [x] As a user, I can use the color picker as a dialog that returns a chosen color to the calling application

### Command Line Integration
- [x] As a user, I can launch the color picker with a pre-selected color via command line hex parameter
- [x] As a user, I can see the color picker emit the chosen color back to a requester via localStorage

### Responsive Design
- [x] As a user, I can see the canvases and cursors update correctly when the window is resized

### Future Enhancements
- [ ] As a user, I want to see named CSS colors in a searchable list
- [ ] As a user, I want color harmony suggestions (complementary, analogous, triadic)
- [ ] As a user, I want to generate a gradient between two selected colors
- [ ] As a user, I want to see WCAG contrast ratio analysis between two colors
- [ ] As a user, I want to import and export palette files
- [ ] As a user, I want to see the color rendered in different color blindness simulation modes
- [ ] As a user, I want a history of recently used colors
