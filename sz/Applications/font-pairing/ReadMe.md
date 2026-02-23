# Font Pairing Tool

## Purpose

Typography exploration tool for discovering complementary font pairs. Features 42 Google Fonts across 5 categories, 25 curated pairings, live preview with adjustable typography settings, and CSS/HTML export.

## How It Works

Loads Google Fonts dynamically via the Google Fonts API. Users select heading and body fonts from dropdowns, browse curated pairs in a categorized sidebar, and preview the combination with editable sample text. Typography settings (size, weight, line-height, letter-spacing) are adjustable via ribbon sliders. Dark mode toggle for contrast testing.

## Architecture

- **`index.html`** -- Ribbon UI (Home/Typography/View tabs), curated pairs sidebar, contenteditable preview area, about dialog
- **`controller.js`** -- IIFE with font registry, curated pair definitions, Google Fonts loading, state management, CSS/HTML generation, clipboard operations
- **`styles.css`** -- Split layout, sidebar, preview area, weight samples
- **Shared modules** -- `ribbon.js`, `dialog.js`

## Features

### Font Collection (42 fonts)
- **Serif**: Playfair Display, Merriweather, Lora, Libre Baskerville, Cormorant Garamond, EB Garamond, Crimson Text, Source Serif 4
- **Sans-serif**: Montserrat, Open Sans, Raleway, Roboto, Poppins, Inter, Work Sans, Nunito, DM Sans, Source Sans 3, Outfit, Manrope, Plus Jakarta Sans, Figtree
- **Monospace**: JetBrains Mono, Fira Code, Source Code Pro, IBM Plex Mono, Space Mono
- **Display**: Abril Fatface, Bebas Neue, Oswald, Anton, Righteous
- **Handwriting**: Dancing Script, Pacifico, Caveat, Satisfy, Great Vibes, Lobster, Sacramento

### Curated Pairs (25 across 5 categories)
- **Classic** -- Traditional serif + sans combinations (e.g., Playfair Display / Source Sans 3)
- **Modern** -- Contemporary sans + sans pairings (e.g., Montserrat / Open Sans)
- **Playful** -- Display/handwriting + sans combinations (e.g., Pacifico / Raleway)
- **Technical** -- Monospace + sans pairings (e.g., JetBrains Mono / Inter)
- **Elegant** -- Refined serif combinations (e.g., Cormorant Garamond / Poppins)

### Typography Controls
- Heading font selector and body font selector
- Heading weight: Regular (400), Medium (500), Bold (700)
- Heading size: 16-72px (slider)
- Body size: 12-24px (slider)
- Line height: 1.0-2.5 (slider)
- Letter spacing: -2px to 5px (slider)

### Preview
- Contenteditable heading and body text areas for custom sample text
- Dark/light mode toggle for contrast testing
- Weight sample strips (Regular 400, Medium 500, Bold 700) with toggle
- Live font application with Google Fonts dynamic loading

### Export
- **Copy CSS** -- Generates @import URL + CSS declarations for heading and body fonts
- **Copy HTML** -- Generates Google Fonts `<link>` tag + HTML sample with inline styles
- Clipboard API with execCommand fallback

### Actions
- **Shuffle** -- Randomly selects a complementary pair from curated list
- **Swap** -- Swaps heading and body fonts

### Integration
- Ribbon UI with Home, Typography, and View tabs
- Quick Access Toolbar with Copy CSS and Copy HTML buttons
- File backstage menu
- SZ OS window management (close via menu)
- About dialog

## User Stories

- [x] As a designer, I want to browse curated font pairs so I can quickly find complementary typography
- [x] As a designer, I want to filter curated pairs by category (Classic, Modern, etc.) so I can find pairs matching my project's tone
- [x] As a designer, I want to select any heading and body font independently so I can create custom combinations
- [x] As a designer, I want to adjust heading and body font sizes so I can see how the pair works at different scales
- [x] As a designer, I want to control line height and letter spacing so I can fine-tune readability
- [x] As a designer, I want to choose heading font weight so I can see how different weights look
- [x] As a designer, I want to edit the preview text so I can test with my actual content
- [x] As a designer, I want to toggle dark mode so I can see how the fonts look on dark backgrounds
- [x] As a designer, I want to see weight samples so I can evaluate the font across multiple weights
- [x] As a designer, I want to shuffle for a random pair so I can discover combinations I wouldn't have tried
- [x] As a designer, I want to swap heading and body fonts so I can quickly try the reverse combination
- [x] As a designer, I want to copy CSS with @import so I can paste it directly into my stylesheet
- [x] As a designer, I want to copy HTML with link tags so I can use the fonts in an HTML page
