# Display Tester

## Purpose

Comprehensive display and monitor testing tool with 51+ test patterns across 8 categories. Helps users evaluate display quality, calibrate settings, and diagnose issues like dead pixels, backlight bleed, color accuracy, and geometry problems.

## How It Works

Presents a categorized test selector. Each test renders a full-area pattern on either a 2D canvas or WebGL canvas. Some tests include interactive controls (sliders, selectors). Tests support fullscreen mode for accurate evaluation. An FPS counter and resolution/DPR info are shown in the status bar.

## Architecture

- **`index.html`** -- Toolbar, test selector grid, test area with canvas overlays, status bar
- **`controller.js`** -- IIFE with test registry, canvas/WebGL rendering functions, interactive controls, fullscreen management
- **`styles.css`** -- Layout for selector grid, test overlay, toolbar, and status bar

## Features

### Test Categories

#### Dead Pixel Tests (6)
- Solid Red, Green, Blue, White, Black, and Cyan screens
- Full-screen solid colors to reveal stuck or dead pixels

#### Color Tests (7)
- **RGB Gradient** -- Smooth gradient across all RGB channels
- **Grayscale** -- Full black-to-white gradient
- **Color Checker** -- Reference color patch grid (like X-Rite ColorChecker)
- **Gamma Test** -- Gamma accuracy verification pattern
- **Color Bleed** -- Sharp color transitions to detect bleed between adjacent areas
- **Banding Detection** -- Subtle gradient to reveal color banding artifacts
- **Dithering Detection** -- Patterns to expose temporal or spatial dithering

#### Uniformity Tests (6)
- **White Uniformity** -- Full white screen for brightness evenness
- **Low Gray Uniformity** -- Dark gray screen for shadow uniformity
- **5-Point Brightness** -- Five measurement points for brightness consistency
- **Brightness Sweep** -- Animated brightness sweep across screen
- **Viewing Angle** -- Pattern to test color shift at off-axis viewing angles
- **Burn-in / Retention** -- Pattern for detecting image retention or burn-in

#### FPS Tests (3)
- **Frame Counter** -- Real-time frame rate display
- **UFO Test** -- Smooth-scrolling object to judge motion clarity
- **VSync Tear** -- Fast-moving bars to detect screen tearing

#### Motion Tests (6)
- **Moving Crosshair** -- Smoothly moving target for pursuit tracking
- **Black/White Flash** -- Alternating frames for response time evaluation
- **Pursuit Camera** -- Camera-simulation test for motion blur assessment
- **Input Lag Flasher** -- Click-to-flash pattern for input lag estimation
- **Gray-to-Gray** -- Transition test for pixel response time
- **Scrolling Text** -- Moving text for readability at speed

#### HDR Tests (4)
- **HDR Gradient** -- Extended range gradient (if HDR display available)
- **HDR Clipping** -- Specular highlight clipping detection
- **Contrast Ratio** -- Simultaneous black/white for contrast measurement
- **Shadow Detail** -- Near-black gradients for shadow visibility

#### Geometry Tests (7)
- **Pixel Grid** -- 1:1 pixel grid to check scaling accuracy
- **Checkerboard** -- Alternating pixel pattern for sharpness
- **Circle & Line** -- Geometric primitives for distortion detection
- **Text Sharpness** -- Various font sizes for text clarity evaluation
- **Aspect Ratio** -- Circle/square test for correct aspect ratio
- **Subpixel Layout** -- RGB stripe patterns to identify subpixel order (RGB vs BGR)
- **Moire Pattern** -- Non-integer pixel grids to reveal aliasing artifacts

#### Calibration Tools (12)
- **Gamma Calibration** -- Adjustable gamma reference with stripe matching
- **RGB Balance** -- Per-channel gain sliders for neutral gray balance
- **Sharpness Pattern** -- Siemens star, line pairs, and zone plate
- **Contrast Calibration** -- Near-black and near-white adjustment patches
- **Brightness Calibration** -- 20 near-black patches for brightness tuning
- **Keystone Grid** -- Full-screen grid with corner circles for projector alignment
- **Overscan Detection** -- Nested colored borders to reveal display overscan
- **Color Temperature** -- Full-screen reference with Kelvin selector
- **Convergence Test** -- RGB crosshair grid for color misconvergence
- **Backlight Bleed** -- Pure black screen for dark-room backlight evaluation
- **Screen Ruler** -- Physical measurement ruler with credit-card reference for DPI calibration
- **Pixel Clock / Phase** -- Fine stripe patterns for analog display adjustment

### UI Features
- Categorized test selector with card grid
- Toggleable test descriptions
- Toolbar with Back, Fullscreen, and info display
- Status bar with test name, resolution, DPR, and FPS
- Per-test interactive controls (gamma slider, RGB sliders, Kelvin selector, etc.)
- Fullscreen support for accurate testing

### Integration
- SZ OS window management
- Responsive canvas sizing via ResizeObserver

## User Stories

- [x] As a user, I want to check for dead pixels by displaying solid colors so I can identify stuck pixels
- [x] As a user, I want to test color accuracy with a color checker pattern so I can verify my display's color reproduction
- [x] As a user, I want to detect color banding in gradients so I can evaluate bit depth
- [x] As a user, I want to measure brightness uniformity so I can check for uneven backlighting
- [x] As a user, I want to see my frame rate so I can verify my display's refresh rate
- [x] As a user, I want a UFO test so I can judge motion clarity and response time
- [x] As a user, I want to detect screen tearing so I can verify VSync is working
- [x] As a user, I want to calibrate gamma using a reference pattern so I can set correct gamma
- [x] As a user, I want RGB balance sliders so I can check neutral gray accuracy
- [x] As a user, I want a sharpness test pattern so I can tune display sharpness settings
- [x] As a user, I want to check for backlight bleed in a dark room so I can evaluate panel quality
- [x] As a user, I want to identify my subpixel layout (RGB/BGR) so I can configure ClearType correctly
- [x] As a user, I want to enter fullscreen so I can test without window chrome interference
- [x] As a user, I want overscan detection so I can check if my TV is cutting off edges
- [x] As a user, I want a screen ruler with credit card reference so I can determine my display's actual DPI
- [x] As a user, I want all tests categorized so I can quickly find the one I need
