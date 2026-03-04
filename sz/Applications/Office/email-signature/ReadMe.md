# Email Signature Generator

## Purpose

Professional email signature generator with 4 HTML templates, photo upload, social media icon integration, and live preview in a mock email interface. Outputs table-based inline-styled HTML compatible with all major email clients.

## How It Works

A split-pane interface with a form panel on the left (personal info, contact details, photo, social links, accent color) and a live preview on the right rendered inside a mock email chrome. Signatures use HTML tables with inline styles for maximum email client compatibility. Social icons are loaded from the Simple Icons CDN.

## Architecture

- **`index.html`** -- Ribbon UI (Home/Template/View tabs), Quick Access Toolbar, backstage menu, form panel, splitter, preview panel, about dialog
- **`controller.js`** -- IIFE with form data gathering, 4 template generators (table-based HTML), photo handling, clipboard operations, SZ OS integration
- **`styles.css`** -- Split-pane layout, form styling, preview mock email chrome, photo area
- **Shared modules** -- `ribbon.js`, `dialog.js`

## Features

### Templates
- **Classic Horizontal** -- Left-aligned with accent-colored vertical divider, photo on left
- **Modern Vertical** -- Center-aligned with photo, horizontal divider, contact info below
- **Compact Minimal** -- Single-line layout with photo thumbnail, all info condensed
- **Bold with Banner** -- Colored header banner with photo, white contact section below

### Personal Information
- Name, job title, company, department fields
- All fields optional -- signature adapts to what's filled in

### Contact Details
- Email (with mailto: link)
- Phone (with tel: link, auto-strips formatting)
- Mobile (with tel: link)
- Website (auto-prepends https:// if needed)

### Photo
- Upload via file browser, drag-and-drop, or SZ VFS file picker
- Live photo preview with selected frame shape
- 7 frame shapes: Circle, Square, Rounded, Hexagon, Hexagon (flat), Diamond, Octagon
- Implemented via CSS clip-path for exotic shapes
- Remove photo button
- Photo embedded as base64 data URL

### Social Media (14 platforms)
- LinkedIn, Twitter/X, GitHub, Instagram, Facebook, YouTube
- Mastodon, Discord, Stack Overflow, Dribbble, Behance, Medium, Twitch, TikTok
- Icons loaded from Simple Icons CDN with configurable color
- Toggle social icon visibility from View tab

### Accent Color
- Color picker integrated with SZ Desktop color-picker app
- Manual hex input with validation
- Accent color used in template dividers, name, links, and banner

### Export Options
- **Copy HTML** -- Copies table-based HTML to clipboard (with text/html MIME type)
- **Copy Text** -- Copies plain-text version to clipboard
- **Export HTML** -- Downloads or saves complete HTML document via SZ VFS or browser download
- Clipboard fallback for environments without Clipboard API

### UI Features
- Ribbon UI with Home, Template, and View tabs
- Quick Access Toolbar with Copy HTML and Copy Text buttons
- File backstage menu (Copy CSS, Copy HTML, About, Exit)
- Template selection via ribbon radio buttons or form dropdown
- Resizable split pane with draggable splitter (pointer capture)
- Live preview updates on every input change
- Mock email interface with From field

### Integration
- SZ OS window management (close via menu)
- SZ Desktop color-picker app integration via postMessage/localStorage
- SZ VFS file picker for photo browsing (ComDlg32.GetOpenFileName)
- SZ VFS file export (ComDlg32.ExportFile)
- Visual styles injection

## User Stories

- [x] As a user, I want to fill in my personal details so they appear in my email signature
- [x] As a user, I want to choose from multiple signature templates so I can pick a style that matches my brand
- [x] As a user, I want to upload a photo so my signature includes my headshot
- [x] As a user, I want to choose a photo frame shape (circle, hexagon, etc.) so my photo looks distinctive
- [x] As a user, I want to drag and drop a photo so uploading is easy
- [x] As a user, I want to add social media links so recipients can find me online
- [x] As a user, I want social media icons to appear automatically so links are visually recognizable
- [x] As a user, I want to customize the accent color so the signature matches my brand colors
- [x] As a user, I want to see a live preview in a mock email so I know exactly how it will look
- [x] As a user, I want to copy the HTML signature to clipboard so I can paste it into my email client settings
- [x] As a user, I want a plain-text version so I can use it in text-only contexts
- [x] As a user, I want to export as an HTML file so I can save it for later
- [x] As a user, I want the signature to use inline styles and tables so it works in all email clients
- [x] As a user, I want to toggle social icon visibility so I can show or hide them as needed
- [x] As a user, I want to toggle photo visibility so I can include or exclude it
- [x] As a user, I want to reset all fields so I can start fresh
