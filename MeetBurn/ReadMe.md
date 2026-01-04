# 🔥 MeetBurn - Real-Time Meeting Cost Calculator

![License](https://img.shields.io/github/license/Hawkynt/Hawkynt.github.io)
![Language](https://img.shields.io/github/languages/top/Hawkynt/Hawkynt.github.io?color=purple)
[![Last Commit](https://img.shields.io/github/last-commit/Hawkynt/Hawkynt.github.io?branch=main)![Activity](https://img.shields.io/github/commit-activity/y/Hawkynt/Hawkynt.github.io?branch=main)](https://github.com/Hawkynt/Hawkynt.github.io/commits/main)
[![GitHub release](https://img.shields.io/github/v/release/Hawkynt/Hawkynt.github.io)](https://github.com/Hawkynt/Hawkynt.github.io/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/Hawkynt/Hawkynt.github.io/total)](https://github.com/Hawkynt/Hawkynt.github.io/releases)

> Visualize the true cost of meetings in real-time. Track burn rate, project expenses, and make data-driven decisions about meeting ROI.

## ⚡ What It Does

MeetBurn displays the running cost of your meeting as it happens. Configure attendee rates, start the timer, and watch the dollars tick up - making everyone acutely aware of the meeting's true expense.

- 💰 **Live Cost Display** - Large, prominent counter showing accumulated cost
- 📈 **Burn Rate Tracking** - Cost per hour based on attendees and overhead
- 📊 **Projections** - See estimated costs at upcoming 15-minute marks
- 🎯 **ROI Awareness** - Encourages focused, productive meetings

## 🤔 Why It Exists

Meetings are expensive. A 1-hour meeting with 6 engineers at \$100/hr costs \$600 in direct salary alone - often \$780+ with overhead. Yet meetings frequently:

- 🕐 Run over time without consequence
- 👥 Include people who don't need to be there
- 🎯 Lack clear goals or outcomes
- 📋 Could have been an email

MeetBurn makes the invisible visible, creating natural pressure to keep meetings short, focused, and necessary.

## 🛠️ How It Works

### 1️⃣ Configure Attendees

Choose your input mode:

| Mode | Best For | How It Works |
|------|----------|--------------|
| 📊 **Simple** | Quick setup | Average hourly rate x attendee count |
| 📋 **Detailed** | Mixed teams | Individual roles with specific rates |

### 2️⃣ Set Overhead Multiplier

Account for true employee costs beyond salary:

| Multiplier | Includes |
|------------|----------|
| 1.0x | Base salary only |
| 1.3x | + Benefits, equipment |
| 1.5x | + Office space, utilities |
| 2.0x | Full loaded cost |

### 3️⃣ Track in Real-Time

Start the timer and watch:

- 💵 **Current Cost** - Large display updates sub-second
- ⏱️ **Billable Time** - Active meeting duration
- 🔥 **Burn Rate** - Cost per hour (highlights when running)
- 📈 **Cost Chart** - Historical line with future projections

### 4️⃣ Present to the Room

Click **Presentation Mode** for a full-screen display optimized for sharing:

- 📺 Simplified, high-visibility layout
- 🏢 Corporate logo displayed (when configured)
- ➕/➖ Quick attendee adjustments
- 🎨 Dark/light theme toggle
- ⏯️ One-click pause/resume

## ✨ Features

### 💻 Core Functionality

- ⚡ Real-time cost tracking with sub-second updates
- 🔄 Pause/resume without losing accumulated time
- 📊 Segment-based tracking (handles mid-meeting changes)
- 💾 Session persistence (auto-restores within 15 minutes)

### 🎨 Display Options

| Feature | Shortcut | Description |
|---------|----------|-------------|
| 🖥️ Presentation Mode | \`F\` | Full-screen meeting display |
| 🌙 Dark Theme | - | Easy on the eyes |
| 👁️ High Contrast | - | Accessibility mode |
| ⏯️ Pause/Resume | \`Space\` | Toggle timer |
| 🔄 Reset | \`R\` | Clear meeting data |
| ✏️ Edit Panel | \`E\` | Toggle config (presentation mode) |

### 📈 Visualizations

- 📉 **Cost History Chart** - Line chart with event markers, timestamps, and tooltips
- 🔮 **Projections** - Dotted line to next 4 quarter-hours
- 📊 **Burn Rate Chart** - Step chart with event lines, timestamps, and tooltips
- 🎯 **Tooltips** - Hover for segment details on both charts
- 📐 **Responsive Layout** - Charts display side-by-side on wide screens, stacked on narrow

### 🏢 Corporate Design

- 🎨 **Custom Color Palettes** - Fully customizable colors for 4 modes (Light, Light High Contrast, Dark, Dark High Contrast)
- 🖌️ **Color Picker** - Interactive picker with hex, RGB (0-255), and normalized RGB (0-1) input support
- 🔧 **8 Customizable Colors** - Background, Surface, Text, Muted Text, Accent, Border, Success, Warning
- 🔄 **Reset to Defaults** - One-click reset for each palette
- 🖼️ **Logo URL** - Configure your company logo (aspect ratio preserved)
- ✒️ **Wordmark URL** - Display your corporate wordmark/Schriftzug
- 💾 Settings persist locally across sessions

### 🛡️ Quality of Life

- 💱 Multi-currency (USD, EUR, GBP) - auto-defaults based on locale
- 🌍 **Localization** - Auto-detected language (English, German)
- 📋 Copy meeting summary to clipboard
- ✅ Agenda ROI checklist
- 🔢 +/- buttons for quick attendee changes
- 💾 **Full State Persistence** - Presentation mode, theme, all settings restored on reload

### 🔗 URL Parameter Sharing

Share pre-configured meeting links via email or messenger. URL parameters override local settings.

**Simple Parameters:**

| Parameter | Example | Description |
|-----------|---------|-------------|
| `att` | `?att=5` | Attendee count |
| `rate` | `?rate=120` | Hourly rate |
| `overhead` | `?overhead=1.5` | Overhead multiplier |
| `currency` | `?currency=EUR` | Currency (USD/EUR/GBP) |
| `title` | `?title=Sprint%20Review` | Meeting title |
| `dark` | `?dark=1` | Dark theme (1/0) |
| `contrast` | `?contrast=1` | High contrast (1/0) |
| `logo` | `?logo=https://...` | Logo URL |
| `lang` | `?lang=de` | Language (en/de) |

**Complex Parameters:**

| Parameter | Format | Description |
|-----------|--------|-------------|
| `roles` | `Manager:150:2,Engineer:100:4` | Detailed roles (label:rate:count) |
| `colors` | Base64 compact array | Custom palettes as `[[hex6,...],...]` |

**Example URLs:**

```
# Quick: 5 attendees
index.html?att=5

# Team meeting: 8 people at 100 EUR/hr
index.html?att=8&rate=100&currency=EUR&overhead=1.5

# Detailed roles
index.html?roles=Manager:150:1,Developer:100:5,Designer:90:2
```

**Share Button** - Copy shareable links directly from the sidebar:
- Quick (attendees only)
- Full (human-readable with colors)

## 📐 State Structure

```javascript
{
  timerRunning: boolean,      // Is the meeting timer active
  startTime: number | null,   // Meeting start timestamp
  segments: [{                // Timeline segments for accurate cost calculation
    timestamp: number,
    burnRate: number,
    type: 'active' | 'paused',
    attendeeCount: number,
    costAtStart: number
  }],
  // Configuration
  title: string,
  currency: 'USD' | 'EUR' | 'GBP',
  locale: 'en' | 'de',            // Auto-detected UI language
  inputMode: 'simple' | 'detailed',
  overhead: number,
  simpleInputs: { count: number, rate: number },
  detailedRows: [{ id, label, rate, count }],
  // UI State (persisted)
  presentationMode: boolean,
  isDark: boolean,
  highContrast: boolean,
  // Corporate Design
  customPalettes: {           // Color palettes for each theme mode
    light: { background, surface, text, textMuted, accent, border, success, warning },
    lightContrast: { ... },
    dark: { ... },
    darkContrast: { ... }
  },
  logoUri: string,            // Company logo URL
  schriftzugUri: string       // Wordmark/Schriftzug URL
}
```

## 🌐 Live Demo

Open [index.html](index.html) in any modern browser - no build step required.

## 🏗️ Architecture

Single-page React application:

| Component | Purpose |
|-----------|---------|
| 🎯 \`App\` | Main component, all state management |
| 📈 \`CostHistoryChart\` | Canvas line chart with projections |
| 📊 \`BurnRateChart\` | Canvas step chart for rate history |
| 🖌️ \`ColorPicker\` | Color picker with hex/RGB/normalized input |
| 🎨 \`Icon\` | Lucide icon wrapper |

### 📦 Dependencies (CDN)

- ⚛️ React 18 - UI framework
- 🎨 Tailwind CSS - Styling
- 🔄 Babel - JSX transformation
- 🖼️ Lucide - Icon library

## 🚀 Planned Features

- 💱 More currencies (currently: USD, EUR, GBP)
- 🌍 More languages (currently: English, German)
- 📤 Export to CSV/JSON
- 📅 Meeting templates
- 🔗 Calendar integration
- 📊 Historical analytics

## ⚠️ Known Limitations

- 💾 localStorage only - clearing browser data resets settings
- 📈 Projections assume constant burn rate
- 🌐 No server-side persistence - data is browser-local

## 📄 License

Part of the »SynthelicZ« project collection by Hawkynt.
