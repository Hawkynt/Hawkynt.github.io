# Date and Time

A multi-function clock application within the »SynthelicZ« desktop, with five tabs providing a full-featured date/time display, alarm management, stopwatch, countdown timer, and world clock -- styled in a classic desktop OS aesthetic.

## Product Requirements

### Purpose
The Date and Time app provides a comprehensive time management suite within the »SynthelicZ« desktop, combining an analog/digital clock with calendar navigation, configurable alarms, a precision stopwatch with lap timing, a countdown timer with progress visualization, and a world clock for tracking multiple time zones. It serves as the desktop's primary timekeeping utility, replacing the need for separate clock, alarm, and timer applications.

### Key Capabilities
- Analog clock face with smooth-updating hands and digital time display alongside a navigable monthly calendar
- Alarm management with configurable repeat modes (Once, Daily, Weekdays), audible notifications, and localStorage persistence
- Stopwatch with millisecond precision, lap recording, and split/cumulative time tracking
- Countdown timer with hours/minutes/seconds input, visual progress bar, and completion alert
- World clock supporting 22 worldwide time zones with mini analog clocks and UTC offset display
- Tab-based interface with lazy rendering for fast initial load

### Design Reference
Modeled after the classic Windows Date and Time Properties dialog and the Windows 10/11 Alarms & Clock app, combining a traditional analog clock and calendar with modern stopwatch, timer, and world clock tabs in an XP-style control aesthetic.

### Technical Constraints
- Runs inside an iframe within the »SynthelicZ« desktop shell
- Pure HTML, CSS, and JavaScript with no external frameworks or build steps
- Must function offline when opened from the file:// protocol
- Themed via CSS custom properties injected by the »SynthelicZ« theme engine

## User Stories

### Date & Time Tab
- [x] As a user, I can see an analog clock face with hour, minute, and second hands that update smoothly
- [x] As a user, I can see a digital time display showing the current time in HH:MM:SS format
- [x] As a user, I can see my local timezone name displayed below the clock
- [x] As a user, I can see a calendar showing the current month with day headers (Mo-Su)
- [x] As a user, I can see today's date highlighted in the calendar
- [x] As a user, I can click on a day in the calendar to select it
- [x] As a user, I can see the selected day highlighted distinctly from today
- [x] As a user, I can navigate months forward and backward using arrow buttons
- [x] As a user, I can select a month from a dropdown
- [x] As a user, I can change the year using spin buttons or by typing directly
- [x] As a user, I can see days from the previous and next month displayed in a muted style
- [x] As a user, I can see Sundays highlighted in red
- [x] As a user, I can see calendar week (CW) numbers displayed for each week row
- [x] As a user, I can see the calendar week for the selected date shown below the calendar
- [x] As a user, I can see clock markers for all 12 hours (major) and minute positions (minor)
- [ ] As a user, I can click on the digital time to toggle between 12-hour and 24-hour formats
- [ ] As a user, I can see the current date displayed in a formatted string (e.g., "Saturday, February 15, 2026")
- [ ] As a user, I can jump to today by clicking a "Today" button

### Alarms Tab
- [x] As a user, I can see a list of all active alarms
- [x] As a user, I can add a new alarm with a specific time
- [x] As a user, I can set a label for each alarm
- [x] As a user, I can set the repeat mode (Once, Daily, Weekdays)
- [x] As a user, I can delete individual alarms
- [x] As a user, I can see alarms persisted across sessions via localStorage
- [x] As a user, I can hear an audible beep notification when an alarm triggers
- [x] As a user, I can see a visual alarm notification overlay with the alarm label and time
- [x] As a user, I can dismiss the alarm notification
- [x] As a user, I can see one-time alarms automatically disabled after firing
- [x] As a user, I can see weekday alarms skip Saturday and Sunday
- [ ] As a user, I can snooze an alarm for a configurable duration (5/10/15 minutes)
- [ ] As a user, I can enable/disable individual alarms without deleting them
- [ ] As a user, I can choose different alarm sounds or tones
- [ ] As a user, I can see alarms sorted by time

### Stopwatch Tab
- [x] As a user, I can see a stopwatch display showing MM:SS.mmm format
- [x] As a user, I can start and stop the stopwatch with a single button
- [x] As a user, I can record lap times while the stopwatch is running
- [x] As a user, I can see lap times listed in reverse chronological order with split and cumulative times
- [x] As a user, I can reset the stopwatch and clear all laps
- [x] As a user, I can see the display update smoothly using requestAnimationFrame
- [ ] As a user, I can see the best and worst lap times highlighted
- [ ] As a user, I can copy lap times to the clipboard
- [ ] As a user, I can see average lap time calculated

### Timer Tab
- [x] As a user, I can set a countdown timer with hours, minutes, and seconds inputs
- [x] As a user, I can see the countdown displayed in HH:MM:SS format
- [x] As a user, I can see a visual progress bar showing elapsed time
- [x] As a user, I can start the countdown timer
- [x] As a user, I can pause the countdown timer
- [x] As a user, I can reset the timer to the configured duration
- [x] As a user, I can hear an audible beep when the timer reaches zero
- [x] As a user, I can see the display update when I change the input values (before starting)
- [ ] As a user, I can see a flashing visual indicator when the timer expires
- [ ] As a user, I can set quick-preset durations (1 min, 5 min, 10 min, 30 min)
- [ ] As a user, I can see recently used timer durations

### World Clock Tab
- [x] As a user, I can add world clocks for different timezones from a dropdown of 22 worldwide locations
- [x] As a user, I can see each world clock displayed as a card with the timezone label
- [x] As a user, I can see the current time in each timezone updated every second
- [x] As a user, I can see a mini analog clock for each timezone
- [x] As a user, I can see the time offset from my local timezone
- [x] As a user, I can remove individual world clocks
- [x] As a user, I can see world clocks persisted across sessions via localStorage
- [x] As a user, I can see default world clocks pre-configured (New York, London, Tokyo)
- [x] As a user, I can see duplicate timezone additions prevented
- [ ] As a user, I can search/filter the timezone dropdown
- [ ] As a user, I can reorder world clocks by dragging
- [ ] As a user, I can see a map view showing all clock locations

### User Interface
- [x] As a user, I can switch between five tabs: Date & Time, Alarms, Stopwatch, Timer, World Clock
- [x] As a user, I can see the active tab highlighted
- [x] As a user, I can see tabs built lazily on first visit for fast initial load
- [x] As a user, I can see the app styled with classic XP-style controls (buttons, inputs, fieldsets)
- [x] As a user, I can see system visual styles applied to the app
- [ ] As a user, I can see the app window title show the current time
