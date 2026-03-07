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

### Dead Pixel Tests
- [x] As a user, I can display solid Red, Green, Blue, White, Black, and Cyan screens so that I can reveal stuck or dead pixels

### Color Tests
- [x] As a user, I can view an RGB gradient so that I can check color channel transitions
- [x] As a user, I can view a grayscale gradient so that I can verify black-to-white smoothness
- [x] As a user, I can view a color checker reference grid so that I can verify color accuracy against known patches
- [x] As a user, I can view a gamma test pattern so that I can verify gamma accuracy
- [x] As a user, I can view a color bleed test so that I can detect bleed between adjacent color areas
- [x] As a user, I can view a banding detection gradient so that I can reveal color banding artifacts
- [x] As a user, I can view a dithering detection pattern so that I can expose temporal or spatial dithering

### Uniformity Tests
- [x] As a user, I can display a full white screen so that I can check brightness evenness
- [x] As a user, I can display a low gray screen so that I can check shadow uniformity
- [x] As a user, I can see 5-point brightness measurement points so that I can check consistency across the display
- [x] As a user, I can see an animated brightness sweep so that I can evaluate brightness transitions
- [x] As a user, I can view a viewing angle test pattern so that I can test color shift at off-axis angles
- [x] As a user, I can display a burn-in/retention test pattern so that I can detect image retention

### FPS Tests
- [x] As a user, I can see a real-time frame counter so that I can verify my display's refresh rate
- [x] As a user, I can run a UFO test with smooth-scrolling objects so that I can judge motion clarity
- [x] As a user, I can run a VSync tear test with fast-moving bars so that I can detect screen tearing

### Motion Tests
- [x] As a user, I can see a moving crosshair so that I can evaluate pursuit tracking
- [x] As a user, I can see black/white flash frames so that I can evaluate response time
- [x] As a user, I can run a pursuit camera test so that I can assess motion blur
- [x] As a user, I can click to trigger an input lag flasher so that I can estimate input lag
- [x] As a user, I can run a gray-to-gray transition test so that I can evaluate pixel response time
- [x] As a user, I can see scrolling text so that I can evaluate text readability at speed

### HDR Tests
- [x] As a user, I can view an HDR gradient so that I can test extended range display capability
- [x] As a user, I can view an HDR clipping test so that I can detect specular highlight clipping
- [x] As a user, I can view simultaneous black/white areas so that I can measure contrast ratio
- [x] As a user, I can view near-black gradients so that I can evaluate shadow detail visibility

### Geometry Tests
- [x] As a user, I can view a pixel grid so that I can check 1:1 scaling accuracy
- [x] As a user, I can view a checkerboard pattern so that I can check sharpness
- [x] As a user, I can view circles and lines so that I can detect geometric distortion
- [x] As a user, I can view text at various font sizes so that I can evaluate text clarity
- [x] As a user, I can view a circle/square test so that I can verify correct aspect ratio
- [x] As a user, I can view RGB stripe patterns so that I can identify subpixel layout (RGB vs BGR)
- [x] As a user, I can view moire patterns so that I can reveal aliasing artifacts

### Calibration Tools
- [x] As a user, I can calibrate gamma with an adjustable reference and stripe matching so that I can set correct gamma
- [x] As a user, I can adjust per-channel RGB gain sliders so that I can achieve neutral gray balance
- [x] As a user, I can view a sharpness pattern (Siemens star, line pairs, zone plate) so that I can tune sharpness settings
- [x] As a user, I can view near-black and near-white adjustment patches so that I can calibrate contrast
- [x] As a user, I can view 20 near-black patches so that I can fine-tune brightness
- [x] As a user, I can view a full-screen grid with corner circles so that I can align a projector (keystone grid)
- [x] As a user, I can view nested colored borders so that I can reveal display overscan
- [x] As a user, I can view a full-screen reference with Kelvin selector so that I can assess color temperature
- [x] As a user, I can view an RGB crosshair grid so that I can check for color misconvergence
- [x] As a user, I can display a pure black screen so that I can evaluate backlight bleed in a dark room
- [x] As a user, I can use a screen ruler with credit-card reference so that I can determine my display's actual DPI
- [x] As a user, I can view fine stripe patterns so that I can adjust pixel clock and phase on analog displays

### User Interface
- [x] As a user, I can see all tests organized in a categorized card grid so that I can quickly find the test I need
- [x] As a user, I can toggle test descriptions on and off so that I can see more tests at once
- [x] As a user, I can enter fullscreen mode so that I can test without window chrome interference
- [x] As a user, I can see the current test name, resolution, DPR, and FPS in the status bar so that I have context during testing
- [x] As a user, I can use per-test interactive controls (sliders, selectors) so that I can adjust test parameters

### Planned Features
- [ ] As a user, I can save test results as a report so that I can document my display's performance
- [ ] As a user, I can see side-by-side comparison of two test patterns so that I can evaluate differences
- [ ] As a user, I can run an automated test suite that cycles through all patterns so that I can do a complete display check-up
- [ ] As a user, I can see a response time measurement using photodiode simulation so that I can quantify pixel transition speed
- [ ] As a user, I can print a physical test chart so that I can use it for offline reference
