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

- 📉 **Cost History Chart** - Line chart with event markers
- 🔮 **Projections** - Dotted line to next 4 quarter-hours
- 📊 **Burn Rate Chart** - Step chart showing rate changes
- 🎯 **Tooltips** - Hover for segment details

### 🛡️ Quality of Life

- 💱 Multi-currency (USD, EUR, GBP)
- 🌍 **Localization** - Auto-detected language (English, German)
- 📋 Copy meeting summary to clipboard
- ✅ Agenda ROI checklist
- 🔢 +/- buttons for quick attendee changes

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
  detailedRows: [{ id, label, rate, count }]
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
| 🎨 \`Icon\` | Lucide icon wrapper |

### 📦 Dependencies (CDN)

- ⚛️ React 18 - UI framework
- 🎨 Tailwind CSS - Styling
- 🔄 Babel - JSX transformation
- 🖼️ Lucide - Icon library

## 🚀 Planned Features

- 💱 Additional currency support
- 🌍 Additional language support
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
