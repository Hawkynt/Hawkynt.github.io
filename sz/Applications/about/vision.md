# About »SynthelicZ«

The system "About" dialog for the »SynthelicZ« desktop environment -- a compact informational window that displays the project name, version, description, and copyright notice, similar to the classic "About Windows" dialog.

## Product Requirements

### Purpose
The About dialog provides users with essential information about the »SynthelicZ« desktop environment, including its version, origin story, and copyright. It serves as the standard system identification point, letting users quickly verify which version they are running and learn about the project's history.

### Key Capabilities
- Display of the project name and branding
- Version number and copyright notice
- Historical context (original creation dates and author)
- Description of the project as a browser-based desktop environment
- Clean, minimal dialog layout with themed styling

### Design Reference
Modeled after the classic "About Windows" dialog (winver.exe) found in Windows XP and earlier, which displays the OS name, version, copyright, and licensing information in a compact, non-resizable window.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Core Information

- [x] As a user, I can see the project name "SynthelicZ Desktop" prominently displayed
- [x] As a user, I can see that SynthelicZ is described as a browser-based desktop environment simulator
- [x] As a user, I can see the original creation dates (2004-2006) and author (Hawkynt)
- [x] As a user, I can see that it was rewritten with modern web technologies
- [x] As a user, I can see the current version number (Version 6.0)
- [x] As a user, I can see the copyright notice with year range (1995-2026)
- [x] As a user, I can see themed visual styles matching the current desktop skin

### User Interface

- [x] As a user, I can see a clean, minimal dialog layout with a heading, description, and version line
- [x] As a user, I can see a horizontal divider separating the description from the version info
- [ ] As a user, I can see the SynthelicZ logo or icon displayed in the dialog
- [ ] As a user, I can click an "OK" button to close the dialog
- [ ] As a user, I can see system information such as available memory and display resolution
- [ ] As a user, I can see the current skin name and theme displayed
- [ ] As a user, I can click a link to open the SynthelicZ website (hawkynt.github.io/sz)
- [ ] As a user, I can see the browser and platform information
- [ ] As a user, I can see a list of credits or acknowledgments
- [ ] As a user, I can see a "License" or "Terms" section describing the project license
- [ ] As a user, I can see an animated or branded visual element that matches the desktop aesthetic
- [ ] As a user, I can copy the version and system info to clipboard
- [ ] As a user, I can press Escape or Enter to close the dialog
