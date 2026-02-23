# Task Manager

A system monitoring utility for the »SynthelicZ« desktop that provides real-time visibility into running windows and performance metrics -- modeled after the classic Windows Task Manager with Applications and Performance tabs.

## Product Requirements

### Purpose
Task Manager gives users insight into what is running on their »SynthelicZ« desktop and how the system is performing. It allows users to monitor open windows, terminate unresponsive applications, and observe real-time performance metrics like event loop load, memory usage, FPS, and DOM complexity.

### Key Capabilities
- Live application list showing all open windows with their titles, states, and IDs
- End Task functionality to close selected windows
- Real-time event loop load gauge and 60-second history chart
- Real-time memory usage gauge and 60-second history chart
- System statistics (window count, DOM nodes, JS heap size, FPS)
- Tab-based navigation between Applications and Performance views

### Design Reference
Modeled after the classic Windows Task Manager (Windows XP/2000 era), with its Applications tab for managing running programs and a Performance tab featuring the distinctive dark-green-grid performance charts.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Applications Tab

- [x] As a user, I can see a list of all open windows with their titles, states, and window IDs
- [x] As a user, I can click a window entry to select it
- [x] As a user, I can see the selected row highlighted in the task list
- [x] As a user, I can see window states displayed as "Running", "Minimized", or "Maximized"
- [x] As a user, I can click the "End Task" button to close the selected window
- [x] As a user, I can see the total window count in the status bar
- [x] As a user, I can see the task list auto-refresh every second
- [x] As a user, I can see the End Task button disabled when no window is selected
- [x] As a user, I can see the selection cleared when a closed window disappears from the list
- [x] As a user, I can Ctrl+click a window to toggle its selection (multi-select)
- [x] As a user, I can Shift+click to select a range of windows
- [x] As a user, I can see the End Task button display the count of selected windows (e.g., "End Task (3)")

### Performance Tab

- [x] As a user, I can see a real-time event loop load gauge (bar chart with percentage)
- [x] As a user, I can see a 60-second event loop load history chart (line graph)
- [x] As a user, I can see a real-time memory usage gauge when browser memory API is available
- [x] As a user, I can see a 60-second memory usage history chart
- [x] As a user, I can see "N/A" displayed when memory metrics are unavailable
- [x] As a user, I can see statistics boxes showing: open window count, DOM node count, JS heap size (MB), and FPS
- [x] As a user, I can see performance canvases with a dark green grid background reminiscent of Windows Task Manager
- [x] As a user, I can see gauges with gradient fills and percentage text overlay
- [x] As a user, I can see history charts with filled areas under the line

### Tab Navigation

- [x] As a user, I can switch between "Applications" and "Performance" tabs by clicking
- [x] As a user, I can see the active tab visually highlighted
- [x] As a user, I can see canvases automatically resize when switching to the Performance tab

### System Integration

- [x] As a user, I can see the task manager fetch window data via direct same-origin access or SendMessage fallback
- [x] As a user, I can see the task manager measure event loop pressure using setTimeout drift
- [x] As a user, I can see FPS measured via requestAnimationFrame counting
- [x] As a user, I can see DOM node count from the parent document
- [x] As a user, I can see DPI-aware canvas rendering

### User Interface

- [x] As a user, I can see themed visual styles matching the current desktop skin
- [x] As a user, I can click Help > About Task Manager to view application information
- [x] As a user, the performance canvases automatically resize when the window is resized
- [ ] As a user, I can right-click a task and choose "Switch To" to bring it to the foreground
- [ ] As a user, I can right-click a task and choose "Minimize" or "Maximize"
- [ ] As a user, I can see a "Processes" tab showing more detailed per-app resource info
- [ ] As a user, I can see a "Networking" tab showing request activity
- [ ] As a user, I can see the task manager always on top via an "Options" menu
- [ ] As a user, I can see CPU/memory usage per-window in the applications list
- [ ] As a user, I can double-click a task entry to switch to that window
- [ ] As a user, I can see a "New Task" or "Run" button to launch applications
- [ ] As a user, I can see update frequency options (High, Normal, Low, Paused) in a menu
