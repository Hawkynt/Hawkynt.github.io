# Cookie Banner Generator

A visual cookie consent banner designer with live preview on a simulated webpage. Part of the SynthelicZ desktop environment.

## Purpose

Design and export fully functional cookie consent banners without writing code. The app renders a live preview on a simulated webpage and generates clean, self-contained HTML+CSS+JS ready to paste into any site.

## How It Works

1. Choose a compliance mode (GDPR, CCPA, ePrivacy, Minimal) to set up text, buttons, and cookie categories
2. Pick a design preset or customize colors, spacing, shadows, and animations
3. Preview the banner at different positions, on desktop/mobile viewports, against light/dark backgrounds
4. Manage cookie categories with names, descriptions, and required flags
5. Check WCAG contrast ratios in real time
6. Copy or download the generated code

## Features

- [x] Live banner preview on simulated webpage with CSS-only placeholder content
- [x] 5 banner positions: bottom bar, top bar, center modal, bottom-left corner, bottom-right corner
- [x] Text customization: heading, body, button labels, privacy link text/URL
- [x] Show/hide reject and settings buttons
- [x] 7 color controls with paired color picker + hex input
- [x] Style controls: border radius, font size, padding, max-width (range sliders)
- [x] Shadow (none/light/medium/heavy) and backdrop (none/dim/blur)
- [x] 4 animations: slide-up, fade-in, scale-up, none (with replay)
- [x] 8 design presets: Minimal Clean, Material, Glassmorphism, Dark Elegant, Corporate Blue, Warm Toast, Neon Accent, Retro Pixel
- [x] 4 compliance presets: GDPR, CCPA, ePrivacy, Minimal
- [x] Cookie category editor: add/remove categories with name, description, required flag
- [x] WCAG 2.1 contrast ratio checker (AAA/AA/AA Large/FAIL badge)
- [x] Desktop/mobile toggle (full-width or 375px)
- [x] Light/dark page toggle for testing banner appearance
- [x] Custom CSS injection textarea
- [x] Code export with syntax highlighting (Combined/HTML/CSS/JS sub-tabs)
- [x] Clipboard copy and .html file download
- [x] Generated JS: localStorage consent storage, cookieConsent CustomEvent dispatch
- [x] State persistence via localStorage
- [x] URL hash sharing
- [x] F1 shortcut for About dialog
- [x] Draggable splitter between preview and options panel

## Planned Features

- [ ] Import existing banner HTML to edit
- [ ] Additional animation options (bounce, elastic)
- [ ] RTL language support preview
- [ ] Cookie consent analytics dashboard template

## Known Limitations

- The color picker `<input type="color">` does not support alpha/transparency values; semi-transparent colors (like Glassmorphism preset) must be entered as hex text manually
- Generated code uses ES5-compatible JavaScript for broad compatibility
- Syntax highlighting is regex-based and approximate (not a full parser)

## Architecture

Single-page browser app following SZ conventions:

- `index.html` -- Layout with menu bar, toolbar, preview area, splitter, tabbed options panel
- `styles.css` -- Themed CSS using `var(--sz-color-*)` custom properties
- `controller.js` -- IIFE with state management, live preview, code generation, presets, accessibility checker
- `icon.svg` -- Cookie + checkmark app icon

No build step. Works offline from `file://`.
