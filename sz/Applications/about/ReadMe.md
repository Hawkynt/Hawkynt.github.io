# About »SynthelicZ«

The system "About" dialog for the »SynthelicZ« desktop environment -- a compact, tabbed informational window that displays the project name, version, description, data-privacy notice, system details, credits, and copyright, similar to the classic "About Windows" dialog.

## Product Requirements

### Purpose

The About dialog provides users with essential information about the »SynthelicZ« desktop environment, including its version, origin story, copyright, licensing terms, and a clear explanation of how user data is stored. It serves as the standard system identification point, letting users quickly verify which version they are running, learn about the project's history and inspirations, and understand that all data lives exclusively in the browser's local storage — meaning users can keep their files, settings, and application data between sessions as long as the same browser is used, but this data is tied to the current browser and domain: clearing browser data, using incognito/private mode, or switching to a different browser will permanently erase all saved content. The dialog also communicates that the project is free for personal and educational use, welcomes donations, and requires a license for commercial or corporate deployment.

### Key Capabilities

- Display of the project name and branding with logo
- Version number and copyright notice
- Historical context (original creation dates and author)
- Description of the project as a browser-based desktop environment
- Clear data-privacy notice explaining that all user data stays in the browser and may be lost
- Tabbed layout: General, System, Credits, What's New (changelog)
- System information panel (resolution, memory, browser, platform, skin, color depth, language, storage usage)
- Credits listing with author and third-party inspirations (TidyTabs, AquaSnap, Winamp, Stardock)
- License section: free for personal/educational use, contact for commercial licensing and PID
- Donation appeal to support continued development
- Copy system info to clipboard
- OK button and keyboard shortcuts to close

### Design Reference

Modeled after the classic "About Windows" dialog (winver.exe) found in Windows XP and later, which displays the OS name, version, copyright, and licensing information in a compact, non-resizable window — extended with a tabbed layout for additional system details.

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
- [x] As a user, I can see the current version number (Version 6.8)
- [x] As a user, I can see the copyright notice with year range (1995-2026)
- [x] As a user, I can see themed visual styles matching the current desktop skin

### Data Privacy Notice

- [x] As a user, I can see a prominent notice that all data is stored locally in the browser
- [x] As a user, I can understand that no data is sent to any server
- [x] As a user, I am warned that clearing browser data, using incognito mode, or switching browsers will erase all saved content permanently
- [x] As a user, I can understand that data is tied to this specific browser and domain

### Credits &amp; Acknowledgments

- [x] As a user, I can see the original author (Hawkynt) credited
- [x] As a user, I can click a link to the author's GitHub profile (github.com/Hawkynt)
- [x] As a user, I can see that skins are based on Stardock WindowBlinds / Object Desktop assets
- [x] As a user, I can see that icons are adapted from various open-source icon sets
- [x] As a user, I can see acknowledgments for desktop environment inspirations (Windows XP, Mac OS X, Linux)
- [x] As a user, I can see that window tab grouping was inspired by TidyTabs
- [x] As a user, I can see that window snapping and tiling was inspired by AquaSnap
- [x] As a user, I can see that the media player UI and skin support was inspired by Winamp
- [x] As a user, I can see that the Stardock community is acknowledged for creative skins

### License &amp; Usage

- [x] As a user, I can see that the project is free for educational, personal, and non-commercial use
- [x] As a user, I can see the copyright notice (© 1995–2026 Hawkynt) and that skin assets remain property of their authors
- [x] As a user, I can see a prominent notice about contacting the author for commercial/corporate licensing and product ID (PID)
- [x] As a user, I can see a donation appeal encouraging support for the project
- [x] As a user, I can click the heart icon in the donation notice to open the author's PayPal page

### What's New Tab

- [x] As a user, I can click the "What's New" tab to view the changelog of recent updates to the system
- [x] As a user, I can see changelog entries organized by version number with release dates
- [x] As a user, I can see categorized entries (Added, Fixed, Changed, Removed, Issues) with color-coded emoji prefixes
- [x] As a user, I can see a "No changelog available" message if the changelog is not loaded
- [x] As a user, I can see the What's New tab populated on-demand only when I click it for performance

### Data Storage Details

- [x] As a user, I can see information about mounting local directories from my computer into the virtual file system for persistent storage
- [x] As a user, I can understand the difference between browser storage and mounted local directories

### User Interface

- [x] As a user, I can see a clean, minimal dialog layout with a heading, description, and version line
- [x] As a user, I can see a horizontal divider separating the description from the version info
- [x] As a user, I can see the SynthelicZ logo or icon displayed in the dialog
- [x] As a user, I can see the git commit hash (if available) displayed in the version line
- [x] As a user, I can click an "OK" button to close the dialog
- [x] As a user, I can see system information such as available memory and display resolution
- [x] As a user, I can see the current skin name and theme displayed
- [x] As a user, I can click a link to open the SynthelicZ website (hawkynt.github.io/sz)
- [x] As a user, I can see the browser and platform information
- [x] As a user, I can see an animated or branded visual element that matches the desktop aesthetic
- [x] As a user, I can copy the version and system info to clipboard
- [x] As a user, I can press Escape or Enter to close the dialog

### Advanced

- [x] As a developer, I can pass an `autostart=1` parameter to the About app to automatically display the What's New tab on launch
