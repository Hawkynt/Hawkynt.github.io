# QR Code Generator

A full-featured QR code generation tool built from scratch within the »SynthelicZ« desktop, with a complete QR encoder supporting versions 1-40, multiple input types, customizable rendering styles, logo overlay, and multi-format export.

## Product Requirements

### Purpose
The QR Code Generator provides a local, offline-capable QR code creation tool within the »SynthelicZ« desktop, allowing users to encode text, URLs, WiFi credentials, contact cards, emails, and phone numbers into QR codes with full control over appearance and error correction. It eliminates the need for external QR generation services by implementing the entire QR encoding pipeline from scratch in JavaScript.

### Key Capabilities
- Multiple input types: plain text, URL, WiFi network, vCard contact, email, and phone number
- Full QR encoding engine supporting versions 1-40 with Numeric, Alphanumeric, and Byte modes
- Selectable error correction levels (L/M/Q/H) with auto-upgrade to H when a logo is present
- Visual customization: foreground/background colors, module styles (Square, Rounded, Dots, Diamond), size, and quiet zone
- Logo overlay with adjustable size, white border, and automatic high error correction
- Multi-format export: PNG at multiple resolutions (256-2048px), SVG with embedded logos, and clipboard copy
- Real-time preview with debounced regeneration as settings change

### Design Reference
Inspired by online QR generators like QRCode Monkey and the built-in QR features of mobile OS settings apps, presenting a two-panel layout with input controls on the left and a live QR code preview on the right.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Input Types
- [x] As a user, I can generate a QR code from plain text
- [x] As a user, I can generate a QR code from a URL
- [x] As a user, I can generate a QR code for a WiFi network (SSID, password, encryption type)
- [x] As a user, I can generate a QR code for a vCard contact (name, phone, email, address)
- [x] As a user, I can generate a QR code for an email (address, subject, body)
- [x] As a user, I can generate a QR code for a phone number
- [x] As a user, I can switch between input types and see the form fields update dynamically
- [ ] As a user, I can generate a QR code for an SMS message
- [ ] As a user, I can generate a QR code for a calendar event (iCal)
- [ ] As a user, I can generate a QR code for geographic coordinates (geo: URI)

### QR Encoding
- [x] As a user, I can see the encoding mode auto-detected (Numeric, Alphanumeric, Byte)
- [x] As a user, I can force uppercase mode for alphanumeric encoding
- [x] As a user, I can force byte encoding mode
- [x] As a user, I can select the error correction level (L 7%, M 15%, Q 25%, H 30%)
- [x] As a user, I can select a specific QR version (1-40) or let it auto-detect
- [x] As a user, I can see version details in the dropdown (e.g., "Version 5 (37x37)")
- [x] As a user, I can see the QR code regenerate in real time as I type
- [x] As a user, I can see an error message when the data is too large for the selected version
- [x] As a user, I can see EC level auto-upgraded to H when a logo is present
- [ ] As a user, I can see the maximum data capacity for the current version/EC level

### Customization
- [x] As a user, I can change the foreground (dark module) color
- [x] As a user, I can change the background color
- [x] As a user, I can choose between module styles: Square, Rounded, Dots, Diamond
- [x] As a user, I can adjust the module pixel size (1-20px)
- [x] As a user, I can adjust the quiet zone size (0-10 modules)
- [ ] As a user, I can set different colors for finder patterns vs data modules
- [ ] As a user, I can apply a gradient to the foreground color
- [ ] As a user, I can set the background to transparent

### Logo Overlay
- [x] As a user, I can upload a logo image to overlay on the QR code center
- [x] As a user, I can see a preview of the uploaded logo
- [x] As a user, I can adjust the logo size with a slider (10-25% of QR code)
- [x] As a user, I can see the logo displayed with a white border for readability
- [x] As a user, I can clear the logo to remove it
- [x] As a user, I can see the error correction level automatically set to H when a logo is added
- [ ] As a user, I can set the logo border color to match the background
- [ ] As a user, I can set the logo shape (square, rounded, circle)

### QR Code Information
- [x] As a user, I can see QR code details: version, matrix size, EC level, encoding mode, and mask pattern
- [x] As a user, I can see when EC level is forced to H due to logo presence
- [ ] As a user, I can see the data capacity usage (bytes used vs maximum)

### Export
- [x] As a user, I can save the QR code as a PNG image at multiple resolutions (256, 512, 1024, 2048)
- [x] As a user, I can save the QR code as an SVG file
- [x] As a user, I can copy the QR code to the clipboard as a PNG image
- [x] As a user, I can see the SVG export include the logo as an embedded data URI
- [x] As a user, I can see the PNG export dropdown with preset size options
- [ ] As a user, I can save the QR code as a PDF
- [ ] As a user, I can batch-generate multiple QR codes from a CSV file

### Preview
- [x] As a user, I can see a live preview of the QR code on a canvas
- [x] As a user, I can see the preview update in real time with debounced generation (80ms)
- [x] As a user, I can see a placeholder message when no content is entered
- [x] As a user, I can see the preview resize with the window
- [ ] As a user, I can zoom in on the preview to inspect individual modules
- [ ] As a user, I can scan the displayed QR code with my phone's camera and verify it works

### User Interface
- [x] As a user, I can see a two-panel layout with input fields on the left and preview on the right
- [x] As a user, I can see a bottom toolbar with export buttons
- [x] As a user, I can see the app start with a default URL example
- [x] As a user, I can see system visual styles applied to the app
- [ ] As a user, I can see a history of recently generated QR codes
- [ ] As a user, I can switch between light and dark UI themes
