;(function(){window.__visionMd=`# Display Properties

A comprehensive system settings dialog for the »SynthelicZ« desktop -- modeled after the classic Windows "Display Properties" control panel with tabs for themes, appearance (skins), desktop backgrounds, pointer effects, and taskbar configuration.

## Product Requirements

### Purpose
Display Properties is the central configuration hub for the »SynthelicZ« desktop, allowing users to personalize every visual aspect of their environment. It provides a single, familiar interface for changing skins, backgrounds, cursor effects, and taskbar behavior -- making the desktop truly customizable.

### Key Capabilities
- Theme presets for one-click desktop-wide visual changes
- Skin (appearance) selection with live preview, sub-skin variants, and font information
- Desktop background management with multiple position modes and custom image upload
- Pointer effect configuration (cursor shadow, cursor trails with adjustable length)
- Taskbar and Start menu behavior settings (auto-hide, grouping, clock, transition effects)
- Apply/OK/Cancel workflow with real-time preview and PostMessage-based system integration
- Tab-based navigation across five configuration categories

### Design Reference
Modeled after the Windows XP "Display Properties" dialog (accessed via right-click desktop > Properties), which uses a tabbed interface for Themes, Desktop, Screen Saver, Appearance, and Settings -- adapted here with a Pointers and Taskbar tab instead of Screen Saver and Settings.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Themes Tab

- [x] As a user, I can see a list of predefined theme presets (»SynthelicZ« Default, Classic, Aquarium, Nature)
- [x] As a user, I can click a theme to select it and see a live preview
- [x] As a user, I can see color swatches for each theme showing the title bar gradient, window, and button face colors
- [x] As a user, I can see theme name and description next to each swatch
- [x] As a user, I can see a preview monitor showing how the selected theme looks (title bar, window, taskbar, start button)

### Appearance Tab

- [x] As a user, I can see a list of all available skins with color swatch indicators
- [x] As a user, I can click a skin to select it and see a live preview
- [x] As a user, I can see the selected skin highlighted and auto-scrolled into view
- [x] As a user, I can see a preview monitor showing active and inactive title bars, window content, menu bar, taskbar, and start button
- [x] As a user, I can see the skin's font information (family, height, weight) displayed
- [x] As a user, I can select a color scheme (sub-skin) from a dropdown when the chosen skin supports multiple color variants
- [x] As a user, I can see the preview update dynamically when changing sub-skins

### Desktop Tab

- [x] As a user, I can see a list of available background images (system and user-uploaded)
- [x] As a user, I can select "(None)" to remove the desktop background
- [x] As a user, I can select a background and see a preview in the mini monitor
- [x] As a user, I can choose a position mode: Stretch, Fit, Fill, Center, or Tile
- [x] As a user, I can see the preview update to reflect the selected position mode
- [x] As a user, I can click "Browse..." to upload a custom background image from my local machine
- [x] As a user, I can see custom uploaded backgrounds added to the selection list
- [x] As a user, I can see user pictures from the VFS (/user/pictures) merged into the background list

### Pointers Tab

- [x] As a user, I can enable or disable a mouse cursor shadow effect
- [x] As a user, I can enable or disable mouse cursor trails
- [x] As a user, I can adjust the trail length with a slider (3 to 10)
- [x] As a user, I can see the current trail length value displayed next to the slider
- [x] As a user, I can see the trail options greyed out when trails are disabled
- [x] As a user, I can preview cursor effects in a dedicated preview area by moving my pointer
- [x] As a user, I can see the shadow and trail disappear when the pointer leaves the preview area

### Taskbar Tab

- [x] As a user, I can toggle "Lock the taskbar" setting
- [x] As a user, I can toggle "Auto-hide the taskbar" setting
- [x] As a user, I can toggle "Group similar taskbar buttons" setting
- [x] As a user, I can toggle "Show the clock" in the taskbar
- [x] As a user, I can toggle "Use transition effects for windows when minimizing and maximizing"
- [x] As a user, I can toggle "Use small icons in Start menu"
- [x] As a user, I can toggle "Show Run command" in the Start menu
- [x] As a user, I can click "Clear Recently Used Programs" to reset the MRU list

### Apply/OK/Cancel

- [x] As a user, I can click "Apply" to apply all changes without closing the dialog
- [x] As a user, I can click "OK" to apply changes and close the dialog
- [x] As a user, I can click "Cancel" to discard changes and close the dialog
- [x] As a user, I can see the dialog open to a specific tab via command-line parameter

### Tab Navigation

- [x] As a user, I can switch between Themes, Appearance, Desktop, Pointers, and Taskbar tabs
- [x] As a user, I can see the active tab visually highlighted

### System Integration

- [x] As a user, I can see settings fetched from the parent desktop environment on load
- [x] As a user, I can see skin changes sent to the parent via PostMessage
- [x] As a user, I can see background changes sent to the parent via PostMessage
- [x] As a user, I can see cursor settings sent to the parent in real-time as I change them
- [x] As a user, I can see themed visual styles matching the current desktop skin

### Aspirational Features

- [ ] As a user, I can see a "Screen Saver" tab for configuring idle screen savers
- [ ] As a user, I can see a "Sounds" tab for configuring system sound events
- [ ] As a user, I can drag and drop an image file onto the desktop preview to set it as background
- [ ] As a user, I can set a solid background color instead of an image
- [ ] As a user, I can preview the full desktop before applying changes
- [ ] As a user, I can import and export theme/skin configuration files
- [ ] As a user, I can adjust individual system colors in the Appearance tab
- [ ] As a user, I can see a cursor scheme selector in the Pointers tab
`})();
